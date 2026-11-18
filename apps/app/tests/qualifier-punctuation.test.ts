import { describe, expect, it } from "vitest";
import { plainPunctuation } from "../lib/qualifier/punctuation";

describe("plainPunctuation: no long dashes in what the agent sends", () => {
  it("turns a dash before a new sentence into a full stop", () => {
    expect(plainPunctuation("Good fit — Alevo is built for MSPs.")).toBe("Good fit. Alevo is built for MSPs.");
  });

  it("turns a dash before more of the same sentence into a comma", () => {
    expect(plainPunctuation("We answer every lead — chat, forms and calls — instantly.")).toBe(
      "We answer every lead, chat, forms and calls, instantly.",
    );
  });

  it("handles en dashes and spaced hyphens the same way", () => {
    expect(plainPunctuation("Sounds good – I can do Thursday.")).toBe("Sounds good. I can do Thursday.");
    expect(plainPunctuation("Sounds good - I can do Thursday.")).toBe("Sounds good. I can do Thursday.");
  });

  it("writes a range with a dash as 'to'", () => {
    expect(plainPunctuation("Open 9am–12pm.")).toBe("Open 9am to 12pm.");
  });

  it("leaves ordinary hyphens alone", () => {
    expect(plainPunctuation("A follow-up email, 24/7, no-show rates.")).toBe("A follow-up email, 24/7, no-show rates.");
  });

  it("drops a dash that ends the message", () => {
    expect(plainPunctuation("Talk soon —")).toBe("Talk soon");
  });

  it("changes nothing when there is no dash", () => {
    expect(plainPunctuation("Thanks, Leo. Talk soon!")).toBe("Thanks, Leo. Talk soon!");
  });
});
