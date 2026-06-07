"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";

function LoginContent() {
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const params = useParams();
  const searchParams = useSearchParams();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    const from = searchParams.get("from");
    const locale = params?.locale as string | undefined;

    let callbackURL = "/bets";
    if (from) {
      const path = from.startsWith("/") ? from : `/${from}`;
      if (locale === "es") {
        callbackURL =
          path.startsWith("/es/") || path === "/es" ? path : `/es${path}`;
      } else {
        callbackURL = path;
      }
    } else {
      callbackURL = locale === "es" ? "/es/bets" : "/bets";
    }

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="relative w-full max-w-[400px]">
        <div className="w-full rounded-none border border-hairline bg-canvas overflow-hidden dark:bg-ink">
          <div
            className="h-40 w-full bg-cover bg-center mix-blend-luminosity relative"
            style={{ backgroundImage: "url('/soccer_campaign_hero.png')" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-canvas to-transparent dark:from-ink" />
          </div>

          <div className="p-8 pt-0 flex flex-col items-center text-center">
            <h2 className="text-display-campaign text-4xl font-medium tracking-widest text-foreground">
              WORLD CUP 26
            </h2>
            <p className="mt-2 text-caption-md text-muted-foreground">
              {t("subtitle")}
            </p>

            <div className="mt-8 w-full space-y-4">
              {error && (
                <div className="rounded-lg border border-sale/30 bg-sale/5 p-3 text-caption-sm text-sale text-left">
                  ⚠️ {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="button-primary w-full gap-3 px-4 py-3 text-sm font-semibold whitespace-nowrap"
              >
                {loading ? (
                  <svg
                    className="h-5 w-5 animate-spin text-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-label={t("loadingLabel")}
                  >
                    <title>{t("loadingLabel")}</title>
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
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                <span>
                  {loading ? t("redirectingToGoogle") : t("signInWithGoogle")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
