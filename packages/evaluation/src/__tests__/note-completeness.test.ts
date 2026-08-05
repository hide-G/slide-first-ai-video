import { describe, it, expect } from "vitest";
import { checkNoteCompleteness } from "../checks/note-completeness.js";

describe("checkNoteCompleteness", () => {
  it("should pass for deck with complete notes", () => {
    const md = `
# Slide 1

Content here.

<!-- presenterNote: This is the first note. -->
<!-- keyPoints: ["Point 1", "Point 2"] -->

---

# Slide 2

More content.

<!-- presenterNote: This is the second note. -->
<!-- keyPoints: ["Point A"] -->
`;
    const result = checkNoteCompleteness(md);
    expect(result.totalSlides).toBe(2);
    expect(result.slidesWithNotes).toBe(2);
    expect(result.slidesWithKeyPoints).toBe(2);
    expect(result.oversizedNotes).toHaveLength(0);
  });

  it("should detect slides missing presenter notes", () => {
    const md = `
# Slide 1

Content here.

<!-- presenterNote: Has a note. -->
<!-- keyPoints: ["Point 1"] -->

---

# Slide 2

No note here.

<!-- keyPoints: ["Point A"] -->
`;
    const result = checkNoteCompleteness(md);
    expect(result.totalSlides).toBe(2);
    expect(result.slidesWithNotes).toBe(1);
  });

  it("should detect slides missing key points", () => {
    const md = `
# Slide 1

Content.

<!-- presenterNote: Has a note. -->

---

# Slide 2

More content.

<!-- presenterNote: Another note. -->
<!-- keyPoints: ["Point 1"] -->
`;
    const result = checkNoteCompleteness(md);
    expect(result.totalSlides).toBe(2);
    expect(result.slidesWithKeyPoints).toBe(1);
  });

  it("should detect oversized presenter notes", () => {
    const longNote = "a".repeat(3001);
    const md = `
# Slide With Long Note

Content.

<!-- presenterNote: ${longNote} -->
<!-- keyPoints: ["Point 1"] -->
`;
    const result = checkNoteCompleteness(md);
    expect(result.oversizedNotes).toHaveLength(1);
    expect(result.oversizedNotes[0]).toContain("Slide With Long Note");
    expect(result.oversizedNotes[0]).toContain("3001");
  });

  it("should handle empty markdown", () => {
    const result = checkNoteCompleteness("");
    expect(result.totalSlides).toBe(0);
    expect(result.slidesWithNotes).toBe(0);
    expect(result.slidesWithKeyPoints).toBe(0);
    expect(result.oversizedNotes).toHaveLength(0);
  });

  it("should accept notes exactly at 3000 chars", () => {
    const exactNote = "b".repeat(3000);
    const md = `
# Slide

Content.

<!-- presenterNote: ${exactNote} -->
<!-- keyPoints: ["Point 1"] -->
`;
    const result = checkNoteCompleteness(md);
    expect(result.oversizedNotes).toHaveLength(0);
  });
});
