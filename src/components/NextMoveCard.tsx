import { NextMove } from '../lib/signals';

interface NextMoveCardProps {
  nextMove: NextMove;
}

export function NextMoveCard({ nextMove }: NextMoveCardProps) {
  return (
    <aside aria-labelledby="next-move-heading" className="mx-auto mt-8 max-w-reading rounded-feature border border-journal-border border-l-4 border-l-journal-accent bg-journal-panel-2 px-5 py-5 sm:px-6">
      <h3 id="next-move-heading" className="text-xs font-semibold uppercase tracking-wide text-journal-accent-bright">
        Your Next Move
      </h3>
      <p className="mt-3 font-serif text-lg leading-relaxed text-journal-ink">
        {nextMove.actionText}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-journal-ink-muted">
        Based on: “{nextMove.signalText}”
      </p>
    </aside>
  );
}
