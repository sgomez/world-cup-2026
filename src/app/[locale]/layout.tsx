import type { Metadata } from "next";
import { Anton, Bebas_Neue, Inter, Oswald } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { routing } from "@/i18n/routing";
import "../globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ogLocale = locale === "es" ? "es_ES" : "en_US";
  return {
    metadataBase: new URL(APP_URL),
    title: "World Cup 2026 Sweepstake",
    description:
      "Predict the World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
    openGraph: {
      title: "World Cup 2026 Sweepstake",
      description:
        "Predict the World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
      type: "website",
      locale: ogLocale,
      siteName: "World Cup 2026 Sweepstake",
      url: "/",
      images: [
        {
          url: "/og_image.png",
          width: 1200,
          height: 630,
          alt: "World Cup 2026 Sweepstake Campaign Hero Image",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "World Cup 2026 Sweepstake",
      description:
        "Predict the World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
      images: [{ url: "/og_image.png", width: 1200, height: 630 }],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${bebasNeue.variable} ${anton.variable} ${oswald.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          forcedTheme="light"
        >
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
