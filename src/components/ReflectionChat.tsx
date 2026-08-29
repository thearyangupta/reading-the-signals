import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, ChatMessage } from '../types';
import { appendReflectionMessage } from '../lib/firebase';
import { Sparkles, Send, User, Bot, Loader2, Lightbulb, AlertCircle } from 'lucide-react';

interface ReflectionChatProps {
  userId: string;
  entry: JournalEntry;
  isDemoMode?: boolean;
  onEntryUpdated: (updated: JournalEntry) => void;
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
  isDemoMode = false,
  onEntryUpdated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(entry.reflections || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(entry.reflections || []);
  }, [entry.reflections]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

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
      // 1. Send to server-side Gemini reflection partner endpoint
      const response = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      // 2. Persist updated reflections to Firestore if not demo mode
      if (!isDemoMode && userId !== 'demo-user' && !entry.id.startsWith('demo-')) {
        await appendReflectionMessage(userId, entry.id, newMessagesList, botMessage);
      }
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
    <div className="flex flex-col h-full bg-stone-50/50 rounded-xl border border-stone-200/80 overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-3 bg-white border-b border-stone-200/70 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1 bg-amber-100 text-amber-900 rounded-md">
            <Sparkles className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-stone-900">AI Reflection Partner</h4>
            <p className="text-[10px] text-stone-500">
              Examining observations & feelings • Non-diagnostic dialogue
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 max-h-[380px] min-h-[220px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6 text-stone-500 space-y-3">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
              <Bot className="w-5 h-5 text-stone-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-700">Start a deeper reflection</p>
              <p className="text-[11px] text-stone-400 max-w-xs mt-0.5">
                Explore the situation from different angles, inspect your feelings, or separate facts from assumptions.
              </p>
            </div>

            {/* Quick suggested prompt pills */}
            <div className="flex flex-wrap gap-1.5 justify-center max-w-md pt-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="text-left text-[11px] bg-white hover:bg-stone-100 text-stone-700 px-2.5 py-1.5 rounded-lg border border-stone-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
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
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] ${
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
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div
                      className={`text-[9px] mt-1 text-right ${
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
          <div className="flex items-start space-x-2.5">
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
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => handleSendMessage()}
              className="text-[11px] underline font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-2.5 bg-white border-t border-stone-200/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <input
            id="reflection-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Type a reflection question or feeling..."
            className="flex-1 text-xs px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900"
          />
          <button
            id="send-reflection-message-button"
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl transition-all disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
