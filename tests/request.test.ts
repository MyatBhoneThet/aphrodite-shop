import { describe, expect, it } from "vitest";
import { MAX_JSON_BODY_BYTES, readJsonBody } from "../app/lib/request";

function jsonRequest(body: string, contentType = "application/json") {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
}

describe("bounded JSON request parsing", () => {
  it("accepts a valid JSON body", async () => {
    await expect(readJsonBody(jsonRequest('{"ok":true}'))).resolves.toEqual({
      ok: true,
    });
  });

  it("rejects malformed JSON", async () => {
    await expect(readJsonBody(jsonRequest("{"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects unsupported content types", async () => {
    await expect(
      readJsonBody(jsonRequest("ok=true", "application/x-www-form-urlencoded"))
    ).rejects.toMatchObject({ status: 415 });
  });

  it("rejects bodies beyond the configured limit", async () => {
    const body = JSON.stringify({ value: "x".repeat(MAX_JSON_BODY_BYTES) });

    await expect(readJsonBody(jsonRequest(body))).rejects.toMatchObject({
      status: 413,
    });
  });
});
