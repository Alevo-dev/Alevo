"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/** `nonce` lets next-themes' inline boot script run under the CSP. */
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemes
      attribute="class"
      nonce={nonce}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="alevo-admin-theme"
    >
      {children}
    </NextThemes>
  );
}
