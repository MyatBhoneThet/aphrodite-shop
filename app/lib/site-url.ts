/**
 * The address to put in links that customers click from their inbox.
 *
 * Deliberately separate from APP_URL, which the OAuth routes use. Those two
 * genuinely differ in development: a sign-in callback has to come back to
 * localhost (that is what is registered with Google and LINE), while a link
 * emailed to a customer has to be somewhere they can actually reach.
 *
 * That difference matters here because this shop's .env.local points at the
 * *production* database. Marking an order delivered from a laptop therefore
 * sends a real customer a real email -- and before this existed, one
 * containing http://localhost:3000, which is their own machine.
 *
 * So: set PUBLIC_SITE_URL to the live site in .env.local and leave APP_URL on
 * localhost. Unset, this falls back to APP_URL and nothing changes.
 */
export function publicSiteUrl(env: NodeJS.ProcessEnv = process.env) {
  const configured =
    env.PUBLIC_SITE_URL?.trim() ||
    env.APP_URL?.trim() ||
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  return configured.replace(/\/+$/, "");
}
