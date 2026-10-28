// Accessibility scan (WCAG 2.2 AA + axe best practices) over the running dev
// servers, in light AND dark, plus a keyboard check: every focusable element must
// change visibly when it receives focus.
//
//   pnpm a11y                 public pages (marketing + sign-in + status screens), headless
//   pnpm a11y -- --app        signed-in app pages: a Chrome window opens on /sign-in, sign in
//                             yourself, the scan continues from /dashboard (add --all for
//                             the public pages in the same run). The session is kept in
//                             .a11y-profile/ (git-ignored), so you sign in once.
//   pnpm a11y -- --out x.json write the full report
//   pnpm a11y -- --only /features   scan the URLs containing that text only
//
// Uses the installed Google Chrome (no browser download). Exit code 1 when any
// serious / critical violation is found.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { existsSync, writeFileSync } from "node:fs";

const WEB = "http://localhost:3000";
const APP = "http://localhost:3001";
const PUBLIC = [
  ...["/", "/features", "/pricing", "/about", "/contact", "/security", "/privacy", "/terms", "/refunds", "/cookies", "/no-such-page"].map((p) => WEB + p),
  ...["/sign-in", "/sign-up", "/no-such-page"].map((p) => APP + p),
];
const SIGNED_IN = ["/dashboard", "/conversations", "/meetings", "/workspace/profile", "/workspace/agent", "/workspace/knowledge", "/workspace/integrations"].map((p) => APP + p);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const args = process.argv.slice(2);
const withApp = args.includes("--app");
const publicToo = !withApp || args.includes("--all");
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const onlyIdx = args.indexOf("--only"); // --only <substring>: scan matching URLs only
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const pick = (urls) => (only ? urls.filter((u) => u.includes(only)) : urls);

const report = [];
const browser = await chromium.launch({ channel: "chrome", headless: !withApp });

async function scan(context, url, scheme) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(600); // let entrance animations settle
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const focus = await keyboardCheck(page);
    report.push({
      url,
      scheme,
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 200), message: (n.any[0] ?? n.all[0] ?? n.none[0])?.message ?? "" })),
      })),
      contrastUnknown: results.incomplete.find((i) => i.id === "color-contrast")?.nodes.length ?? 0,
      noFocusRing: focus,
    });
  } catch (err) {
    report.push({ url, scheme, error: String(err) });
  } finally {
    await page.close();
  }
}

/** Focus each tabbable element and compare its box to the unfocused one. */
async function keyboardCheck(page) {
  return page.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const els = [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.disabled;
    });
    const snap = (el) => {
      const s = getComputedStyle(el);
      return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color, s.textDecorationLine].join("|");
    };
    const bad = [];
    for (const el of els.slice(0, 80)) {
      const before = snap(el);
      el.focus({ preventScroll: true, focusVisible: true });
      if (document.activeElement !== el) continue;
      // Match :focus-visible by adding the pseudo-class state via a temporary rule is not possible;
      // Chrome applies :focus-visible on programmatic focus after keyboard interaction, so simulate a key first.
      const after = snap(el);
      el.blur();
      if (before === after) bad.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`);
    }
    return bad;
  });
}

for (const scheme of publicToo ? ["light", "dark"] : []) {
  const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
  // Tell Chrome a keyboard was used so programmatic focus() shows :focus-visible.
  const p = await context.newPage();
  await p.goto(PUBLIC[0]);
  await p.keyboard.press("Tab");
  await p.close();
  for (const url of pick(PUBLIC)) await scan(context, url, scheme);
  await context.close();
}

if (withApp) {
  // A persistent profile keeps the Clerk session between runs: sign in once.
  const context = await chromium.launchPersistentContext(".a11y-profile", {
    channel: "chrome",
    headless: false,
    colorScheme: "dark",
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(APP + "/dashboard");
  if (!/\/(dashboard|conversations)/.test(page.url())) {
    console.log(`\nA Chrome window is open on ${page.url()}. Sign in; the scan continues once the app lets you in (waits up to 15 minutes).`);
    page.on("framenavigated", (f) => f === page.mainFrame() && console.log("  →", f.url()));
    await page.waitForURL((u) => u.origin === APP && !/\/(sign-in|sign-up|onboarding|sso-callback)/.test(u.pathname), { timeout: 900_000 });
    console.log("Signed in at", page.url());
  }
  await page.keyboard.press("Tab");
  await page.close();
  for (const scheme of ["dark", "light"]) {
    await context.addInitScript((s) => localStorage.setItem("alevo-theme", s), scheme);
    for (const url of pick(SIGNED_IN)) await scan(context, url, scheme);
  }
  await context.close();
}

await browser.close();

// Summary: one line per (rule, page) with the count, worst first.
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
let worst = 9;
for (const r of report) {
  if (r.error) {
    console.log(`\n${r.url} [${r.scheme}]  ERROR ${r.error.split("\n")[0]}`);
    continue;
  }
  const v = r.violations.sort((a, b) => order[a.impact] - order[b.impact]);
  console.log(`\n${r.url} [${r.scheme}]  ${v.length} rule(s) failing, ${r.contrastUnknown} contrast unknown, ${r.noFocusRing.length} without focus ring`);
  for (const x of v) {
    worst = Math.min(worst, order[x.impact]);
    console.log(`  ${x.impact.padEnd(8)} ${x.id} ×${x.nodes.length} — ${x.help}`);
    for (const n of x.nodes.slice(0, 3)) console.log(`           ${n.target}  ${n.message}`);
  }
  for (const f of r.noFocusRing.slice(0, 5)) console.log(`  focus    ${f}`);
}
if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));
process.exit(worst <= 1 ? 1 : 0);
