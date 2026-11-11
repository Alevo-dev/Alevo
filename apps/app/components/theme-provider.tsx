"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/**
 * Light / dark / system, persisted per browser. Dark is the brand's default
 * ground (design system). The storage key is versioned so the dark default
 * applies to browsers that saved a preference under the old key. `nonce` lets
 * next-themes' inline boot script run under the CSP.
 */
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemes
      attribute="class"
      nonce={nonce}
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="alevo-theme-v2"
    >
      {children}
    </NextThemes>
  );
}
