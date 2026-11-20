import { authHeaders } from "@/app/lib/client-auth";
import { formatDateTime } from "@/app/lib/format";

type Authenticator = {
  id: string;
  status: string;
  friendly_name: string | null;
  created_at: string | null;
};

export type AuthenticatorStatus = { enrolled: boolean; factors: Authenticator[] };

export async function loadAuthenticatorStatus(signal?: AbortSignal): Promise<AuthenticatorStatus> {
  const response = await fetch("/api/auth/mfa/status", { headers: authHeaders(), cache: "no-store", signal });
  if (!response.ok) throw new Error("Could not load your authenticators. Refresh the page or sign in again.");
  const { enrolled, factors } = await response.json() as AuthenticatorStatus;
  return {
    enrolled,
    factors: factors
      .filter(factor => factor.status === "verified")
      .sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? "")),
  };
}

export default function AuthenticatorSelect({ factors, value, onChange, disabled }: {
  factors: Authenticator[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  if (factors.length < 2) return null;

  return (
    <label className="mt-4 block text-sm font-semibold">
      Authenticator
      <select
        value={value}
        required
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        className="mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-sm"
      >
        <option value="">Choose the authenticator generating your code</option>
        {factors.map((factor, index) => (
          <option key={factor.id} value={factor.id}>
            {factor.friendly_name || (factor.created_at ? `Added ${formatDateTime(factor.created_at)}` : `Authenticator ${index + 1}`)}
            {index === 0 && factor.created_at ? " (newest)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
