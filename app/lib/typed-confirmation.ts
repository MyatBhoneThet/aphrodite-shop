import { z } from "zod";
import { badRequest } from "./errors";

/**
 * "Type DELETE to confirm", checked on the server as well as in the dialog.
 *
 * The admin dialog already makes a person type the word, but a dialog only
 * protects the screen: a stale tab, a script or a mis-built request would walk
 * straight past it. Routes that destroy or move money therefore ask for the
 * word again in the request itself and refuse without it.
 */

/** Typing "delete" or " DELETE " both count: the point is to slow down, not to catch typos. */
export function matchesConfirmText(typed: string, required: string) {
  return typed.trim().toLowerCase() === required.trim().toLowerCase();
}

/** For zod request schemas: the field must hold exactly the confirmation word. */
export function typedConfirmation(word: string) {
  const message = `Type ${word} to confirm.`;
  return z
    .string({ error: message })
    .refine((value) => matchesConfirmText(value, word), { error: message });
}

/** For routes whose request has a body (DELETE, PUT): reads `{ confirm }` and refuses without the word. */
export async function requireTypedConfirmation(request: Request, word: string) {
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  assertTypedConfirmation(body?.confirm, word);
}

export function assertTypedConfirmation(value: unknown, word: string) {
  if (typeof value !== "string" || !matchesConfirmText(value, word)) {
    throw badRequest(`Type ${word} to confirm.`);
  }
}
