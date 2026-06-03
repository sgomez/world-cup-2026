"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await authClient.signIn.magicLink({
        email,
        callbackURL: "/",
      });

      if (res.error) {
        setError(
          res.error.message || "Something went wrong. Please try again.",
        );
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      {/* Background glowing effects */}
      <div className="absolute top-0 -left-40 h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-0 -right-40 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Decorative elements */}
        <div className="absolute -top-6 -right-6 h-12 w-12 rounded-full bg-amber-500/20 blur-xl animate-pulse" />

        {/* Main Card */}
        <div className="w-full rounded-2xl border border-white/5 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/10">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-3xl shadow-lg shadow-amber-500/10 animate-bounce">
              🏆
            </span>
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">
              World Cup 2026
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in instantly via email magic link
            </p>
          </div>

          <div className="mt-8">
            {success ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <span className="inline-block text-2xl mb-2">✉️</span>
                <h3 className="font-semibold text-emerald-400">
                  Check your email
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  We sent a magic link to{" "}
                  <span className="font-medium text-white">{email}</span>. Click
                  the link to log in.
                </p>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="mt-4 text-xs font-semibold text-emerald-400 underline hover:text-emerald-300"
                >
                  Try a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    Email Address
                  </label>
                  <div className="mt-2">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 transition-all duration-200 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none text-sm"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
                    ⚠️ {error}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          role="img"
                          aria-label="Loading indicator"
                        >
                          <title>Loading</title>
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Sending link...
                      </div>
                    ) : (
                      "Send Magic Link"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
