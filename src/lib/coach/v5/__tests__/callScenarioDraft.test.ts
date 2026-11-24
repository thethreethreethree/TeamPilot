import { describe, it, expect } from "vitest";
import { buildCallScenarioSystemPrompt, buildCallScenarioUserMessage, parseCallScenarioDraft, stripPersonalDetails } from "../practiceScenario";

describe("scenario drafted from a call (F17.3)", () => {
  it("the prompt forbids personal details and invented objections", () => {
    const p = buildCallScenarioSystemPrompt();
    expect(p).toMatch(/no names of people or companies/);
    expect(p).toMatch(/never invent objections/);
  });
  it("labels each line by speaker", () => {
    expect(buildCallScenarioUserMessage([{ speaker: "agent", text: "Hi" }, { speaker: "customer", text: "Too pricey" }])).toContain("Rep: Hi\nCustomer: Too pricey");
  });
  it("strips emails, long numbers and links that slip through; keeps short numbers", () => {
    expect(stripPersonalDetails("Call 555-123-4567 or bob@acme.com, see https://x.io — has 2 quotes")).toBe("Call [removed] or [removed] see [removed] — has 2 quotes");
  });
  it("parses a complete draft; refuses one missing a field or not JSON", () => {
    expect(parseCallScenarioDraft('{"title":"The price-shopper","persona":"Busy owner","situation":"Wants the lowest price.","focus":"Price objection"}')).toEqual({ title: "The price-shopper", persona: "Busy owner", situation: "Wants the lowest price.", focus: "Price objection" });
    expect(parseCallScenarioDraft('{"title":"x","persona":"y","situation":"z"}')).toBeNull();
    expect(parseCallScenarioDraft("Sure! here it is")).toBeNull();
  });
});
