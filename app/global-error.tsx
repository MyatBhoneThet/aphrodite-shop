"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
};

/**
 * Last resort: replaces the whole page when even the root layout fails, so it
 * cannot rely on the site's stylesheet or language provider. Inline styles and
 * both languages keep it readable on its own.
 */
export default function GlobalError({ error, retry, reset }: Props) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error.message);
  }, [error]);

  const again = retry ?? reset;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: "#18181b",
          background: "#fff",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p style={{ margin: 0, fontSize: 56, fontWeight: 900, color: "#dc2626" }}>Oops</p>
          <h1 style={{ margin: "12px 0 0", fontSize: 24 }}>Something went wrong</h1>
          <p style={{ margin: "8px 0 0", color: "#71717a", lineHeight: 1.6 }}>
            The shop could not load. Please try again in a moment.
          </p>
          <p style={{ margin: "8px 0 0", color: "#71717a", lineHeight: 1.8 }}>
            ဆိုင်ကို ဖွင့်၍မရပါ။ ခဏအကြာတွင် ထပ်မံကြိုးစားကြည့်ပါ။
          </p>
          {again && (
            <button
              type="button"
              onClick={again}
              style={{
                marginTop: 20,
                minHeight: 44,
                padding: "0 24px",
                border: 0,
                borderRadius: 999,
                background: "#dc2626",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Try again / ထပ်မံကြိုးစားရန်
            </button>
          )}
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 12, color: "#a1a1aa" }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
