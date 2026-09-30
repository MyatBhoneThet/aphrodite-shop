import { connection } from "next/server";
import { enabledSocialProviders } from "../lib/social-login";
import RegisterForm from "./RegisterForm";

/**
 * The server half of /register, for the same reason as /login: only the
 * social buttons this deployment can actually serve are drawn, and
 * `connection()` keeps that decision at request time rather than baking it
 * into the standalone build. See app/login/page.tsx.
 */
export default async function RegisterPage() {
  await connection();

  return <RegisterForm providers={enabledSocialProviders()} />;
}
