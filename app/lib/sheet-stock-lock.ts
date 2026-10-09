/**
 * Makes everything that writes stock to both the Google Sheet and the database
 * take turns: the product sync (manual and automatic), checkout's sheet
 * write-back, cancelled-order restock and the admin stock form.
 *
 * Each of those writes one side plus the sync baseline. If a sync reads the
 * sheet between a checkout's sheet write and its baseline write, the sale is
 * subtracted twice. With an automatic sync every few minutes that overlap is no
 * longer rare, so they never run at the same time.
 *
 * The lock lives on globalThis because Next.js can load this module more than
 * once in one server (route bundles, instrumentation). It only covers one
 * server process.
 */

type LockState = { tail: Promise<void> };

const LOCK_KEY = "__aphroditeSheetStockLock";

function lockState(): LockState {
  const store = globalThis as typeof globalThis & { [LOCK_KEY]?: LockState };
  store[LOCK_KEY] ??= { tail: Promise.resolve() };
  return store[LOCK_KEY];
}

/** Runs `task` once no other sheet stock task is running. Errors pass through. */
export async function withSheetStockLock<T>(task: () => Promise<T>): Promise<T> {
  const state = lockState();
  const previous = state.tail;
  let release!: () => void;
  state.tail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}
