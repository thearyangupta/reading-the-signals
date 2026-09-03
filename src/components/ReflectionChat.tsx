import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, ChatMessage } from '../types';
import { appendReflectionMessage, auth } from '../lib/firebase';
import { Sparkles, Send, User, Bot, Loader2, Lightbulb, AlertCircle } from 'lucide-react';

interface ReflectionChatProps {
  userId: string;
  entry: JournalEntry;
  onEntryUpdated: (updated: JournalEntry) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
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
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(entry.reflections || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const autoScrollActiveRef = useRef(false);

  useEffect(() => {
    setMessages(entry.reflections || []);
  }, [entry.reflections]);

  useEffect(() => {
    if (!autoScrollActiveRef.current) return;

    const scrollFrame = window.requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      const composer = composerRef.current;
      if (!scrollContainer || !composer) return;

      const containerBounds = scrollContainer.getBoundingClientRect();
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
        scrollContainer.scrollBy({
          top: scrollDistance,
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      }
    });

    if (!loading) autoScrollActiveRef.current = false;
    return () => window.cancelAnimationFrame(scrollFrame);
  }, [messages, loading, scrollContainerRef]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    autoScrollActiveRef.current = true;
    setError(null);
    setInput('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    const newMessagesList = [...messages, userMessage];
    setMessages(newMessagesList);
    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to continue the reflection dialogue.');
      }
      const idToken = await currentUser.getIdToken();

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
          history: messages,
          userMessage: messageContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details ? `${errorData.error || 'Error'}: ${errorData.details}` : (errorData.error || `Server responded with status ${response.status}`));
      }

      const data = await response.json();
      const modelReply = data.reply || "I'm here with you. What else comes up as you reflect on this?";

      const botMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: modelReply,
        timestamp: Date.now(),
      };

      const finalMessagesList = [...newMessagesList, botMessage];
      setMessages(finalMessagesList);

      // 2. Persist updated reflections to Firestore
      await appendReflectionMessage(userId, entry.id, newMessagesList, botMessage);
      onEntryUpdated({
        ...entry,
        reflections: finalMessagesList,
      });
    } catch (err: any) {
      console.error('Reflection chat error:', err);
      setError(err?.message || 'Unable to communicate with the reflection partner. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-w-0 w-full flex-col rounded-card border border-border bg-surface-ai/40">
      {/* Header bar */}
      <div className="flex min-w-0 items-center justify-between border-b border-border-ai bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center space-x-2">
          <div className="p-1 bg-amber-100 text-amber-900 rounded-md">
            <Sparkles className="w-4 h-4 text-amber-700" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-primary">AI observations in dialogue</h4>
            <p className="text-xs text-text-muted">
              A non-diagnostic reflection conversation
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div role="log" aria-live="polite" aria-label="Reflection dialogue" className="min-w-0 space-y-3.5 p-4">
        {messages.length === 0 ? (
          <div className="flex min-w-0 flex-col items-center justify-center space-y-3 px-4 py-6 text-center text-stone-500">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
              <Bot className="w-5 h-5 text-stone-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-700">Start a deeper reflection</p>
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
                  <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
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
                        ? 'bg-stone-900 text-white'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-amber-800" />}
                  </div>

                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-stone-900 text-stone-100 rounded-tr-xs shadow-2xs'
                        : 'bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs shadow-2xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.content}</p>
                    <div
                      className={`mt-1 text-right text-xs ${
                        isUser ? 'text-stone-400' : 'text-stone-400'
                      }`}
                    >
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
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-amber-800" />
            </div>
            <div className="bg-white border border-stone-200/80 rounded-2xl rounded-tl-xs px-3.5 py-2.5 flex items-center space-x-2 shadow-2xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span className="text-xs text-stone-500">Reflecting on your observation...</span>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => handleSendMessage()}
              className="min-h-11 px-2 text-xs font-medium underline"
            >
              Retry
            </button>
          </div>
        )}

      </div>

      {/* Input Form */}
      <div ref={composerRef} className="border-t border-stone-200/80 bg-white p-2.5">
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
            className="min-h-11 min-w-11 inline-flex items-center justify-center p-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition-all disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
