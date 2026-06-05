import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "World Cup 2026 Sweepstake",
  description:
    "Predict the FIFA World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
  openGraph: {
    title: "World Cup 2026 Sweepstake",
    description:
      "Predict the FIFA World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup 2026 Sweepstake",
    description:
      "Predict the FIFA World Cup 2026 bracket. Pick your group standings and knockout winners before the deadline.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
