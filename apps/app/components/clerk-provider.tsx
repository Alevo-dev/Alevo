"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useTheme } from "next-themes";

/** Clerk's embedded UI on the design-system palette, per resolved theme. */
const SHARED = {
  colorPrimary: "#2e9be6",
  colorDanger: "#ff6b6b",
  colorSuccess: "#2ed3a7",
  colorWarning: "#f6a723",
  borderRadius: "8px",
  fontFamily: "var(--font-body), system-ui, sans-serif",
};

const DARK = {
  ...SHARED,
  colorBackground: "#111b33",
  colorText: "#eef3fc",
  colorTextSecondary: "#9dacc9",
  colorInputBackground: "#0b1224",
  colorInputText: "#eef3fc",
  colorNeutral: "#eef3fc",
};

const LIGHT = {
  ...SHARED,
  colorDanger: "#c32a22",
  colorSuccess: "#0f7a5c",
  colorWarning: "#9a5b00",
  colorBackground: "#ffffff",
  colorText: "#0b1224",
  colorTextSecondary: "#515d80",
  colorInputBackground: "#f6f8fc",
  colorInputText: "#0b1224",
  colorNeutral: "#0b1224",
};

export function ThemedClerkProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  // Before hydration `resolvedTheme` is undefined; dark is the default ground.
  const variables = resolvedTheme === "light" ? LIGHT : DARK;
  return (
    <ClerkProvider
      appearance={{ variables }}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {children}
    </ClerkProvider>
  );
}
