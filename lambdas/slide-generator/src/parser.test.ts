/**
 * Tests for Marp output parser.
 */

import { describe, it, expect } from "vitest";
import { parseBedrockOutput, parseMarpMarkdown, extractPresenterNote } from "./parser.js";

const SAMPLE_MARP_OUTPUT = `---
marp: true
theme: default
paginate: true
---

# Introduction to AI

A brief overview of artificial intelligence

<!-- 
Welcome everyone. Today we will explore the fundamentals of AI
and how it is transforming industries.
-->

---

# Machine Learning Basics

- Supervised learning
- Unsupervised learning
- Reinforcement learning

<!--
Machine learning is a subset of AI that enables systems to learn from data.
Let me walk you through the three main types.
-->

---

# Deep Learning

Neural networks with multiple layers

<!--
Deep learning takes machine learning further with multi-layered neural networks.
-->

---METADATA---

[
  {
    "slideNumber": 1,
    "keyPoints": ["AI overview and industry transformation"],
    "importance": "HIGH",
    "teaserNote": "AI is transforming every industry",
    "includeInXTeaser": true
  },
  {
    "slideNumber": 2,
    "keyPoints": ["Three types of machine learning"],
    "importance": "HIGH",
    "teaserNote": "Understanding ML fundamentals",
    "includeInXTeaser": true
  },
  {
    "slideNumber": 3,
    "keyPoints": ["Deep learning uses multi-layered networks"],
    "importance": "MEDIUM",
    "teaserNote": "The power of deep learning",
    "includeInXTeaser": false
  }
]`;

describe("parseBedrockOutput", () => {
  it("separates markdown from metadata", () => {
    const result = parseBedrockOutput(SAMPLE_MARP_OUTPUT);

    expect(result.rawMarkdown).toContain("# Introduction to AI");
    expect(result.rawMarkdown).not.toContain("---METADATA---");
    expect(result.metadata).toHaveLength(3);
  });

  it("parses frontmatter correctly", () => {
    const result = parseBedrockOutput(SAMPLE_MARP_OUTPUT);

    expect(result.frontmatter).toContain("marp: true");
    expect(result.frontmatter).toContain("theme: default");
    expect(result.frontmatter).toContain("paginate: true");
  });

  it("extracts correct number of slides", () => {
    const result = parseBedrockOutput(SAMPLE_MARP_OUTPUT);
    expect(result.slides).toHaveLength(3);
  });

  it("extracts presenter notes from each slide", () => {
    const result = parseBedrockOutput(SAMPLE_MARP_OUTPUT);

    expect(result.slides[0].presenterNote).toContain("Welcome everyone");
    expect(result.slides[1].presenterNote).toContain("Machine learning is a subset");
    expect(result.slides[2].presenterNote).toContain("Deep learning takes machine learning");
  });

  it("parses metadata JSON correctly", () => {
    const result = parseBedrockOutput(SAMPLE_MARP_OUTPUT);

    expect(result.metadata[0].slideNumber).toBe(1);
    expect(result.metadata[0].keyPoints).toEqual(["AI overview and industry transformation"]);
    expect(result.metadata[0].importance).toBe("HIGH");
    expect(result.metadata[0].teaserNote).toBe("AI is transforming every industry");
    expect(result.metadata[0].includeInXTeaser).toBe(true);

    expect(result.metadata[2].importance).toBe("MEDIUM");
    expect(result.metadata[2].includeInXTeaser).toBe(false);
  });

  it("handles metadata wrapped in code fences", () => {
    const output = `---
marp: true
---

# Slide 1

<!-- Note for slide 1 -->

---METADATA---

\`\`\`json
[
  {
    "slideNumber": 1,
    "keyPoints": ["Point 1"],
    "importance": "HIGH",
    "teaserNote": "Teaser",
    "includeInXTeaser": true
  }
]
\`\`\``;

    const result = parseBedrockOutput(output);
    expect(result.metadata).toHaveLength(1);
    expect(result.metadata[0].keyPoints).toEqual(["Point 1"]);
  });

  it("handles output without metadata separator", () => {
    const markdownOnly = `---
marp: true
---

# Only Slide

Content here

<!-- A presenter note -->`;

    const result = parseBedrockOutput(markdownOnly);
    expect(result.slides).toHaveLength(1);
    expect(result.metadata).toHaveLength(0);
  });
});

describe("parseMarpMarkdown", () => {
  it("extracts frontmatter", () => {
    const md = `---
marp: true
theme: gaia
---

# Hello World

<!-- Note -->`;

    const { frontmatter, slides } = parseMarpMarkdown(md);
    expect(frontmatter).toContain("marp: true");
    expect(frontmatter).toContain("theme: gaia");
    expect(slides).toHaveLength(1);
  });

  it("handles code blocks with --- inside", () => {
    const md = `---
marp: true
---

# Code Example

\`\`\`yaml
key: value
---
another: value
\`\`\`

<!-- Note about code -->

---

# Next Slide

<!-- Next note -->`;

    const { slides } = parseMarpMarkdown(md);
    // Should be 2 slides, not 3 (the --- in code block is not a separator)
    expect(slides).toHaveLength(2);
    expect(slides[0].content).toContain("```yaml");
    expect(slides[0].content).toContain("---");
  });

  it("handles multiple slides correctly", () => {
    const md = `---
marp: true
---

# Slide 1

<!-- Note 1 -->

---

# Slide 2

<!-- Note 2 -->

---

# Slide 3

<!-- Note 3 -->`;

    const { slides } = parseMarpMarkdown(md);
    expect(slides).toHaveLength(3);
    expect(slides[0].slideNumber).toBe(1);
    expect(slides[1].slideNumber).toBe(2);
    expect(slides[2].slideNumber).toBe(3);
  });
});

describe("extractPresenterNote", () => {
  it("extracts single-line notes", () => {
    const text = `# Title\n\nContent\n\n<!-- This is a note -->`;
    const { content, presenterNote } = extractPresenterNote(text);

    expect(presenterNote).toBe("This is a note");
    expect(content).not.toContain("<!--");
    expect(content).toContain("# Title");
  });

  it("extracts multi-line notes", () => {
    const text = `# Title\n\n<!--\nLine 1\nLine 2\nLine 3\n-->`;
    const { presenterNote } = extractPresenterNote(text);

    expect(presenterNote).toContain("Line 1");
    expect(presenterNote).toContain("Line 2");
    expect(presenterNote).toContain("Line 3");
  });

  it("handles slides with no notes", () => {
    const text = `# Title\n\nJust content here`;
    const { content, presenterNote } = extractPresenterNote(text);

    expect(presenterNote).toBe("");
    expect(content).toContain("# Title");
  });

  it("handles multiple comment blocks", () => {
    const text = `# Title\n\n<!-- First note -->\n\n<!-- Second note -->`;
    const { presenterNote } = extractPresenterNote(text);

    expect(presenterNote).toContain("First note");
    expect(presenterNote).toContain("Second note");
  });
});
