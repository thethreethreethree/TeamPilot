import { describe, it, expect } from "vitest";
import { parseTeamCsv, planImport, splitCsv } from "../teamCsv";

const invitable = (r: string) => ["Member", "Lead", "CEO"].includes(r);

describe("splitCsv", () => {
  it("handles quotes, doubled quotes, commas inside quotes, CRLF, a BOM and blank lines", () => {
    expect(splitCsv('﻿email,role\r\n"a@x.com","Lead"\r\n\r\n"b,""q""@x.com",Member\n')).toEqual([
      ["email", "role"], ["a@x.com", "Lead"], ['b,"q"@x.com', "Member"],
    ]);
  });
});

describe("parseTeamCsv", () => {
  it("reads email, role and manager_email in any order and case", () => {
    const r = parseTeamCsv("Manager Email,EMAIL,Role\nboss@x.com,Ann@X.com,Lead\n,bob@x.com,\n", invitable);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { line: 2, email: "ann@x.com", role: "Lead", managerEmail: "boss@x.com" },
      { line: 3, email: "bob@x.com", role: null, managerEmail: null },
    ]);
  });
  it("reports every bad row by line, and an unknown column only as a warning", () => {
    const r = parseTeamCsv("email,role,manager_email,phone\nnot-an-email,,,1\na@x.com,Wizard,,\nb@x.com,,b@x.com,\nc@x.com,,,\nc@x.com,,,\n", invitable);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 6]);
    expect(r.warnings).toEqual(["Ignored column: phone."]);
  });
  it("needs an email column and refuses more than 200 people", () => {
    expect(parseTeamCsv("name\nAnn\n", invitable).errors[0]!.message).toMatch(/email/);
    expect(parseTeamCsv("email\n" + Array.from({ length: 201 }, (_, i) => `p${i}@x.com`).join("\n"), invitable).errors[0]!.message).toMatch(/200/);
  });
});

describe("planImport", () => {
  const accounts = new Map([["ann@x.com", ["u-ann"]], ["boss@x.com", ["u-boss"]], ["two@x.com", ["u-a", "u-b"]], ["gone@x.com", ["u-gone"]]]);
  const members = new Map([
    ["u-ann", { id: "u-ann", status: "active" }],
    ["u-boss", { id: "u-boss", status: "active" }],
    ["u-a", { id: "u-a", status: "active" }],
    ["u-b", { id: "u-b", status: "active" }],
    ["u-gone", { id: "u-gone", status: "removed" }],
  ]);
  it("members get their manager set now; new people are invited and get theirs after joining", () => {
    const plan = planImport([
      { line: 2, email: "ann@x.com", role: null, managerEmail: "boss@x.com" },
      { line: 3, email: "new@x.com", role: "Lead", managerEmail: "boss@x.com" },
      { line: 4, email: "pend@x.com", role: null, managerEmail: "new@x.com" },
      { line: 5, email: "ann2@x.com", role: null, managerEmail: "nobody@x.com" },
      { line: 6, email: "two@x.com", role: null, managerEmail: null },
      { line: 7, email: "gone@x.com", role: null, managerEmail: null },
    ], accounts, members, new Set(["pend@x.com"]));
    expect(plan.map((p) => [p.line, p.person, p.manager])).toEqual([
      [2, "member", "set"], [3, "invite", "on_join"], [4, "pending", "after_join"],
      [5, "invite", "not_found"], [6, "ambiguous", "none"], [7, "invite", "none"],
    ]);
    expect(plan[0]).toMatchObject({ personId: "u-ann", managerId: "u-boss" });
    expect(plan[1]).toMatchObject({ manager: "on_join", managerId: "u-boss" }); // carried on the invitation (0288)
  });
});
