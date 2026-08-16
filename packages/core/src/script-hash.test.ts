import { describe, it, expect } from "vitest";
import { computeScriptHash, hasScriptChanged } from "./script-hash.js";

describe("Script hash utilities", () => {
  describe("computeScriptHash", () => {
    it("returns a 64-character hex string (SHA-256)", () => {
      const hash = computeScriptHash("hello world");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns consistent hash for same input", () => {
      const hash1 = computeScriptHash("test script");
      const hash2 = computeScriptHash("test script");
      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different input", () => {
      const hash1 = computeScriptHash("script version 1");
      const hash2 = computeScriptHash("script version 2");
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty string", () => {
      const hash = computeScriptHash("");
      expect(hash).toHaveLength(64);
    });

    it("handles unicode text", () => {
      const hash = computeScriptHash("日本語テキスト");
      expect(hash).toHaveLength(64);
    });
  });

  describe("hasScriptChanged", () => {
    it("returns false when text matches hash", () => {
      const text = "unchanged script";
      const hash = computeScriptHash(text);
      expect(hasScriptChanged(text, hash)).toBe(false);
    });

    it("returns true when text differs from hash", () => {
      const originalHash = computeScriptHash("original text");
      expect(hasScriptChanged("modified text", originalHash)).toBe(true);
    });

    it("is sensitive to whitespace changes", () => {
      const hash = computeScriptHash("hello");
      expect(hasScriptChanged("hello ", hash)).toBe(true);
    });
  });
});
