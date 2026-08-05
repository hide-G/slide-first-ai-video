/**
 * Prompt templates for Bedrock Converse API slide generation.
 * System prompt defines the Marp slide generation task.
 * User prompt incorporates theme, audience, duration, and reference content.
 */

export interface PromptInput {
  theme: string;
  audience: string;
  durationMinutes: number;
  urls: string[];
  /** Optional reference content fetched from URLs */
  referenceContent?: string;
}

/**
 * System prompt for Marp slide generation.
 * Instructs the model to output:
 * - Valid Marp Markdown (16:9, 1 key point per slide)
 * - Presenter notes in Marpit HTML comment format
 * - A structured JSON metadata block at the end
 */
export function buildSystemPrompt(): string {
  return `You are an expert presentation designer. Your task is to generate a Marp-compatible Markdown slide deck.

REQUIREMENTS:
- Output valid Marp Markdown with frontmatter (marp: true, theme: default, paginate: true)
- Use 16:9 aspect ratio (standard for Marp)
- Each slide should focus on ONE key point
- Include presenter notes after each slide in Marpit HTML comment format: <!-- note text -->
- Presenter notes should be written in a natural speaking voice, as if talking to the audience
- Each presenter note MUST be under 3000 characters (this is a hard limit for text-to-speech)
- Slides should use clear, concise text with bullet points where appropriate
- Aim for roughly 1 slide per 15-20 seconds of video duration

OUTPUT FORMAT:
You must output TWO sections separated by the marker "---METADATA---":

1. FIRST: The complete Marp Markdown deck
2. THEN: The marker line "---METADATA---"
3. FINALLY: A JSON array with metadata for each slide (excluding the title slide if it has no presenter note):

\`\`\`json
[
  {
    "slideNumber": 1,
    "keyPoints": ["Main point of this slide"],
    "importance": "HIGH",
    "teaserNote": "Brief hook for social media teaser",
    "includeInXTeaser": true
  }
]
\`\`\`

IMPORTANCE LEVELS:
- HIGH: Core message slides, must-include in any summary
- MEDIUM: Supporting detail slides
- LOW: Transitional or supplementary slides

RULES:
- Every slide with content MUST have a presenter note
- Every slide MUST have at least one keyPoint in metadata
- The title slide counts as slide 1
- Do not use code block fences around the Marp markdown itself
- Do not include --- inside code blocks in slide content (use indented code instead)`;
}

/**
 * Build user prompt from generation parameters.
 */
export function buildUserPrompt(input: PromptInput): string {
  const slideEstimate = Math.round((input.durationMinutes * 60) / 17.5);

  let prompt = `Generate a presentation slide deck with the following parameters:

THEME: ${input.theme}
TARGET AUDIENCE: ${input.audience}
TARGET DURATION: ${input.durationMinutes} minutes (approximately ${slideEstimate} slides)
`;

  if (input.urls.length > 0) {
    prompt += `\nREFERENCE URLS:\n`;
    for (const url of input.urls) {
      prompt += `- ${url}\n`;
    }
  }

  if (input.referenceContent) {
    prompt += `\nREFERENCE CONTENT:\n${input.referenceContent}\n`;
  }

  prompt += `\nPlease generate the complete Marp slide deck followed by the metadata JSON as specified.`;

  return prompt;
}
