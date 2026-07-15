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

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
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

export function handleRouteError(scope: string, error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(`[${scope}] unexpected error`, error);

  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}
