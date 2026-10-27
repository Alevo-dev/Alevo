import type { Metadata } from "next";
import { PageHead, Section, Prose } from "@/components/landing/page-kit";
import { CookiePreferences } from "@/components/landing/cookie-banner";
import { legal } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "What cookies and similar storage getalevo.com and the Alevo app use, and how to control them.",
};

export default function CookiesPage() {
  return (
    <>
      <PageHead eyebrow="LEGAL" title="Cookie Policy" subtitle={`Last updated: ${legal.lastUpdated}`} />
      <Section style={{ paddingTop: 32 }}>
        <Prose>
          <p>This policy explains what cookies and similar browser storage getalevo.com and the Alevo app (app.getalevo.com) use, and how you can control them. It forms part of our <a href="/privacy">Privacy Policy</a>.</p>

          <h2>What we use</h2>
          <ul>
            <li><strong>Strictly necessary.</strong> The Alevo app uses session cookies set by our sign-in provider to keep you signed in and to protect against cross-site request forgery. The app cannot work without them.</li>
            <li><strong>Preferences.</strong> Both sites store your light or dark theme choice and, on this site, your cookie choice, in your browser&rsquo;s local storage. These never leave your device.</li>
            <li><strong>Analytics.</strong> We do not currently run analytics or advertising cookies. If we add privacy-respecting analytics in future, they will only run after you accept them in the cookie notice, and this page will be updated.</li>
          </ul>

          <h2>What we don&rsquo;t use</h2>
          <p>No advertising cookies, no cross-site tracking, no selling of browsing data.</p>

          <h2>Your choices</h2>
          <p>You can change your choice for optional cookies on this site at any time using the control below. You can also clear or block cookies in your browser settings. Blocking strictly necessary cookies will sign you out of the app.</p>
          <CookiePreferences />

          <h2>Contact</h2>
          <p>Questions about cookies? Email <a href={`mailto:${legal.email.privacy}`}>{legal.email.privacy}</a>.</p>
        </Prose>
      </Section>
    </>
  );
}
