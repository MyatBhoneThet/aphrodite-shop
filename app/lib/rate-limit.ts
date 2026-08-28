import type { NextRequest } from "next/server";

// In-memory fixed-window rate limiter. Good enough for a single Node.js
// server process; on a multi-instance / serverless deployment (e.g. Vercel
// with multiple lambdas) each instance keeps its own counters, so the
// effective limit is (limit x instance count). For a hard guarantee under
// horizontal scaling, back this with a shared store (Upstash Redis, etc.)
// instead of the in-memory Map below.
const WINDOW_MS = 60_000;
const LIMITS: Record<string, number> = {
  login: 10,
  register: 5,
  "admin-login": 8,
  chat: 30,
};

// Prevent attacker-controlled IP/header values from growing this process map
// without bound. This is defense in depth only; production replicas still need
// a shared limiter behind a reverse proxy that overwrites forwarding headers.
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = WINDOW_MS;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0]?.trim() || "unknown").slice(0, 128);
}

function sweepExpiredBuckets(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  lastSweepAt = now;
}

export function checkRateLimit(
  request: NextRequest,
  scope: string
): { allowed: boolean; remaining: number } {
  const limit = LIMITS[scope] ?? 20;
  const key = `${scope}:${clientIp(request)}`;
  const now = Date.now();
  sweepExpiredBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      return { allowed: false, remaining: 0 };
    }

    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}
