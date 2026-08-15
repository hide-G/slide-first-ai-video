/**
 * Prompts for teaser generation via Bedrock.
 * Includes: slide selection, hook text generation, and post text generation.
 */

/**
 * System prompt for teaser slide selection and hook/post generation.
 */
export function buildTeaserSystemPrompt(): string {
  return `You are an expert social media video producer specializing in creating engaging short-form content for X (Twitter).
Your task is to select the most impactful slides from a presentation and generate compelling hook text and post copy.

Rules:
- Select slides that have the highest visual and informational impact
- Hook text must be attention-grabbing and under 8 words (readable in 1-2 seconds)
- Post text should include relevant hashtags and reference source materials
- Always respond in valid JSON format`;
}

/**
 * User prompt for slide selection.
 * Asks the model to select 3-6 HIGH-importance slides that fit within 30-60s.
 */
export function buildSlideSelectionPrompt(slides: SlideSelectionInput[]): string {
  const slidesJson = JSON.stringify(slides, null, 2);
  return `Given the following slides from a presentation, select the best 3-6 slides for a 30-60 second X teaser video.

Selection criteria:
- Prioritize slides with importance "HIGH" and includeInXTeaser = true
- Each slide's teaserNote will be read aloud (estimate ~150 words per minute)
- Total audio duration must be 25-55 seconds (plus 2s hook + 3s CTA = 30-60s total)
- Select slides that tell a coherent story arc

Slides:
${slidesJson}

Respond with a JSON object:
{
  "selectedSlideNumbers": [<list of slide numbers>],
  "reasoning": "<brief explanation of selection>"
}`;
}

/** Input type for slide selection prompt */
export interface SlideSelectionInput {
  slideNumber: number;
  importance: string;
  includeInXTeaser: boolean;
  teaserNote: string;
  keyPoints: string[];
  measuredAudioMs: number;
}

/**
 * User prompt for hook text generation.
 * Generates 3 hook text candidates.
 */
export function buildHookTextPrompt(
  selectedSlides: SlideSelectionInput[],
  theme: string,
): string {
  const keyPointsSummary = selectedSlides
    .flatMap((s) => s.keyPoints)
    .slice(0, 10)
    .join(", ");

  return `Generate 3 hook text candidates for the first 1-2 seconds of an X teaser video.

Topic/Theme: ${theme || "presentation highlights"}
Key points covered: ${keyPointsSummary}

Requirements:
- Each hook must be 2-8 words maximum
- Must be attention-grabbing and create curiosity
- Should relate to the content but not give everything away
- Readable in under 2 seconds

Respond with a JSON object:
{
  "hooks": [
    { "text": "<hook 1>", "rank": 1 },
    { "text": "<hook 2>", "rank": 2 },
    { "text": "<hook 3>", "rank": 3 }
  ]
}`;
}

/**
 * User prompt for post text generation with hashtags and source links.
 */
export function buildPostTextPrompt(
  selectedSlides: SlideSelectionInput[],
  references: string[],
  theme: string,
): string {
  const keyPoints = selectedSlides.flatMap((s) => s.keyPoints).slice(0, 8);
  const refsText = references.length > 0 ? references.join("\n") : "None provided";

  return `Generate X (Twitter) post text to accompany a teaser video.

Topic/Theme: ${theme || "presentation highlights"}
Key points: ${keyPoints.join("; ")}
Source references: ${refsText}

Requirements:
- Post text must be under 280 characters (excluding URL)
- Include 2-4 relevant hashtags
- If source references are provided, mention them naturally
- Use engaging, professional tone
- Do NOT include the video URL (that will be added separately)

Respond with a JSON object:
{
  "text": "<post text with hashtags>",
  "hashtags": ["#tag1", "#tag2"],
  "sourceLinks": ["<extracted source URLs>"]
}`;
}
