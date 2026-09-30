import { Suspense } from "react";
import { connection } from "next/server";
import { enabledSocialProviders } from "../lib/social-login";
import LoginForm from "./LoginForm";

/**
 * The server half of /login. It exists only to work out which social sign-in
 * buttons this deployment can actually serve, so the form never shows a
 * button that would bounce straight back with "not set up on this store yet".
 *
 * `connection()` pins that decision to the request. Next.js 16 otherwise
 * folds `process.env` reads into the build, and this app ships as a prebuilt
 * standalone image (see Dockerfile) -- an image built before the LINE
 * credentials existed would go on hiding the LINE button however the running
 * container is configured.
 */
export default async function LoginPage() {
  await connection();

  return (
    <Suspense>
      <LoginForm providers={enabledSocialProviders()} />
    </Suspense>
  );
}
