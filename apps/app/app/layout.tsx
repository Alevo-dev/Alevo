import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemedClerkProvider } from "@/components/clerk-provider";
import { AppToaster } from "@/components/app-toaster";
import "./globals.css";

// Design system: Space Grotesk sets headlines, Inter runs the product, and
// JetBrains Mono is for values read character by character (phones, times, IDs).
const fontDisplay = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});
const fontBody = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const fontData = JetBrains_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Alevo", template: "%s | Alevo" },
  description: "Alevo — AI SDR platform.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1224" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The proxy puts the CSP nonce on the request. Reading it makes every page render
  // per request, which a nonce requires (a prerendered page has no request to read).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontData.variable} h-full`}
    >
      <body className="min-h-full">
        {/* Theme first so Clerk's embedded UI can follow light/dark. */}
        <ThemeProvider nonce={nonce}>
          <ThemedClerkProvider nonce={nonce}>{children}</ThemedClerkProvider>
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
