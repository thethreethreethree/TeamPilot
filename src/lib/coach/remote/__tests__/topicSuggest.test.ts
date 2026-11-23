import { describe, it, expect } from "vitest";
import { candidates, parseSuggestions } from "../topicSuggest";

describe("topic-group suggestions", () => {
  it("only topics on 2+ calls and not already grouped are offered, most raised first", () => {
    expect(candidates([{ name: "once", calls: 1 }, { name: "pricing", calls: 54 }, { name: "Price", calls: 9, groupId: "g" }, { name: "monthly price", calls: 10 }])).toEqual([
      { name: "pricing", calls: 54 },
      { name: "monthly price", calls: 10 },
    ]);
  });
  it("keeps only given labels, each once, at least two per group; bad JSON is null", () => {
    const given = [{ name: "pricing", calls: 5 }, { name: "monthly price", calls: 3 }, { name: "monthly bill", calls: 2 }, { name: "hbo", calls: 2 }];
    const raw = '```json\n{"groups":[{"name":"Price","members":["Pricing","monthly price","made up"]},{"name":"Bill","members":["pricing","monthly bill"]},{"name":"TV","members":["hbo"]}]}\n```';
    expect(parseSuggestions(raw, given)).toEqual([{ name: "Price", members: ["pricing", "monthly price"] }]);
    expect(parseSuggestions("not json", given)).toBeNull();
  });
});
