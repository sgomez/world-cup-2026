"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: sessionState, isPending } = authClient.useSession();
  const user = sessionState?.user;

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.reload();
        },
      },
    });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 text-slate-100 sm:px-6 lg:px-8">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-600/10 blur-[100px]" />
      <div className="absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[100px]" />

      <div className="relative w-full max-w-2xl text-center">
        {isPending ? (
          /* Sleek Loading Shimmer */
          <div className="mx-auto max-w-md animate-pulse space-y-6 rounded-2xl border border-white/5 bg-slate-900/40 p-8 backdrop-blur-xl">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-800" />
            <div className="h-6 rounded bg-slate-800" />
            <div className="h-4 rounded bg-slate-800" />
            <div className="h-10 rounded bg-slate-800" />
          </div>
        ) : user ? (
          /* Authenticated Dashboard View */
          <div className="mx-auto rounded-2xl border border-white/5 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-white/10">
            <div className="flex flex-col items-center">
              {/* biome-ignore lint/performance/noImgElement: avatar URLs from OAuth providers can be from any external domain */}
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-20 w-20 rounded-full border-2 border-emerald-500/20 object-cover shadow-lg"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-3xl shadow-lg shadow-emerald-500/10">
                  ⚽
                </span>
              )}

              <div className="mt-6">
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                  Active Session
                </span>
              </div>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
                Welcome back, {user.name || "User"}!
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                You are successfully logged in via Magic Link.
              </p>

              {/* User details card */}
              <div className="mt-8 w-full max-w-sm rounded-xl bg-slate-950/50 p-5 text-left border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 uppercase tracking-wider font-semibold">
                    User ID
                  </span>
                  <span className="font-mono text-slate-400 select-all max-w-[200px] truncate">
                    {user.id}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 uppercase tracking-wider font-semibold">
                    Email
                  </span>
                  <span className="text-slate-300 font-medium">
                    {user.email}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 uppercase tracking-wider font-semibold">
                    Status
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    Verified ✓
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/5 py-3 px-6 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] border border-white/10"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Landing Hero / Guest View */
          <div className="space-y-8 py-12">
            <div className="flex flex-col items-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-4xl shadow-xl shadow-indigo-500/20 animate-pulse">
                🏆
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                World Cup 2026
              </h1>
              <p className="mx-auto max-w-xl text-lg text-slate-400 leading-relaxed">
                A modern platform to predict matches, follow statistics, and
                experience the greatest tournament on Earth. Securely sign in to
                save your progress.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link
                href="/login"
                className="flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:from-violet-500 hover:to-indigo-500 hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
              </Link>
              <a
                href="https://github.com/better-auth/better-auth"
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-semibold text-slate-300 border border-white/10 transition-all duration-200 hover:bg-slate-800 hover:text-white"
              >
                Powered by Better Auth
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
