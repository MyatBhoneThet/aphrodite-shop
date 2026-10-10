/**
 * Turns the QR code Supabase returns into something an <img> can always draw.
 *
 * Supabase sends the SVG as `data:image/svg+xml;utf-8,<svg ...>` with the
 * markup unescaped. Browsers are strict about that form (the `utf-8` is not a
 * valid `charset=` parameter, and characters like # or % inside the markup cut
 * the URL short), so the picture silently fails to load. Re-encoding the
 * markup avoids all of it.
 */
export function qrImageSrc(qrCode: string | null | undefined) {
  const value = (qrCode ?? "").trim();
  if (!value) return "";

  let markup = value;
  if (/^data:/i.test(value)) {
    const comma = value.indexOf(",");
    if (comma === -1) return "";
    const header = value.slice(0, comma);
    const body = value.slice(comma + 1);
    // Already base64: it is fine as it is, once the media type is explicit.
    if (/;base64$/i.test(header)) return `data:image/svg+xml;base64,${body}`;
    markup = body;
  }

  // Already percent-encoded markup (starts with %3C) -> decode, then encode once, cleanly.
  if (!markup.includes("<") && /%3C/i.test(markup)) {
    try {
      markup = decodeURIComponent(markup);
    } catch {
      return "";
    }
  }
  if (!markup.includes("<svg")) return "";

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
