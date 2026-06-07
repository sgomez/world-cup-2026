import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  const session = await getSession();

  return (
    <div className="relative w-full min-h-screen flex flex-col justify-between bg-ink text-canvas overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-65 mix-blend-luminosity"
        style={{ backgroundImage: "url('/soccer_campaign_hero.png')" }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />

      <header className="relative z-10 mx-auto w-full max-w-7xl px-6 py-6 flex items-center justify-between">
        <span className="font-display-campaign tracking-widest text-xl text-canvas select-none">
          WORLD CUP 26
        </span>
        {session ? (
          <Link
            href="/bets"
            className="button-outline-on-image !py-2 !px-6 !h-auto text-button-sm"
          >
            {t("goToDashboard")}
          </Link>
        ) : (
          <Link
            href="/login"
            className="button-outline-on-image !py-2 !px-6 !h-auto text-button-sm"
          >
            {t("signIn")}
          </Link>
        )}
      </header>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-24 md:py-36 flex flex-col items-start justify-end flex-grow gap-6">
        <h1 className="text-display-campaign text-6xl sm:text-8xl md:text-[90px] text-canvas leading-[0.9] font-medium uppercase max-w-2xl select-none">
          World Cup 2026
        </h1>
        <p className="text-body-md text-canvas/80 max-w-[448px] leading-relaxed font-normal">
          {t("subtitle")}
        </p>
        <div className="mt-4">
          {session ? (
            <Link href="/bets" className="button-outline-on-image">
              {t("viewMyPredictions")}
            </Link>
          ) : (
            <Link href="/login" className="button-outline-on-image">
              {t("enterTheBracket")}
            </Link>
          )}
        </div>
      </div>

      <footer className="relative z-10 mx-auto w-full max-w-7xl px-6 py-8 border-t border-canvas/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-canvas/50">
        <span className="text-caption-sm uppercase tracking-wider">
          {t("tagline")}
        </span>
        <span className="text-utility-xs">{t("copyright")}</span>
      </footer>
    </div>
  );
}
