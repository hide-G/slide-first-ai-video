/**
 * Marp output parser.
 * Extracts individual slides, presenter notes, and metadata from
 * the Bedrock-generated output.
 */

/** Parsed slide content */
export interface ParsedSlide {
  slideNumber: number;
  content: string;
  presenterNote: string;
}

/** Complete parsed output from Bedrock */
export interface ParsedOutput {
  frontmatter: string;
  slides: ParsedSlide[];
  metadata: SlideMetadata[];
  rawMarkdown: string;
}

/** Metadata for a single slide from the JSON block */
export interface SlideMetadata {
  slideNumber: number;
  keyPoints: string[];
  importance: "HIGH" | "MEDIUM" | "LOW";
  teaserNote: string;
  includeInXTeaser: boolean;
}

const METADATA_SEPARATOR = "---METADATA---";

/**
 * Parse the complete Bedrock output into Marp markdown and metadata.
 */
export function parseBedrockOutput(raw: string): ParsedOutput {
  const separatorIndex = raw.lastIndexOf(METADATA_SEPARATOR);

  let markdownSection: string;
  let metadataSection: string;

  if (separatorIndex === -1) {
    // No metadata separator found - try to extract JSON array from end
    markdownSection = raw;
    metadataSection = "[]";
  } else {
    markdownSection = raw.substring(0, separatorIndex).trim();
    metadataSection = raw.substring(separatorIndex + METADATA_SEPARATOR.length).trim();
  }

  // Strip any markdown code fence from the metadata section
  metadataSection = stripCodeFence(metadataSection);

  const metadata = parseMetadataJson(metadataSection);
  const { frontmatter, slides } = parseMarpMarkdown(markdownSection);

  return {
    frontmatter,
    slides,
    metadata,
    rawMarkdown: markdownSection,
  };
}

/**
 * Strip markdown code fence wrappers (```json ... ```) if present.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  // Match ```json or ``` at start
  const fenceStartMatch = trimmed.match(/^```(?:json)?\s*\n?/);
  if (fenceStartMatch) {
    let inner = trimmed.substring(fenceStartMatch[0].length);
    // Remove trailing ```
    const fenceEndMatch = inner.match(/\n?```\s*$/);
    if (fenceEndMatch) {
      inner = inner.substring(0, inner.length - fenceEndMatch[0].length);
    }
    return inner.trim();
  }
  return trimmed;
}

/**
 * Parse the metadata JSON array.
 */
function parseMetadataJson(json: string): SlideMetadata[] {
  if (!json || json === "[]") {
    return [];
  }

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error("Metadata must be a JSON array");
    }
    return parsed.map((item: Record<string, unknown>) => ({
      slideNumber: Number(item.slideNumber) || 0,
      keyPoints: Array.isArray(item.keyPoints)
        ? (item.keyPoints as string[])
        : [],
      importance: validateImportance(item.importance as string),
      teaserNote: String(item.teaserNote || ""),
      includeInXTeaser: Boolean(item.includeInXTeaser),
    }));
  } catch (error) {
    throw new Error(
      `Failed to parse slide metadata JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function validateImportance(value: string): "HIGH" | "MEDIUM" | "LOW" {
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }
  return "MEDIUM";
}

/**
 * Parse Marp Markdown into frontmatter and individual slides.
 * Handles edge cases like code blocks containing ---.
 */
export function parseMarpMarkdown(markdown: string): {
  frontmatter: string;
  slides: ParsedSlide[];
} {
  const trimmed = markdown.trim();

  // Extract frontmatter
  let frontmatter = "";
  let bodyContent = trimmed;

  if (trimmed.startsWith("---")) {
    const frontmatterEnd = trimmed.indexOf("---", 3);
    if (frontmatterEnd !== -1) {
      frontmatter = trimmed.substring(3, frontmatterEnd).trim();
      bodyContent = trimmed.substring(frontmatterEnd + 3).trim();
    }
  }

  // Split on slide separators (---), being careful about code blocks
  const slideTexts = splitSlides(bodyContent);

  const slides: ParsedSlide[] = slideTexts.map((text, index) => {
    const { content, presenterNote } = extractPresenterNote(text);
    return {
      slideNumber: index + 1,
      content: content.trim(),
      presenterNote: presenterNote.trim(),
    };
  });

  return { frontmatter, slides };
}

/**
 * Split content on --- slide separators, respecting code blocks.
 */
function splitSlides(body: string): string[] {
  const lines = body.split("\n");
  const slides: string[] = [];
  let currentSlide: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code block state
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      currentSlide.push(line);
      continue;
    }

    // Only split on --- when not inside a code block
    if (!inCodeBlock && /^---\s*$/.test(line)) {
      slides.push(currentSlide.join("\n"));
      currentSlide = [];
      continue;
    }

    currentSlide.push(line);
  }

  // Add the last slide
  if (currentSlide.length > 0) {
    slides.push(currentSlide.join("\n"));
  }

  // Filter out empty slides (e.g., from leading ---)
  return slides.filter((s) => s.trim().length > 0);
}

/**
 * Extract presenter notes from a slide's text.
 * Notes are in Marpit format: <!-- note content -->
 * Handles multi-line comments.
 */
export function extractPresenterNote(slideText: string): {
  content: string;
  presenterNote: string;
} {
  // Match HTML comments that serve as presenter notes
  // These can be single-line or multi-line
  const noteRegex = /<!--\s*([\s\S]*?)\s*-->/g;
  const notes: string[] = [];
  let content = slideText;

  let match: RegExpExecArray | null;
  while ((match = noteRegex.exec(slideText)) !== null) {
    notes.push(match[1].trim());
  }

  // Remove all HTML comments from content
  content = content.replace(/<!--[\s\S]*?-->/g, "").trim();

  return {
    content,
    presenterNote: notes.join("\n"),
  };
}
