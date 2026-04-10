"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "./actions";
import { AlertMessage } from "@/components/alert-message";

interface LoginFormProps {
  initialError: string | null;
  registered?: boolean;
  redirectUrl?: string;
}

export function LoginForm({ initialError, registered, redirectUrl }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(redirectUrl || "/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-amber-500">
            Karakas
          </Link>
          <h1 className="text-2xl font-semibold mt-4">Welcome back</h1>
          <p className="text-zinc-400 mt-2">Log in to track your games</p>
        </div>

        {registered && (
          <AlertMessage variant="success" className="mb-4">
            Account created successfully! Please log in.
          </AlertMessage>
        )}

        {error && (
          <AlertMessage variant="error" className="mb-4">
            {error}
          </AlertMessage>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="identifier"
              className="block text-sm font-medium text-zinc-300 mb-1"
            >
              Email or Username
            </label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              required
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-300"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-amber-500 hover:text-amber-400"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              id="password"
              name="password"
              required
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="text-center text-zinc-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-amber-500 hover:text-amber-400">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
