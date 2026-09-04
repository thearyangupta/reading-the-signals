import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, ChatMessage } from '../types';
import { appendReflectionMessage, auth } from '../lib/firebase';
import { Send, User, Bot, Loader2, Lightbulb, AlertCircle } from 'lucide-react';
import { SignalGlyph } from './SignalGlyph';

interface ReflectionChatProps {
  userId: string;
  entry: JournalEntry;
  onEntryUpdated: (updated: JournalEntry) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollMode?: 'contained' | 'document';
}

const SUGGESTED_PROMPTS = [
  'What assumptions might I be making about this situation?',
  'How can I separate observable facts from my own interpretations?',
  'What emotions was I feeling beneath the initial reaction?',
  'What part of this outcome is within my direct control?',
];

export const ReflectionChat: React.FC<ReflectionChatProps> = ({
  userId,
  entry,
  onEntryUpdated,
  scrollContainerRef,
  scrollMode = 'contained',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(entry.reflections || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedSubmission, setFailedSubmission] = useState<{ text: string; userMessageId: string } | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const autoScrollActiveRef = useRef(false);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMessages(entry.reflections || []);
  }, [entry.reflections]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    if (!autoScrollActiveRef.current) return;

    const scrollFrame = window.requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      const composer = composerRef.current;
      if (!scrollContainer || !composer) return;

      const containerBounds = scrollMode === 'contained'
        ? scrollContainer.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight };
      const composerBounds = composer.getBoundingClientRect();
      const overflowBelow = composerBounds.bottom - containerBounds.bottom;
      const overflowAbove = composerBounds.top - containerBounds.top;
      const scrollDistance = overflowBelow > 0
        ? overflowBelow
        : overflowAbove < 0
          ? overflowAbove
          : 0;

      if (scrollDistance !== 0) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const scrollTarget = scrollMode === 'contained' ? scrollContainer : window;
        scrollTarget.scrollBy({
          top: scrollDistance,
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      }
    });

    if (!loading) autoScrollActiveRef.current = false;
    return () => window.cancelAnimationFrame(scrollFrame);
  }, [messages, loading, scrollContainerRef, scrollMode]);

  const handleSendMessage = async (textToSend?: string, isRetry = false) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    autoScrollActiveRef.current = true;
    setError(null);
    const baseMessages = !isRetry && failedSubmission
      ? messages.filter((message) => message.id !== failedSubmission.userMessageId)
      : messages;
    if (!isRetry) {
      setFailedSubmission(null);
      setInput('');
    }

    const retryTarget = isRetry ? failedSubmission : null;
    const userMessage: ChatMessage = retryTarget
      ? messages.find((message) => message.id === retryTarget.userMessageId) || {
          id: retryTarget.userMessageId,
          role: 'user',
          content: retryTarget.text,
          timestamp: Date.now(),
        }
      : {
          id: `user-${Date.now()}`,
          role: 'user',
          content: messageContent,
          timestamp: Date.now(),
        };
    const historyForRequest = retryTarget
      ? messages.filter((message) => message.id !== retryTarget.userMessageId)
      : baseMessages;
    const newMessagesList = retryTarget ? messages : [...baseMessages, userMessage];
    if (!retryTarget) setMessages(newMessagesList);
    setLoading(true);
    let receivedModelReply = false;
    const currentRequestId = ++requestIdRef.current;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const timeoutId = setTimeout(() => {
      if (requestIdRef.current === currentRequestId) {
        requestIdRef.current += 1;
        abortController.abort();
        abortControllerRef.current = null;
        timeoutRef.current = null;
        if (!receivedModelReply) {
          setFailedSubmission({ text: messageContent, userMessageId: userMessage.id });
        }
        setError('This took too long. Please try again.');
        setLoading(false);
      }
    }, 32000);
    timeoutRef.current = timeoutId;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to continue the reflection dialogue.');
      }
      const idToken = await currentUser.getIdToken();
      if (requestIdRef.current !== currentRequestId) return;

      // 1. Send to server-side Gemini reflection partner endpoint
      const response = await fetch('/api/reflect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          entry: {
            title: entry.title,
            date: entry.date,
            content: entry.content,
            situation: entry.situation,
            behaviorOrEvent: entry.behaviorOrEvent,
            feelingOrReaction: entry.feelingOrReaction,
            importantContext: entry.importantContext,
            summary: entry.summary,
          },
          history: historyForRequest,
          userMessage: messageContent,
        }),
        signal: abortController.signal,
      });
      if (requestIdRef.current !== currentRequestId) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details ? `${errorData.error || 'Error'}: ${errorData.details}` : (errorData.error || `Server responded with status ${response.status}`));
      }

      const data = await response.json();
      if (requestIdRef.current !== currentRequestId) return;
      const modelReply = data.reply || "I'm here with you. What else comes up as you reflect on this?";
      receivedModelReply = true;

      const botMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: modelReply,
        timestamp: Date.now(),
      };

      const finalMessagesList = [...newMessagesList, botMessage];
      setMessages(finalMessagesList);
      setFailedSubmission(null);

      // 2. Persist updated reflections to Firestore
      await appendReflectionMessage(userId, entry.id, newMessagesList, botMessage);
      if (requestIdRef.current === currentRequestId) {
        onEntryUpdated({
          ...entry,
          reflections: finalMessagesList,
        });
      }
    } catch (err: any) {
      console.error('Reflection chat error:', err);
      if (requestIdRef.current === currentRequestId) {
        if (!receivedModelReply) {
          setFailedSubmission({ text: messageContent, userMessageId: userMessage.id });
        }
        setError(err?.message || 'Unable to communicate with the reflection partner. Please try again.');
      }
    } finally {
      if (timeoutRef.current === timeoutId) {
        clearTimeout(timeoutId);
        timeoutRef.current = null;
      }
      if (abortControllerRef.current === abortController) abortControllerRef.current = null;
      if (requestIdRef.current === currentRequestId) setLoading(false);
    }
  };

  return (
    <div className="flex min-w-0 w-full flex-col rounded-card border border-border border-l-4 border-l-accent-primary/60 bg-surface-ai/40">
      {/* Header bar */}
      <div className="flex min-w-0 items-center justify-between border-b border-border-ai bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center space-x-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-ai text-accent-primary">
            <SignalGlyph />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-accent-primary">AI observations in dialogue</h4>
            <p className="text-xs text-text-muted">
              A non-diagnostic reflection conversation
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div role="log" aria-live="polite" aria-label="Reflection dialogue" className="min-w-0 space-y-3.5 p-4">
        {messages.length === 0 ? (
          <div className="flex min-w-0 flex-col items-center justify-center space-y-3 px-4 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-text-muted">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">Start a deeper reflection</p>
              <p className="mt-1 max-w-xs text-xs text-text-muted">
                Explore the situation from different angles, inspect your feelings, or separate facts from assumptions.
              </p>
            </div>

            {/* Quick suggested prompt pills */}
            <div className="flex min-w-0 max-w-md flex-wrap justify-center gap-1.5 pt-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="flex min-h-11 items-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-left text-xs text-text-secondary shadow-low transition-colors hover:bg-surface-subtle hover:text-text-primary"
                >
                  <Lightbulb className="h-3 w-3 shrink-0 text-accent-primary" aria-hidden="true" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      isUser
                        ? 'bg-text-primary text-surface'
                        : 'border border-border-ai bg-surface-ai text-accent-primary'
                    }`}
                  >
                    {isUser ? <User className="h-3.5 w-3.5" aria-hidden="true" /> : <Bot className="h-3.5 w-3.5" aria-hidden="true" />}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'rounded-tr-xs bg-text-primary text-surface shadow-low'
                        : 'rounded-tl-xs border border-border-ai bg-surface-ai text-text-primary shadow-low'
                    }`}
                  >
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.content}</p>
                    <div className={`mt-1 text-right text-xs ${isUser ? 'text-surface/60' : 'text-text-muted'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {loading && (
          <div role="status" className="flex items-start space-x-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-ai bg-surface-ai text-accent-primary">
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <div className="flex items-center space-x-2 rounded-2xl rounded-tl-xs border border-border-ai bg-surface-ai px-3.5 py-2.5 shadow-low">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-primary" aria-hidden="true" />
              <span className="text-xs text-text-secondary">Reflecting on your observation…</span>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center space-x-2 rounded-card border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => failedSubmission && handleSendMessage(failedSubmission.text, true)}
              disabled={!failedSubmission || loading}
              className="min-h-11 px-2 text-xs font-medium underline"
            >
              Retry
            </button>
          </div>
        )}

      </div>

      {/* Input Form */}
      <div ref={composerRef} className="border-t border-border-ai bg-surface p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex min-w-0 items-center space-x-2"
        >
          <label htmlFor="reflection-chat-input" className="sr-only">
            Message for the AI reflection partner
          </label>
          <input
            id="reflection-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Type a reflection question or feeling..."
            className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3.5 py-2.5 text-base text-text-primary placeholder:text-text-muted sm:text-sm"
          />
          <button
            id="send-reflection-message-button"
            type="submit"
            aria-label={loading ? 'Sending reflection message' : 'Send reflection message'}
            disabled={!input.trim() || loading}
            className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-control bg-accent-primary p-2.5 text-white shadow-low transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </form>
      </div>
    </div>
  );
};
