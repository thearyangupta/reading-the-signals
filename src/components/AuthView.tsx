import React, { useState } from 'react';
import { signInWithGoogle, signInAsGuest } from '../lib/firebase';
import { Sparkles, Shield, Lock, Compass, ArrowRight, Loader2 } from 'lucide-react';

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
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* Header visual */}
        <div className="text-center space-y-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 text-stone-100 flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="w-6 h-6 text-amber-300" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
            Reading the Signals
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            A private space to unpack situations, observe your reactions, and reflect with an inquisitive AI partner.
          </p>
        </div>

        {/* Security badges */}
        <div className="space-y-2.5 mb-8 bg-stone-50/80 p-4 rounded-xl border border-stone-200/60 text-xs text-stone-600">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Strict Firestore UID Isolation — your entries are only accessible by you.</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Lock className="w-4 h-4 text-stone-700 shrink-0" />
            <span>Zero-Credential Client Hygiene — AI calls are proxied securely on the backend.</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <Compass className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Reflective Partner — non-judgmental dialogue focused on self-awareness.</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            id="google-signin-button"
            onClick={handleGoogleSignIn}
            disabled={loading || guestLoading}
            className="w-full flex items-center justify-center space-x-3 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium py-3 px-4 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-stone-300" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            )}
            <span>Sign in with Google</span>
          </button>

          <button
            id="guest-signin-button"
            onClick={handleGuestSignIn}
            disabled={loading || guestLoading}
            className="w-full flex items-center justify-center space-x-2 bg-stone-100 hover:bg-stone-200/80 text-stone-800 text-sm font-medium py-3 px-4 rounded-xl transition-all border border-stone-200/70 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
          >
            {guestLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
            ) : (
              <>
                <span>Continue as Guest</span>
                <ArrowRight className="w-4 h-4 text-stone-500" />
              </>
            )}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] text-stone-400">
          Your reflections are private, encrypted, and isolated by your user ID.
        </p>
      </div>
    </div>
  );
};
