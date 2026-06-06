import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';

type Message = { role: 'user' | 'assistant'; content: string };

const SESSION_STORAGE_KEY = 'alos_session_id';

const OPENING_MESSAGE =
  "Welcome. Before we begin, I want to be straight with you about how this works. Over the next little while I'll ask you some thoughtful questions about your life — your health, your relationships, your goals, and what matters most to you. At the end I'll reflect back what I heard and share a complete wellness snapshot personal to you. I'll ask for your email at some point — to save your progress if life interrupts, and to send your full report when we're done. Your email stays with us. We don't share it or sell it. That's the whole deal. Ready to get started?";

export function AssessmentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initStartedRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    initSession();
  }, []);

  const initSession = async () => {
    try {
      const storedId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;

      if (storedId) {
        const { data, error: fetchError } = await supabase
          .from('assessments')
          .select('session_id, conversation_history')
          .eq('session_id', storedId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          const history = Array.isArray(data.conversation_history)
            ? (data.conversation_history as Message[])
            : [];
          setSessionId(data.session_id);
          setMessages(history);
          setInitializing(false);
          return;
        }

        localStorage.removeItem(SESSION_STORAGE_KEY);
      }

      const newId = crypto.randomUUID();
      const initialHistory: Message[] = [{ role: 'assistant', content: OPENING_MESSAGE }];

      const { error: insertError } = await supabase.from('assessments').insert({
        session_id: newId,
        conversation_history: initialHistory,
      });

      if (insertError) throw insertError;

      localStorage.setItem(SESSION_STORAGE_KEY, newId);
      setSessionId(newId);
      setMessages(initialHistory);
    } catch (err) {
      console.error('Failed to initialize assessment session:', err);
      setError('We had trouble starting your session. Please refresh to try again.');
    } finally {
      setInitializing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !sessionId) return;

    setError(null);
    const userMessage: Message = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/call-alos-dd`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationHistory: nextMessages }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      if (!data?.message || typeof data.message !== 'string') {
        throw new Error('Invalid response format from server');
      }

      const assistantMessage: Message = { role: 'assistant', content: data.message };
      const updatedMessages = [...nextMessages, assistantMessage];

      setMessages(updatedMessages);

      const { error: updateError } = await supabase
        .from('assessments')
        .update({
          conversation_history: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (updateError) {
        console.error('Failed to persist conversation:', updateError);
      }
    } catch (err) {
      console.error('Error in assessment chat flow:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response. Please try again.');
      setMessages((prev) => prev.filter((m) => m !== userMessage));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header
        className="flex items-center gap-4 px-4 py-3 sm:px-6 sm:py-4 shadow-sm"
        style={{ backgroundColor: '#BA7517' }}
      >
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            backgroundColor: '#FAEEDA',
            border: '2px solid #EF9F27',
            width: 48,
            height: 48,
          }}
        >
          <img src="/compass.svg" alt="" className="w-7 h-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-white font-semibold text-base sm:text-lg leading-tight truncate">
            ALOS Development Director
          </h1>
          <p className="text-white text-xs sm:text-sm opacity-90 truncate">
            Authentic Life Operating System
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="inline-block rounded-full"
            style={{ backgroundColor: '#639922', width: 10, height: 10 }}
            aria-label="Active"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {initializing && messages.length === 0 && !error && (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Starting your session…</span>
            </div>
          )}

          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3"
                style={
                  message.role === 'user'
                    ? { backgroundColor: '#E6F1FB', color: '#0C447C' }
                    : { backgroundColor: 'var(--color-background-secondary, #F3F4F6)', color: '#1F2937' }
                }
              >
                <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">
                  {message.content}
                </p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: 'var(--color-background-secondary, #F3F4F6)' }}
              >
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-2xl mx-auto flex gap-2 sm:gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={initializing ? 'Loading…' : 'Type your message…'}
            disabled={initializing || loading || !sessionId}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 sm:py-3 text-sm sm:text-base focus:outline-none"
            style={{
              ['--tw-ring-color' as string]: '#BA7517',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#BA7517')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#D1D5DB')}
          />
          <button
            type="submit"
            disabled={initializing || loading || !sessionId || !input.trim()}
            className="rounded-lg px-4 py-2 sm:py-3 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#BA7517', color: 'white' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#854F0B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#BA7517';
            }}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
