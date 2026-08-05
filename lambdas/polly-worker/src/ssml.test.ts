import { describe, it, expect } from "vitest";
import { buildSsml, countBillableChars, MAX_BILLABLE_CHARS } from "./ssml.js";

describe("SSML builder", () => {
  describe("buildSsml", () => {
    it("wraps text in speak tags", () => {
      const result = buildSsml("Hello world");
      expect(result).toContain("<speak>");
      expect(result).toContain("</speak>");
      expect(result).toContain("Hello world");
    });

    it("escapes XML special characters", () => {
      const result = buildSsml('Text with <tags> & "quotes"');
      expect(result).toContain("&lt;tags&gt;");
      expect(result).toContain("&amp;");
      expect(result).toContain("&quot;quotes&quot;");
    });

    it("adds prosody rate when specified", () => {
      const result = buildSsml("Hello", { prosodyRate: "slow" });
      expect(result).toContain('<prosody rate="slow">');
      expect(result).toContain("</prosody>");
    });

    it("does not add prosody when not specified", () => {
      const result = buildSsml("Hello");
      expect(result).not.toContain("prosody");
    });

    it("adds lexicon reference when useAwsLexicon is true", () => {
      const result = buildSsml("Hello", { useAwsLexicon: true });
      expect(result).toContain('<lexicon name="aws-service-names"/>');
    });

    it("does not add lexicon reference by default", () => {
      const result = buildSsml("Hello");
      expect(result).not.toContain("lexicon");
    });

    it("combines prosody and lexicon", () => {
      const result = buildSsml("Hello", { prosodyRate: "+10%", useAwsLexicon: true });
      expect(result).toContain('<prosody rate="+10%">');
      expect(result).toContain('<lexicon name="aws-service-names"/>');
    });
  });

  describe("countBillableChars", () => {
    it("counts all characters in plain text", () => {
      expect(countBillableChars("Hello")).toBe(5);
    });

    it("counts empty string as zero", () => {
      expect(countBillableChars("")).toBe(0);
    });

    it("counts unicode characters", () => {
      expect(countBillableChars("Hello")).toBe(5);
    });
  });

  describe("MAX_BILLABLE_CHARS", () => {
    it("is set to 3000", () => {
      expect(MAX_BILLABLE_CHARS).toBe(3000);
    });
  });
});
