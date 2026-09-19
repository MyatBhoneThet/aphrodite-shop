import nodemailer from "nodemailer";

/**
 * The shop's outgoing mail transport, independent of what is being sent.
 *
 * Split out of receipt-email.ts once a second kind of message (the password
 * reset link) needed the same account: the provider choice, credentials and
 * error handling belong to the transport, not to order receipts.
 *
 * Primary path: the shop's own Gmail account over Gmail's SMTP server, using
 * an App Password (GMAIL_USER + GMAIL_APP_PASSWORD in .env.local). Resend
 * remains as an optional fallback, but Resend can only send from a domain you
 * own and verify -- it cannot send "from" an @gmail.com address -- which is
 * why Gmail SMTP is the default here.
 *
 * Nothing in this module throws: a mail problem must never fail, block, or
 * undo whatever the caller was doing.
 */

export type MailContent = { subject: string; html: string; text: string };

export type MailResult =
  | { status: "sent"; sentAt: string }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

export type MailTransportConfig =
  | { provider: "gmail"; user: string; password: string; fromName: string }
  | { provider: "resend"; apiKey: string; from: string };

const DEFAULT_FROM_NAME = "Aphrodite Myanmar";

/** The configured mail provider, or null when none is set up. */
export function mailTransportConfig(
  env: NodeJS.ProcessEnv = process.env
): MailTransportConfig | null {
  const gmailUser = env.GMAIL_USER?.trim();
  // Google shows App Passwords in groups of four ("abcd efgh ijkl mnop"); the
  // spaces are display-only and must be removed before logging in.
  const gmailPassword = env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (gmailUser && gmailPassword) {
    return {
      provider: "gmail",
      user: gmailUser,
      password: gmailPassword,
      fromName: env.RECEIPT_FROM_NAME?.trim() || DEFAULT_FROM_NAME,
    };
  }

  if (env.RESEND_API_KEY && env.RECEIPT_FROM_EMAIL) {
    return {
      provider: "resend",
      apiKey: env.RESEND_API_KEY,
      from: env.RECEIPT_FROM_EMAIL,
    };
  }

  return null;
}

function describeMailError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : String(error);

  if (code === "EAUTH" || /invalid login|username and password not accepted/i.test(message)) {
    return "Gmail rejected the login. Check GMAIL_USER, and that GMAIL_APP_PASSWORD is a Google App Password (not the normal account password).";
  }

  return `Mail server error: ${message.slice(0, 300)}`;
}

async function sendWithGmail(
  config: Extract<MailTransportConfig, { provider: "gmail" }>,
  recipient: string,
  content: MailContent
): Promise<MailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    // Gmail only accepts mail "from" the account that logged in, so the
    // display name is configurable but the address is always GMAIL_USER.
    await transporter.sendMail({
      from: { name: config.fromName, address: config.user },
      to: recipient,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    return { status: "sent", sentAt: new Date().toISOString() };
  } catch (error) {
    return { status: "failed", error: describeMailError(error) };
  }
}

async function sendWithResend(
  config: Extract<MailTransportConfig, { provider: "resend" }>,
  recipient: string,
  content: MailContent,
  idempotencyKey: string
): Promise<MailResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [recipient],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        status: "failed",
        error: `Email provider returned ${response.status}: ${detail.slice(0, 300)}`,
      };
    }

    return { status: "sent", sentAt: new Date().toISOString() };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unable to send email.",
    };
  }
}

/** Sends one message through whichever provider is configured. Never throws. */
export async function sendMail(
  recipient: string,
  content: MailContent,
  options: { idempotencyKey?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<MailResult> {
  const env = options.env ?? process.env;
  const config = mailTransportConfig(env);

  if (!config || !recipient) return { status: "not_configured" };

  return config.provider === "gmail"
    ? sendWithGmail(config, recipient, content)
    : sendWithResend(
        config,
        recipient,
        content,
        // Resend drops a repeat of the same key, so a deliberate "send again"
        // needs its own.
        options.idempotencyKey ?? crypto.randomUUID()
      );
}
