import React, { useState } from 'react';
import { signInWithGoogle, signInAsGuest } from '../lib/firebase';
import { Loader2, ShieldCheck } from 'lucide-react';
import { SignalMark } from './SignalMark';

interface AuthViewProps {
  onAuthSuccess?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      if (onAuthSuccess) onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    try {
      setGuestLoading(true);
      setError(null);
      await signInAsGuest();
      if (onAuthSuccess) onAuthSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to initialize anonymous session. Please try again.');
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <section className="journal-atmosphere relative isolate min-h-screen w-full overflow-hidden">
      <div aria-hidden="true" className="journal-atmosphere-glow" />
      <div aria-hidden="true" className="journal-atmosphere-grain" />
      <div aria-hidden="true" className="journal-atmosphere-dots" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-10 px-5 py-16 text-center sm:px-8 sm:py-20">
        <div className="auth-reveal w-full">
          <p className="flex items-center justify-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-journal-ink-muted">
            <SignalMark className="h-4 w-4 text-journal-accent-bright [overflow:visible]" />
            Private Reflection Journal
          </p>
          <h1
            className="mt-6 text-balance font-serif font-normal leading-[1.1] tracking-tight text-journal-ink"
            style={{ fontSize: 'clamp(2.25rem, 4.2vw, 3.5rem)' }}
          >
            Read what keeps returning.
          </h1>
        </div>

        <div className="auth-reveal w-full max-w-md space-y-6" style={{ animationDelay: '160ms' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-journal-accent-bright">Continue</p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-journal-ink-muted">
              Your journal is private to your account. AI tools work only from the reflections included in your current scope.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              id="google-signin-button"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || guestLoading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-control border border-journal-border bg-journal-panel px-4 py-3 text-sm font-semibold text-journal-ink shadow-low transition-[background-color,border-color,transform] hover:border-journal-accent hover:bg-journal-panel-2/70 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:border-journal-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-journal-accent"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Signing in&hellip;</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <button
              id="guest-signin-button"
              type="button"
              onClick={handleGuestSignIn}
              disabled={loading || guestLoading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-journal-border bg-journal-panel/35 px-4 py-2.5 text-sm font-medium text-journal-ink transition-[background-color,border-color,color,transform] hover:border-journal-accent hover:bg-journal-panel active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:border-journal-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-journal-accent"
            >
              {guestLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Continuing&hellip;</span>
                </>
              ) : (
                <span>Continue as guest</span>
              )}
            </button>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-journal-ink-muted">
            <ShieldCheck className="h-4 w-4 shrink-0 text-journal-accent-bright" aria-hidden="true" />
            Private to you &mdash; sign out anytime from the account menu.
          </p>

          <span role="status" aria-live="polite" className="sr-only">
            {loading ? 'Signing in with Google.' : guestLoading ? 'Continuing as guest.' : ''}
          </span>
        </div>
      </div>
    </section>
  );
};
