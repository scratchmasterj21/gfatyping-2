import { createSignal } from "solid-js";

/**
 * Tracks which item id (if any) is mid-purchase in a shop. Purchases hit the
 * network (a Vercel function + Admin SDK write) and aren't instant, so
 * without this a student can double-click a buy button or click a different
 * item while the first purchase is still in flight.
 */
export function useBuyGuard(): {
  pendingId: () => string | null;
  guardedBuy: (id: string, buy: () => Promise<void>) => Promise<void>;
} {
  const [pendingId, setPendingId] = createSignal<string | null>(null);

  const guardedBuy = async (
    id: string,
    buy: () => Promise<void>,
  ): Promise<void> => {
    if (pendingId() !== null) return;
    setPendingId(id);
    try {
      await buy();
    } finally {
      setPendingId(null);
    }
  };

  return { pendingId, guardedBuy };
}
