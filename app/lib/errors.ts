import { NextResponse } from "next/server";

/**
 * Thrown deliberately by our own code for a condition the client should see
 * verbatim (e.g. "Product not found.", "Forbidden"). Anything that is NOT
 * an AppError (a raw Postgres/PostgREST/GoTrue error, a thrown non-Error,
 * an unexpected exception) is assumed unsafe to forward to the client and
 * gets logged server-side + replaced with a generic message instead.
 */
export class AppError extends Error {
  status: number;
  /** Machine-readable reason the browser can act on (e.g. ask for a code again). */
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

/** A risky admin action needs a freshly confirmed password or authenticator code. */
export function reauthRequired(message = "Please confirm it's you to continue.") {
  return new AppError(message, 403, "reauth_required");
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(message, 401);
}

export function forbidden(message = "Forbidden") {
  return new AppError(message, 403);
}

export function notFound(message = "Not found.") {
  return new AppError(message, 404);
}

export function badRequest(message: string) {
  return new AppError(message, 400);
}

export function conflict(message: string) {
  return new AppError(message, 409);
}

export function serviceUnavailable(message: string) {
  return new AppError(message, 503);
}

export function payloadTooLarge(message = "Request body is too large.") {
  return new AppError(message, 413);
}

export function unsupportedMediaType(message = "Content-Type must be application/json.") {
  return new AppError(message, 415);
}

export function handleRouteError(scope: string, error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      error.code ? { error: error.message, code: error.code } : { error: error.message },
      { status: error.status }
    );
  }

  console.error(`[${scope}] unexpected error`, error);

  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}
