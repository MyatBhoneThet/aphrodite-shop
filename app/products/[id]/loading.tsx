/** Product page skeleton: same two-column shape as the real page, so nothing jumps. */
export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-white" aria-busy="true">
      <span className="sr-only" role="status">Loading product…</span>
      <div className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-5 sm:py-5">
          <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-100 sm:h-12 sm:w-44" />
          <div className="h-9 w-20 animate-pulse rounded-full bg-zinc-100" />
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:gap-10 sm:px-5 sm:py-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-100 sm:h-[480px] sm:rounded-3xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-14 w-14 animate-pulse rounded-xl bg-zinc-100 sm:h-20 sm:w-24" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
          <div className="h-9 w-4/5 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-10 w-48 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-100" />
          <div className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      </div>
    </main>
  );
}
