# Data Contract

This document defines the data contract for the Slide-First AI Video pipeline.
All pipeline stages communicate exclusively through this contract.

## S3 Layout (Section 4.1)

```text
s3://<bucket>/users/{userId}/projects/{projectId}/
  input/source.pdf | input/source.pptx
  deck/deck.md, deck/deck.pdf, deck/deck.pptx
  pages/page-001.png, page-002.png, ...
  audio/page-001.wav, page-002.wav, ...
  captions/captions.srt
  output/{renderId}/video.mp4
  manifest.json
```

### Directories

| Directory | Purpose |
| --- | --- |
| `input/` | Original uploaded source file (PDF or PPTX) |
| `deck/` | Generated/converted deck files (Markdown, PDF, PPTX) |
| `pages/` | PNG images extracted from the deck (one per page) |
| `audio/` | WAV narration audio for each page (PCM with RIFF header) |
| `captions/` | SRT subtitle file |
| `output/{renderId}/` | Final video produced by MediaConvert |

### Naming Conventions

- Page files use zero-padded 3-digit numbers: `page-001`, `page-002`, ...
- The manifest is always at the project root as `manifest.json`
- Each render produces a unique output directory keyed by `renderId`

## Manifest Schema (Section 4.2)

The `manifest.json` file is the single source of truth for project state.

```json
{
  "schemaVersion": 1,
  "projectId": "p_0001",
  "userId": "u_0001",
  "contentLanguage": "ja",
  "source": {
    "kind": "generated",
    "fileKey": "deck/deck.pdf",
    "pageCount": 5
  },
  "voice": {
    "id": "Takumi",
    "engine": "neural",
    "languageCode": "ja-JP",
    "sampleRate": "24000"
  },
  "output": {
    "aspect": "16:9",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "captions": "burn",
    "verticalLayout": null,
    "padColor": null
  },
  "lexicon": [
    { "written": "Kiro Crew", "reading": "キロクルー", "method": "sub" }
  ],
  "pages": [
    {
      "pageNumber": 1,
      "imageKey": "pages/page-001.png",
      "script": { "mode": "plain", "text": "This slide covers..." },
      "audioKey": "audio/page-001.wav",
      "audioDurationSec": 25.2,
      "frameAlignedDurationMs": 25200
    }
  ],
  "stages": {
    "pages": "done",
    "audio": "done",
    "captions": "done",
    "video": "running"
  },
  "cost": {
    "currency": "USD",
    "priceListFetchedAt": "2026-08-15T00:00:00Z",
    "stages": [
      {
        "stage": "audio",
        "service": "polly",
        "usage": { "billedCharacters": 921 },
        "estimatedCost": 0.0147
      },
      {
        "stage": "video",
        "service": "mediaconvert",
        "usage": { "durationSec": 120, "resolution": "1080p" },
        "estimatedCost": 0.0180
      }
    ],
    "estimatedTotal": 0.0328,
    "actual": { "status": "pending", "amount": null, "reconciledAt": null }
  }
}
```

### Field Reference

#### Top-level fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | `1` (literal) | Always 1 for this version |
| `projectId` | string | Project identifier |
| `userId` | string | Owner user identifier |
| `contentLanguage` | string | Content language code (e.g., "ja") |
| `source` | object | Source deck information |
| `voice` | object | TTS voice configuration |
| `output` | object | Video output settings |
| `lexicon` | array | Pronunciation overrides |
| `pages` | array | Per-page data |
| `stages` | object | Pipeline stage statuses |
| `cost` | object (optional) | Cost tracking data |

#### `source`

| Field | Values | Description |
| --- | --- | --- |
| `kind` | `"generated"` or `"uploaded"` | How the deck was obtained |
| `fileKey` | string | S3 key of the source file (relative to project) |
| `pageCount` | positive integer | Number of pages in the deck |

#### `voice`

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Voice identifier (e.g., "Takumi") |
| `engine` | string | Engine type (e.g., "neural") |
| `languageCode` | string | BCP-47 language code (e.g., "ja-JP") |
| `sampleRate` | string | Sample rate in Hz (e.g., "24000") |

#### `output`

| Field | Values | Description |
| --- | --- | --- |
| `aspect` | `"16:9"`, `"9:16"`, `"1:1"`, `"4:5"` | Aspect ratio |
| `width` | positive integer | Output width in pixels |
| `height` | positive integer | Output height in pixels |
| `fps` | positive integer | Frames per second |
| `captions` | `"burn"`, `"srt"`, `"none"` | Caption handling |
| `verticalLayout` | string or null | Vertical layout mode |
| `padColor` | string or null | Padding color (hex) |

