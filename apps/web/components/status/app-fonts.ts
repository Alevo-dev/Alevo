import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

/**
 * The product app's faces, loaded only by the status screens (404 / error) so
 * they look exactly like the app's. The site itself stays editorial (Fraunces +
 * Geist, set in app/layout.tsx); these classes override the same CSS variables
 * on the screen's own wrapper, so nothing else on the site changes.
 */
const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const body = Inter({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

export const appFontClass = `${display.variable} ${body.variable} ${mono.variable}`;
