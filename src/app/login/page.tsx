import { Suspense } from "react";
import { LoginForm } from "./login-form";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_access_denied: "Access was denied. Please try again.",
  missing_params: "OAuth response was incomplete. Please try again.",
  invalid_state: "Security validation failed. Please try again.",
  invalid_provider: "Invalid authentication provider.",
  no_email:
    "Could not retrieve email from provider. Please ensure your account has a verified email.",
  oauth_failed: "Authentication failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const { error, redirect } = await searchParams;
  const initialError = error
    ? OAUTH_ERRORS[error] || "An error occurred. Please try again."
    : null;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-zinc-400">Loading...</div>
        </div>
      }
    >
      <LoginForm initialError={initialError} redirectUrl={redirect} />
    </Suspense>
  );
}
