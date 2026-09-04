import { RememberedSignal } from '../types';

export interface NextMove {
  signalId: string;
  signalText: string;
  actionText: string;
  sourceEntryId: string;
}

/**
 * Selects the newest valid remembered signal without mutating the source list.
 * Equal timestamps are resolved by lexicographically ascending signal ID.
 */
export function selectNextMove(rememberedSignals: RememberedSignal[]): NextMove | null {
  let selected: RememberedSignal | null = null;

  for (const signal of rememberedSignals) {
    const signalText = typeof signal.text === 'string' ? signal.text.trim() : '';
    const actionText = typeof signal.suggestedAction === 'string' ? signal.suggestedAction.trim() : '';

    if (!signalText || !actionText || !Number.isFinite(signal.createdAt)) continue;

    if (
      !selected ||
      signal.createdAt > selected.createdAt ||
      (signal.createdAt === selected.createdAt && signal.id < selected.id)
    ) {
      selected = signal;
    }
  }

  if (!selected) return null;

  return {
    signalId: selected.id,
    signalText: selected.text.trim(),
    actionText: selected.suggestedAction.trim(),
    sourceEntryId: selected.sourceEntryId,
  };
}
