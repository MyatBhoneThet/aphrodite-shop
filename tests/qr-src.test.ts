import { describe, expect, it } from "vitest";
import { qrImageSrc } from "../app/lib/qr-src";

const svg = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path fill="#000" d="M0 0h1v1H0z"/></svg>';
const decode = (src: string) => decodeURIComponent(src.slice(src.indexOf(",") + 1));

describe("QR code image source", () => {
  it("re-encodes Supabase's unescaped SVG (including # characters)", () => {
    const src = qrImageSrc(`data:image/svg+xml;utf-8,${svg}`);
    expect(src.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(src).not.toContain("<");
    expect(src).not.toContain("#000");
    expect(decode(src)).toBe(svg);
  });

  it("accepts bare markup and already-encoded markup", () => {
    expect(decode(qrImageSrc(svg))).toBe(svg);
    expect(decode(qrImageSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))).toBe(svg);
  });

  it("keeps base64 data and rejects junk", () => {
    expect(qrImageSrc("data:image/svg+xml;base64,AAAA")).toBe("data:image/svg+xml;base64,AAAA");
    expect(qrImageSrc("")).toBe("");
    expect(qrImageSrc(null)).toBe("");
    expect(qrImageSrc("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(qrImageSrc("https://evil.example/x.svg")).toBe("");
  });
});