#### `lexicon[]`

| Field | Values | Description |
| --- | --- | --- |
| `written` | string | The written form to match |
| `reading` | string | The pronunciation to use |
| `method` | `"sub"`, `"phoneme"`, `"spell"` | Substitution method |

#### `pages[]`

| Field | Type | Description |
| --- | --- | --- |
| `pageNumber` | positive integer | 1-indexed page number |
| `imageKey` | string | S3 key of the page PNG |
| `script.mode` | `"plain"` or `"ssml"` | Script format |
| `script.text` | string | Narration text |
| `audioKey` | string | S3 key of the audio WAV |
| `audioDurationSec` | number | Duration calculated from PCM byte length |
| `frameAlignedDurationMs` | number | Duration rounded up to frame boundary (ms) |

#### `stages`

Each stage has one of these statuses: `"pending"`, `"running"`, `"done"`, `"failed"`

| Stage | Description |
| --- | --- |
| `pages` | PDF to PNG extraction |
| `audio` | TTS narration generation (Polly PCM to WAV) |
| `captions` | SRT subtitle generation |
| `video` | Final video assembly (MediaConvert) |

#### `cost` (optional)

| Field | Type | Description |
| --- | --- | --- |
| `currency` | string | Always "USD" |
| `priceListFetchedAt` | string (ISO 8601) | When price data was fetched |
| `stages[]` | array | Per-stage cost entries |
| `stages[].stage` | string | Stage name |
| `stages[].service` | string | AWS service name |
| `stages[].usage` | object | Service-specific usage metrics |
| `stages[].estimatedCost` | number | Estimated cost in USD |
| `estimatedTotal` | number | Sum of estimated costs |
| `actual.status` | `"pending"` or `"reconciled"` | Whether actual cost is known |
| `actual.amount` | number or null | Actual cost (null if pending) |
| `actual.reconciledAt` | string or null | When reconciliation happened |

## Invariants (Section 4.3)

These invariants must never be violated:

1. **Page count consistency**: `pages.length === source.pageCount`
2. **Script completeness**: All `script.text` must be non-empty before the audio stage starts
3. **Audio duration accuracy**: `audioDurationSec` must come from PCM byte-length calculation only (pcmBytes / (2 * sampleRate) for 16-bit mono)
4. **Frame alignment**: `frameAlignedDurationMs >= audioDurationSec * 1000` for every page
5. **Frame excess limit**: `frameAlignedDurationMs - audioDurationSec * 1000 <= 34ms` per page (one frame at 30fps)
6. **Total duration**: Sum of `frameAlignedDurationMs` must be within 50ms of expected total
7. **Subtitle timecodes**: Generated from cumulative `frameAlignedDurationMs` values (not audioDurationSec)
8. **No display estimates in manifest**: Screen-displayed estimated durations are for UI only and must not be written to `manifest.json`

### Runtime Enforcement

Invariants 1-5 are validated by `validateInvariants()` from `@slide-first/shared-types`.
Invariant 6 is enforced at the video assembly stage boundary.
Invariant 7 is enforced by the SRT generator in `@slide-first/core`.
Invariant 8 is a development guideline.

### Tolerance Constants

```typescript
import { TOLERANCES } from "@slide-first/shared-types";

TOLERANCES.TOTAL_DURATION_MS  // 50 milliseconds (total video duration drift)
TOLERANCES.FRAME_EXCESS_MS   // 34 milliseconds (per-page frame alignment excess)
```

## Implementation

The data contract is implemented in `packages/shared-types`:

- `src/manifest.ts` - Zod schemas and TypeScript types
- `src/invariants.ts` - Runtime invariant validation
- `src/s3-keys.ts` - S3 key builder functions
- `src/index.ts` - Public exports

### Usage Example

```typescript
import {
  ManifestSchema,
  validateInvariants,
  manifestKey,
  pageImageKey,
  type Manifest,
} from "@slide-first/shared-types";

// Parse and validate a manifest from JSON
const result = ManifestSchema.safeParse(jsonData);
if (!result.success) {
  console.error("Invalid manifest:", result.error);
}

// Check invariants
const violations = validateInvariants(manifest);
if (violations.length > 0) {
  throw new Error(`Invariant violations: ${violations.map(v => v.message).join(", ")}`);
}

// Build S3 keys
const key = manifestKey({ userId: "u_0001", projectId: "p_0001" });
// => "users/u_0001/projects/p_0001/manifest.json"

const imgKey = pageImageKey({ userId: "u_0001", projectId: "p_0001" }, 3);
// => "users/u_0001/projects/p_0001/pages/page-003.png"
```
