// Minimal server-only Google Gemini client for the shop assistant.
//
// The API key lives in GEMINI_API_KEY and is read only here, on the server. It
// is never sent to the browser and never written to a log line (the key rides
// in the query string, so error text must never echo a URL).
//
// Model choice is deliberately defensive. Two things are true of this API:
//   * ListModels advertises models a given key CANNOT call -- a new key asking
//     for gemini-2.5-flash gets 404 "no longer available to new users";
//   * the newest models regularly answer 503 "experiencing high demand".
// So instead of trusting one name, we build an ordered candidate list (newest
// flash first) and fall through it at call time, caching whichever actually
// answers. GEMINI_MODEL pins one and skips all of that.
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 15_000;

/** Statuses that mean "this model is not usable right now" rather than "the
 *  request was bad" -- worth trying the next candidate. */
const TRY_NEXT_STATUSES = new Set([400, 404, 429, 503]);

let cachedModel: string | null = null;
let cachedCandidates: string[] | null = null;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export type ChatTurn = { role: "user" | "model"; text: string };

type ModelList = {
  models?: { name: string; supportedGenerationMethods?: string[] }[];
};

function versionOf(name: string): [number, number] {
  const match = /(\d+)\.(\d+)/.exec(name);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

/** Plain text-chat models only, newest version first. Image/audio/tts/embedding
 *  variants cannot answer a text question, and "preview" ones are unstable. */
async function listCandidates(key: string) {
  if (cachedCandidates) return cachedCandidates;

  const response = await fetch(`${ENDPOINT}/models?key=${encodeURIComponent(key)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Gemini model list failed (${response.status})`);
  }

  const data = (await response.json()) as ModelList;
  const usable = (data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => model.name.replace(/^models\//, ""))
    .filter(
      (name) =>
        name.startsWith("gemini-") &&
        !/vision|image|audio|tts|live|embedding|thinking|robotics|computer-use|transcribe|omni|research/.test(
          name
        )
    );

  const rank = (name: string) => {
    const [major, minor] = versionOf(name);
    // Prefer full "flash" over "flash-lite", and newer over older.
    return major * 1000 + minor * 10 + (name.includes("lite") ? 0 : 5);
  };

  const sorted = [...usable].sort((a, b) => rank(b) - rank(a));

  if (sorted.length === 0) throw new Error("No Gemini text model available for this API key.");

  cachedCandidates = sorted;
  return sorted;
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  promptFeedback?: { blockReason?: string };
};

async function callModel(
  key: string,
  model: string,
  systemPrompt: string,
  contents: { role: string; parts: { text: string }[] }[]
) {
  const response = await fetch(
    `${ENDPOINT}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
      }),
    }
  );

  if (!response.ok) {
    const error = new Error(`Gemini request failed (${response.status})`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as GenerateResponse;

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt (${data.promptFeedback.blockReason})`);
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Gemini returned an empty answer.");

  return text;
}

/**
 * Returns the model's plain-text answer, or throws. Callers fall back to the
 * built-in rules so the assistant never goes dead.
 *
 * `history` carries earlier turns of THIS conversation so follow-up questions
 * ("what about the cheaper one?") make sense.
 */
export async function generateShopAnswer({
  systemPrompt,
  question,
  history = [],
}: {
  systemPrompt: string;
  question: string;
  history?: ChatTurn[];
}) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");

  const contents = [
    ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    { role: "user", parts: [{ text: question }] },
  ];

  const pinned = process.env.GEMINI_MODEL?.trim();
  if (pinned) return callModel(key, pinned, systemPrompt, contents);

  // Whatever worked last time, then the rest newest-first.
  const candidates = await listCandidates(key);
  const ordered = cachedModel
    ? [cachedModel, ...candidates.filter((name) => name !== cachedModel)]
    : candidates;

  let lastError: unknown = null;

  for (const model of ordered.slice(0, 6)) {
    try {
      const answer = await callModel(key, model, systemPrompt, contents);
      cachedModel = model;
      return answer;
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;

      // A retired, overloaded or rate-limited model: try the next one. Anything
      // else (a blocked prompt, a network failure) is not model-specific.
      if (status && TRY_NEXT_STATUSES.has(status)) {
        if (cachedModel === model) cachedModel = null;
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No Gemini model could answer.");
}
