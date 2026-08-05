/**
 * Tests for prompt construction.
 */

import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";

describe("buildSystemPrompt", () => {
  it("returns a non-empty system prompt", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("mentions Marp format requirements", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Marp");
    expect(prompt).toContain("marp: true");
    expect(prompt).toContain("presenter notes");
  });

  it("specifies the 3000 character limit", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("3000");
  });

  it("describes importance levels", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("HIGH");
    expect(prompt).toContain("MEDIUM");
    expect(prompt).toContain("LOW");
  });

  it("specifies the metadata separator", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("---METADATA---");
  });
});

describe("buildUserPrompt", () => {
  it("includes theme and audience in the prompt", () => {
    const prompt = buildUserPrompt({
      theme: "AI in Healthcare",
      audience: "Medical professionals",
      durationMinutes: 5,
      urls: [],
    });

    expect(prompt).toContain("AI in Healthcare");
    expect(prompt).toContain("Medical professionals");
  });

  it("calculates approximate slide count from duration", () => {
    const prompt = buildUserPrompt({
      theme: "Testing",
      audience: "Developers",
      durationMinutes: 3,
      urls: [],
    });

    // 3 minutes = 180 seconds / 17.5 ~= 10 slides
    expect(prompt).not.toContain("5 minutes");
    expect(prompt).toContain("3 minutes");
  });

  it("includes URLs when provided", () => {
    const prompt = buildUserPrompt({
      theme: "Test",
      audience: "Test",
      durationMinutes: 2,
      urls: ["https://example.com/article1", "https://example.com/article2"],
    });

    expect(prompt).toContain("https://example.com/article1");
    expect(prompt).toContain("https://example.com/article2");
    expect(prompt).toContain("REFERENCE URLS");
  });

  it("does not include URL section when no URLs provided", () => {
    const prompt = buildUserPrompt({
      theme: "Test",
      audience: "Test",
      durationMinutes: 2,
      urls: [],
    });

    expect(prompt).not.toContain("REFERENCE URLS");
  });

  it("includes reference content when provided", () => {
    const prompt = buildUserPrompt({
      theme: "Test",
      audience: "Test",
      durationMinutes: 2,
      urls: [],
      referenceContent: "This is some reference content about the topic.",
    });

    expect(prompt).toContain("REFERENCE CONTENT");
    expect(prompt).toContain("This is some reference content about the topic.");
  });
});
