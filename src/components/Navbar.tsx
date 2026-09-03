import React from 'react';
import { UserProfile } from '../types';
import {
  BookOpenText,
  ChevronDown,
  Lightbulb,
  LogOut,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

export type AppView = 'journal' | 'insights';

interface NavbarProps {
  user: UserProfile | null;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onNewEntry: () => void;
  onSignOut: () => void;
}

const accountName = (user: UserProfile) =>
  user.displayName || (user.isAnonymous ? 'Guest' : user.email?.split('@')[0]) || 'Account';

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onNavigate,
  onNewEntry,
  onSignOut,
}) => {
  const navButtonClass = (view: AppView) =>
    `min-h-11 border-b-2 px-3 text-sm transition-colors ${
      activeView === view
        ? 'border-accent-primary font-semibold text-accent-primary'
        : 'border-transparent font-medium text-text-secondary hover:border-border-strong hover:text-text-primary'
    }`;

  const mobileNavButtonClass = (view: AppView) =>
    `min-h-14 border-t-2 px-1 text-xs transition-colors ${
      activeView === view
        ? 'border-accent-primary font-semibold text-accent-primary'
        : 'border-transparent font-medium text-text-secondary'
    }`;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-shell items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-text-primary text-surface shadow-xs" aria-hidden="true">
              <Sparkles className="h-5 w-5 text-surface-subtle" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-base font-semibold tracking-tight text-text-primary sm:text-lg">
                Reading the Signals
              </h1>
              {!user && <p className="hidden text-xs text-text-muted sm:block">Private reflection journal</p>}
            </div>
          </div>

          {user && (
            <>
              <nav aria-label="Primary" className="hidden items-stretch gap-1 self-stretch md:flex">
                <button type="button" aria-pressed={activeView === 'journal'} onClick={() => onNavigate('journal')} className={navButtonClass('journal')}>
                  Journal
                </button>
                <button type="button" aria-pressed={activeView === 'insights'} onClick={() => onNavigate('insights')} className={navButtonClass('insights')}>
                  Insights
                </button>
                <div className="flex items-center pl-2">
                  <button
                    id="new-reflection-button"
                    type="button"
                    onClick={onNewEntry}
                    className="inline-flex min-h-10 items-center gap-2 rounded-control bg-accent-primary px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-primary-hover"
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    Write
                  </button>
                </div>
              </nav>

              <div className="hidden items-center gap-3 md:flex">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-text-muted">
                  <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" />
                  Private to you
                </span>
                <details className="group relative">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary [&::-webkit-details-marker]:hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="max-w-28 truncate">{accountName(user)}</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-card border border-border bg-surface p-3 shadow-dialog">
                    <p className="text-sm font-semibold text-text-primary">Account</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{user.email || 'Guest session'}</p>
                    <button id="sign-out-button" type="button" onClick={onSignOut} className="mt-3 inline-flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary">
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                </details>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-text-muted md:hidden" title="Private to you">
                <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="sr-only">Private to you</span>
                <span aria-hidden="true" className="hidden min-[420px]:inline">Private to you</span>
              </span>
            </>
          )}
        </div>
      </header>

      {user && (
        <nav aria-label="Primary mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(41,39,34,0.08)] md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-4 px-2">
            <button type="button" aria-pressed={activeView === 'journal'} onClick={() => onNavigate('journal')} className={mobileNavButtonClass('journal')}>
              <span className="flex flex-col items-center justify-center gap-1"><BookOpenText className="h-5 w-5" aria-hidden="true" />Journal</span>
            </button>
            <button type="button" onClick={onNewEntry} className="min-h-14 border-t-2 border-accent-primary px-1 text-xs font-semibold text-accent-primary">
              <span className="flex flex-col items-center justify-center gap-1"><PenLine className="h-5 w-5" aria-hidden="true" />Write</span>
            </button>
            <button type="button" aria-pressed={activeView === 'insights'} onClick={() => onNavigate('insights')} className={mobileNavButtonClass('insights')}>
              <span className="flex flex-col items-center justify-center gap-1"><Lightbulb className="h-5 w-5" aria-hidden="true" />Insights</span>
            </button>
            <details className="group relative">
              <summary className="flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-1 border-t-2 border-transparent px-1 text-xs font-medium text-text-secondary [&::-webkit-details-marker]:hidden">
                <UserRound className="h-5 w-5" aria-hidden="true" />
                Account
              </summary>
              <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-3 w-[min(18rem,calc(100vw-1.5rem))] rounded-card border border-border bg-surface p-3 shadow-dialog">
                <p className="truncate text-sm font-semibold text-text-primary">{accountName(user)}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">{user.email || 'Guest session'}</p>
                <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                  <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" />
                  Private to you
                </p>
                <button type="button" onClick={onSignOut} className="mt-3 inline-flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </details>
          </div>
        </nav>
      )}
    </>
  );
};
