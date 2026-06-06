import type { Metadata } from "next";
import { Anton, Bebas_Neue, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: "World Cup 2026 Sweepstake",
  description:
    "Predict the World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
  openGraph: {
    title: "World Cup 2026 Sweepstake",
    description:
      "Predict the World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
    type: "website",
    locale: "en_US",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bebasNeue.variable} ${anton.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          forcedTheme="light"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
