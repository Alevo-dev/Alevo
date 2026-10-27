/**
 * Inline script for documents that render without the app's ThemeProvider
 * (`global-error.tsx`): reads the theme next-themes saved under `storageKey`
 * (else the OS preference) and sets `.dark` on <html> before first paint, so
 * the tokens resolve to the right palette.
 */
export function themeBootScript(storageKey: string): string {
  const key = JSON.stringify(storageKey);
  return (
    `try{var t=localStorage.getItem(${key});` +
    `var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);` +
    `if(d)document.documentElement.classList.add("dark")}catch(e){}`
  );
}
