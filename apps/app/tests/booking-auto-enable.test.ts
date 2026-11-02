import { describe, expect, it } from "vitest";
import { newlyConnectedTool } from "../lib/booking/connected";

describe("newlyConnectedTool: when booking turns on by itself", () => {
  it("picks the tool that just became connected when none is chosen", () => {
    expect(newlyConnectedTool(null, new Set(), ["google"])).toBe("google");
  });

  it("leaves a chosen tool alone", () => {
    expect(newlyConnectedTool("calcom", new Set(), ["calcom", "google"])).toBeNull();
  });

  it("does nothing when the tool was already connected (saving settings again must not undo turning booking off)", () => {
    expect(newlyConnectedTool(null, new Set(["calendly"]), ["calendly"])).toBeNull();
  });

  it("picks only the newly connected tool, not one that was already connected", () => {
    expect(newlyConnectedTool(null, new Set(["google"]), ["google", "calendly"])).toBe("calendly");
  });

  it("takes the first when two become connected at once, in the usual order", () => {
    expect(newlyConnectedTool(null, new Set(), ["calcom", "google"])).toBe("calcom");
  });

  it("does nothing when nothing is connected", () => {
    expect(newlyConnectedTool(null, new Set(), [])).toBeNull();
  });

  it("treats a stale non-tool value (e.g. 'manual') as nothing chosen", () => {
    expect(newlyConnectedTool("manual", new Set(), ["m365"])).toBe("m365");
  });
});
