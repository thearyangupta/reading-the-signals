import React from 'react';
import { UserProfile } from '../types';
import { Sparkles, Plus, LogOut, ShieldCheck, User } from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  onNewEntry: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onNewEntry, onSignOut }) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-stone-200/80 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-stone-900 text-stone-100 flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-300/90" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-stone-900 font-serif">
              Reading the Signals
            </h1>
            <p className="text-xs text-stone-500 font-normal hidden sm:block">
              Private AI-Powered Reflection Journal
            </p>
          </div>
        </div>

        {/* User controls */}
        {user ? (
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              id="new-reflection-button"
              onClick={onNewEntry}
              className="flex items-center space-x-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-medium py-2 px-3.5 rounded-lg transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Reflection</span>
            </button>

            <div className="h-5 w-px bg-stone-200 mx-1 hidden sm:block" />

            <div className="flex items-center space-x-2 bg-stone-100/80 rounded-lg px-2.5 py-1.5 border border-stone-200/60">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-5 h-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 text-stone-600" />
              )}
              <span className="text-xs font-medium text-stone-700 max-w-[100px] truncate hidden md:inline">
                {user.displayName || (user.isAnonymous ? 'Guest User' : user.email?.split('@')[0])}
              </span>
              <span title="Firestore UID Isolation Active" className="flex items-center text-emerald-700 text-[11px] font-medium pl-1">
                <ShieldCheck className="w-3.5 h-3.5 mr-0.5 text-emerald-600" />
                <span className="hidden lg:inline">Isolated</span>
              </span>
            </div>

            <button
              id="sign-out-button"
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
