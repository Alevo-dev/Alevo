import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JUMP } from "../lib/jump";
import { SERVICE_GROUPS } from "../lib/integrations/services";

const read = (p: string) => readFileSync(new URL(`../app/(app)/workspace/${p}`, import.meta.url), "utf8");

/** A link that lands on a section only works while the section carries that id. */
describe("jump links between workspace pages", () => {
  const [integrations, agent] = [read("integrations/page.tsx"), read("agent/booking-ui.tsx") + read("agent/agent-ui.tsx")];

  it("every Integrations link lands on a section the page renders from SERVICE_GROUPS", () => {
    expect(integrations).toContain("id={group.id}");
    for (const href of [JUMP.integrationsBooking, JUMP.integrationsCommunication]) {
      expect(href.startsWith("/workspace/integrations#")).toBe(true);
      expect(SERVICE_GROUPS.map((g) => g.id)).toContain(href.split("#")[1]);
    }
  });

  it("the workspace layout flashes the section a jump lands on (:target does not update on client navigation)", () => {
    expect(read("layout.tsx")).toContain("<JumpHighlight");
  });

  it("every Agent link lands on a card that has that id", () => {
    for (const href of [JUMP.agentBooking, JUMP.agentChannels]) {
      expect(href.startsWith("/workspace/agent#")).toBe(true);
      expect(agent).toContain(`id="${href.split("#")[1]}"`);
    }
  });
});
