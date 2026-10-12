/**
 * What /api/health reports.
 *
 * Two depths, because they answer different questions:
 *
 *  - plain `/api/health` -- "is this server up and configured?" Cheap and has
 *    no outside dependency, which is what a container health check must be:
 *    a database blip should never get the whole server restarted.
 *  - `/api/health?deep=1` -- "can customers actually use the shop?" Also does
 *    one tiny read from the database. This is the one an uptime alert watches.
 *
 * Only booleans leave this module; error text and keys never do.
 */
export type HealthReport = {
  ok: boolean;
  status: "ok" | "unavailable";
  checks: {
    config: boolean;
    /** Present only for a deep check. */
    database?: boolean;
  };
};

export async function checkHealth(options: {
  deep: boolean;
  configured: boolean;
  /** Resolves when the database answered; rejects (or never resolves) when it did not. */
  pingDatabase: () => Promise<unknown>;
  timeoutMs?: number;
}): Promise<HealthReport> {
  const checks: HealthReport["checks"] = { config: options.configured };

  if (options.deep && options.configured) {
    const timeoutMs = options.timeoutMs ?? 5_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        options.pingDatabase(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
      checks.database = true;
    } catch {
      checks.database = false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const ok = checks.config && checks.database !== false;
  return { ok, status: ok ? "ok" : "unavailable", checks };
}
