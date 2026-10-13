/**
 * "Are you sure?" for risky admin actions.
 *
 * `confirmAction()` opens the dialog mounted once on the admin page
 * (ConfirmDialogHost) and resolves to true only when the admin confirms. For
 * the most damaging actions the admin must also type a word such as DELETE, so
 * a stray click or a tap on the wrong row cannot destroy anything.
 *
 * Same shape as reauth.ts: a module-level opener the host registers, so hooks
 * and plain functions can ask without threading a dialog through their props.
 */
import { matchesConfirmText } from "../lib/typed-confirmation";

export type ConfirmOptions = {
  title: string;
  /** One sentence saying what is about to happen. */
  message?: string;
  /** The thing being acted on (a product name, an email), shown in its own box. */
  subject?: string;
  /** What else this does. One short line each. */
  consequences?: string[];
  confirmLabel?: string;
  /** "danger" is red and final; "caution" is amber for things that notify people. */
  tone?: "danger" | "caution";
  /** The admin must type this word before the confirm button works. */
  requireText?: string;
};

type Opener = (options: ConfirmOptions) => Promise<boolean>;

let opener: Opener | null = null;

export function registerConfirmOpener(next: Opener | null) {
  opener = next;
}

// One rule for the dialog and the server (see app/lib/typed-confirmation.ts).
export { matchesConfirmText };

export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (opener) return opener(options);

  // The dialog is not mounted (another page, or a test). Fall back to the
  // browser's own prompts so a dangerous action is never silently allowed.
  if (typeof window === "undefined") return false;
  const text = [options.title, options.subject, options.message, ...(options.consequences ?? [])]
    .filter(Boolean)
    .join("\n");
  if (options.requireText) {
    const typed = window.prompt(`${text}\n\nType ${options.requireText} to confirm.`);
    return typed !== null && matchesConfirmText(typed, options.requireText);
  }
  return window.confirm(text);
}
