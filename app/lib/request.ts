import { badRequest, payloadTooLarge, unsupportedMediaType } from "./errors";

export const MAX_JSON_BODY_BYTES = 64 * 1024;

function isJsonContentType(value: string | null) {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

/**
 * Reads at most MAX_JSON_BODY_BYTES from a request before parsing it. Checking
 * Content-Length alone is insufficient because chunked requests may omit it.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw unsupportedMediaType();
  }

  const declaredLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw payloadTooLarge();
  }

  if (!request.body) {
    throw badRequest("A JSON request body is required.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;

    if (totalBytes > MAX_JSON_BODY_BYTES) {
      await reader.cancel();
      throw payloadTooLarge();
    }

    chunks.push(value);
  }

  if (totalBytes === 0) {
    throw badRequest("A JSON request body is required.");
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw badRequest("The request body must contain valid JSON.");
  }
}
