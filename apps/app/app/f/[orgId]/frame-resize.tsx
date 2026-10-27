"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Iframe mode (`?embed=1`): tell the parent page how tall the form is, so the
 * iframe can grow with the thank-you state and error messages, and follow the
 * `theme` the snippet asked for. Height is the only thing posted.
 */
export function FrameResize({ theme }: { theme?: "light" | "dark" }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    if (theme) setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    if (window.parent === window) return;
    const post = () => window.parent.postMessage({ type: "alevo:resize", height: document.documentElement.scrollHeight }, "*");
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    post();
    return () => observer.disconnect();
  }, []);

  return null;
}
