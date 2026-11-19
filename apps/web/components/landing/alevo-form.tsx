"use client";

import { useEffect, useRef } from "react";

import { embedConfig } from "@/lib/site";

// The same app and workspace as the chat widget (see embedConfig): local in dev, staging once deployed until launch.
const EMBED = { src: `${embedConfig.appOrigin}/embed.js`, org: embedConfig.orgId, company: embedConfig.company };

/**
 * The "send a note" form: Alevo's own embed, the same snippet a customer pastes into their site. The script reads its
 * own tag (`document.currentScript`), so it is added in an effect on every visit to the page. React's dev mode runs
 * an effect twice, and a removed script still runs, so `started` keeps it to one script (and one form).
 */
export function AlevoForm() {
  const host = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = host.current;
    if (!started.current) {
      started.current = true;
      document.querySelectorAll("script[data-alevo-embed]").forEach((s) => s.remove());
      const script = document.createElement("script");
      script.src = EMBED.src;
      script.async = true;
      script.setAttribute("data-alevo-embed", "");
      script.setAttribute("data-org", EMBED.org);
      script.setAttribute("data-target", "#alevo-form");
      script.setAttribute("data-company", EMBED.company);
      document.body.appendChild(script);
    }
    return () => {
      if (el) el.innerHTML = "";
    };
  }, []);
  return <div id="alevo-form" ref={host} />;
}
