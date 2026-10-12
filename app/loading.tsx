/** Shown instantly while a page is being prepared, so a tap never feels dead. */
export default function Loading() {
  return (
    <main className="min-h-screen bg-white" aria-busy="true">
      <span className="sr-only" role="status">Loading…</span>
      <div className="border-b px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-100 sm:w-44" />
          <div className="h-10 w-24 animate-pulse rounded-full bg-zinc-100" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl bg-zinc-100 sm:h-64" />
          ))}
        </div>
      </div>
    </main>
  );
}
