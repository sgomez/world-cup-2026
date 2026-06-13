"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";

const locales = {
  en: { flag: "🇬🇧", label: "EN" },
  es: { flag: "🇪🇸", label: "ES" },
} as const;

type Locale = keyof typeof locales;

export function LocaleToggle() {
  const rawLocale = useLocale();
  const locale: Locale = rawLocale in locales ? (rawLocale as Locale) : "en";
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");

  const nextLocale: Locale = locale === "en" ? "es" : "en";
  const current = locales[locale] ?? locales.en;

  return (
    <Button
      type="button"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      variant="secondary"
      size="sm"
      className="rounded-full w-auto px-3 gap-1 text-foreground"
      aria-label={t("switchLanguage")}
    >
      <span aria-hidden="true">{current.flag}</span>
      <span className="text-xs font-medium">{current.label}</span>
    </Button>
  );
}
