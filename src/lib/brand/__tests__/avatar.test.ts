import { describe, expect, it } from "vitest";
import {
  avatarColorFor,
  avatarInitialsFor,
  avatarTextColorFor,
  isValidAvatarColor,
  isValidAvatarInitials,
  AVATAR_PALETTE,
} from "../avatar";

describe("avatarInitialsFor", () => {
  it("derives initials per the documented examples", () => {
    expect(avatarInitialsFor("Sarah Kim (CFO)")).toBe("SK"); // parenthetical stripped
    expect(avatarInitialsFor("John")).toBe("J");
    expect(avatarInitialsFor("Moses Maniquiz")).toBe("MM");
  });

  it("returns '?' for empty / nullish / whitespace names", () => {
    expect(avatarInitialsFor(undefined)).toBe("?");
    expect(avatarInitialsFor(null)).toBe("?");
    expect(avatarInitialsFor("")).toBe("?");
    expect(avatarInitialsFor("   ")).toBe("?");
    expect(avatarInitialsFor("(CEO)")).toBe("?"); // nothing left after stripping
  });

  it("caps at 2 characters and uppercases", () => {
    expect(avatarInitialsFor("alpha bravo charlie")).toBe("AB");
  });
});

describe("avatarColorFor", () => {
  it("is deterministic and prefers id over name", () => {
    const a = avatarColorFor("id-1", "Alice");
    expect(avatarColorFor("id-1", "Alice")).toBe(a); // stable
    expect(avatarColorFor("id-1", "DIFFERENT NAME")).toBe(a); // keyed on id
    expect(AVATAR_PALETTE).toContain(a); // always a palette color
  });

  it("falls back to name, then 'anon', without throwing", () => {
    expect(AVATAR_PALETTE).toContain(avatarColorFor(null, "Bob"));
    expect(AVATAR_PALETTE).toContain(avatarColorFor(null, ""));
  });
});

describe("avatarTextColorFor", () => {
  it("uses dark text on light backgrounds, light text on dark", () => {
    expect(avatarTextColorFor("#FFFFFF")).toBe("#09090B"); // white bg -> dark text
    expect(avatarTextColorFor("#000000")).toBe("#FAFAFA"); // black bg -> light text
  });

  it("falls back to dark text for malformed hex", () => {
    expect(avatarTextColorFor("nothex")).toBe("#09090B");
    expect(avatarTextColorFor("#FFF")).toBe("#09090B"); // wrong length
  });
});

describe("isValidAvatarColor", () => {
  it("accepts 6-digit hex, rejects everything else", () => {
    expect(isValidAvatarColor("#A1B2C3")).toBe(true);
    expect(isValidAvatarColor("  #a1b2c3  ")).toBe(true); // trimmed
    expect(isValidAvatarColor("#FFF")).toBe(false); // 3-digit
    expect(isValidAvatarColor("A1B2C3")).toBe(false); // missing #
    expect(isValidAvatarColor("#GGGGGG")).toBe(false); // non-hex
  });
});

describe("isValidAvatarInitials", () => {
  it("accepts 1-3 letters or digits, including international letters", () => {
    expect(isValidAvatarInitials("J")).toBe(true);
    expect(isValidAvatarInitials("SK")).toBe(true);
    expect(isValidAvatarInitials("J5")).toBe(true);
    expect(isValidAvatarInitials("ABC")).toBe(true);
    expect(isValidAvatarInitials("JÉ")).toBe(true); // accented — must still pass
    expect(isValidAvatarInitials("  MM  ")).toBe(true); // trimmed
  });

  it("rejects empty, too-long, symbols, and embedded whitespace", () => {
    expect(isValidAvatarInitials("")).toBe(false);
    expect(isValidAvatarInitials("ABCD")).toBe(false); // 4 chars
    expect(isValidAvatarInitials("@#")).toBe(false); // symbols (was wrongly accepted)
    expect(isValidAvatarInitials("a b")).toBe(false); // embedded space (was wrongly accepted)
    expect(isValidAvatarInitials("<>")).toBe(false);
  });
});
