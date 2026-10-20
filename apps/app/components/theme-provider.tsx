"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/**
 * Light / dark / system, persisted per browser. Dark is the brand's default
 * ground (design system). The storage key is versioned so the dark default
 * applies to browsers that saved a preference under the old key.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="alevo-theme-v2"
    >
      {children}
    </NextThemes>
  );
}
