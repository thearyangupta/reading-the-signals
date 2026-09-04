import React from 'react';
import { UserProfile } from '../types';
import {
  BookOpenText,
  ChevronDown,
  Lightbulb,
  LogOut,
  PenLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { SignalMark } from './SignalMark';

export type AppView = 'journal' | 'insights';

interface NavbarProps {
  user: UserProfile | null;
  activeView: AppView;
  writeActive?: boolean;
  onNavigate: (view: AppView) => void;
  onNewEntry: () => void;
  onSignOut: () => void;
  /** Themes the Navbar into the Journal archive's dark palette (neutral
   * graphite + a very sparing dusty-violet accent, reserved almost
   * entirely for the active-nav indicator) — used only for the Journal
   * grid view. Auth never renders this component at all, so this branch
   * has no effect on Auth. Structure/behavior is identical either way;
   * only colors/materials change. */
  dark?: boolean;
}

const accountName = (user: UserProfile) =>
  user.displayName || (user.isAnonymous ? 'Guest' : user.email?.split('@')[0]) || 'Account';

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  writeActive = false,
  onNavigate,
  onNewEntry,
  onSignOut,
  dark = false,
}) => {
  const navButtonClass = (view: AppView) =>
    `min-h-11 border-b-2 px-3 text-sm transition-colors ${
      activeView === view && !(view === 'journal' && writeActive)
        ? dark
          ? 'border-journal-accent-bright font-semibold text-journal-accent-bright'
          : 'border-accent-primary font-semibold text-accent-primary'
        : dark
          ? 'border-transparent font-medium text-journal-ink-muted hover:border-journal-border hover:text-journal-ink'
          : 'border-transparent font-medium text-text-secondary hover:border-border-strong hover:text-text-primary'
    }`;

  const mobileNavButtonClass = (view: AppView) =>
    `min-h-14 border-t-2 px-1 text-xs transition-colors ${
      activeView === view && !(view === 'journal' && writeActive)
        ? dark
          ? 'border-journal-accent-bright font-semibold text-journal-accent-bright'
          : 'border-accent-primary font-semibold text-accent-primary'
        : dark
          ? 'border-transparent font-medium text-journal-ink-muted'
          : 'border-transparent font-medium text-text-secondary'
    }`;

  return (
    <>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-sm ${dark ? 'border-journal-border bg-journal-bg/95' : 'border-border bg-surface/95'}`}>
        <div className="mx-auto flex h-16 w-full max-w-shell items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem] lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={
                dark
                  ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-journal-border bg-journal-panel text-journal-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                  : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-text-primary text-surface-subtle shadow-xs'
              }
            >
              <SignalMark />
            </div>
            <div className="min-w-0">
              <h1 className={`truncate font-serif text-lg font-semibold tracking-tight sm:text-xl ${dark ? 'text-journal-ink' : 'text-text-primary'}`}>
                Reading the Signals
              </h1>
              {!user && <p className="hidden text-xs text-text-muted sm:block">Private reflection journal</p>}
            </div>
          </div>

          {user && (
            <>
              <nav aria-label="Primary" className="hidden items-stretch gap-1 self-stretch md:flex">
                <button type="button" aria-pressed={activeView === 'journal' && !writeActive} onClick={() => onNavigate('journal')} className={navButtonClass('journal')}>
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
                    aria-current={writeActive ? 'page' : undefined}
                    className={
                      dark
                        ? 'inline-flex min-h-10 items-center gap-2 rounded-control border border-journal-border bg-journal-panel px-4 text-sm font-semibold text-journal-ink shadow-xs transition-[background-color,border-color,transform] hover:bg-journal-panel-2 active:scale-[0.97]'
                        : 'inline-flex min-h-10 items-center gap-2 rounded-control bg-accent-primary px-4 text-sm font-semibold text-white shadow-xs transition-[background-color,transform] hover:bg-accent-primary-hover active:scale-[0.97]'
                    }
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    Write
                  </button>
                </div>
              </nav>

              <div className="hidden items-center gap-3 md:flex">
                <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${dark ? 'text-journal-ink-muted' : 'text-text-muted'}`}>
                  <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" />
                  Private to you
                </span>
                <details className="group relative">
                  <summary
                    className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control border px-2.5 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden ${
                      dark
                        ? 'border-journal-border bg-journal-panel text-journal-ink-muted hover:bg-journal-bg hover:text-journal-ink'
                        : 'border-border bg-surface text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                    }`}
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    )}
                    <span className="max-w-28 truncate">{accountName(user)}</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className={`absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-card border p-3 shadow-dialog ${dark ? 'border-journal-border bg-journal-panel' : 'border-border bg-surface'}`}>
                    <p className={`text-sm font-semibold ${dark ? 'text-journal-ink' : 'text-text-primary'}`}>Account</p>
                    <p className={`mt-0.5 truncate text-xs ${dark ? 'text-journal-ink-muted' : 'text-text-muted'}`}>{user.email || 'Guest session'}</p>
                    <button
                      id="sign-out-button"
                      type="button"
                      onClick={onSignOut}
                      className={`mt-3 inline-flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-sm font-medium transition-colors ${
                        dark ? 'text-journal-ink-muted hover:bg-journal-bg hover:text-journal-ink' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                      }`}
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                </details>
              </div>

              <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs md:hidden ${dark ? 'text-journal-ink-muted' : 'text-text-muted'}`} title="Private to you">
                <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" />
                <span className="sr-only">Private to you</span>
                <span aria-hidden="true" className="hidden min-[420px]:inline">Private to you</span>
              </span>
            </>
          )}
        </div>
      </header>

      {user && (
        <nav
          aria-label="Primary mobile"
          className={`fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(41,39,34,0.08)] md:hidden ${
            dark ? 'border-journal-border bg-journal-bg/98' : 'border-border bg-surface/98'
          }`}
        >
          <div className="mx-auto grid max-w-lg grid-cols-4 px-2">
            <button type="button" aria-pressed={activeView === 'journal' && !writeActive} onClick={() => onNavigate('journal')} className={mobileNavButtonClass('journal')}>
              <span className="flex flex-col items-center justify-center gap-1"><BookOpenText className="h-5 w-5" aria-hidden="true" />Journal</span>
            </button>
            <button
              type="button"
              onClick={onNewEntry}
              aria-current={writeActive ? 'page' : undefined}
              className={`min-h-14 border-t-2 px-1 text-xs font-semibold ${dark ? 'border-journal-accent-bright text-journal-accent-bright' : 'border-accent-primary text-accent-primary'}`}
            >
              <span className="flex flex-col items-center justify-center gap-1"><PenLine className="h-5 w-5" aria-hidden="true" />Write</span>
            </button>
            <button type="button" aria-pressed={activeView === 'insights'} onClick={() => onNavigate('insights')} className={mobileNavButtonClass('insights')}>
              <span className="flex flex-col items-center justify-center gap-1"><Lightbulb className="h-5 w-5" aria-hidden="true" />Insights</span>
            </button>
            <details className="group relative">
              <summary
                className={`flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-1 border-t-2 border-transparent px-1 text-xs font-medium [&::-webkit-details-marker]:hidden ${
                  dark ? 'text-journal-ink-muted' : 'text-text-secondary'
                }`}
              >
                <UserRound className="h-5 w-5" aria-hidden="true" />
                Account
              </summary>
              <div className={`fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-3 w-[min(18rem,calc(100vw-1.5rem))] rounded-card border p-3 shadow-dialog ${dark ? 'border-journal-border bg-journal-panel' : 'border-border bg-surface'}`}>
                <p className={`truncate text-sm font-semibold ${dark ? 'text-journal-ink' : 'text-text-primary'}`}>{accountName(user)}</p>
                <p className={`mt-0.5 truncate text-xs ${dark ? 'text-journal-ink-muted' : 'text-text-muted'}`}>{user.email || 'Guest session'}</p>
                <p className={`mt-3 flex items-center gap-2 text-xs ${dark ? 'text-journal-ink-muted' : 'text-text-muted'}`}>
                  <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" />
                  Private to you
                </p>
                <button
                  type="button"
                  onClick={onSignOut}
                  className={`mt-3 inline-flex min-h-11 w-full items-center gap-2 rounded-control px-3 text-sm font-medium transition-colors ${
                    dark ? 'text-journal-ink-muted hover:bg-journal-bg hover:text-journal-ink' : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                  }`}
                >
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
