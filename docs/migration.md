# Migration Guide

This document maps every existing component to its role in the new architecture as defined in the implementation specification (実装指示プロンプト.md).

## Legend

| Action   | Meaning                                                       |
| -------- | ------------------------------------------------------------- |
| KEEP     | No structural change needed, minor config tweaks at most      |
| ADAPT    | Same purpose, but internals must change to match new contract |
| REBUILD  | Same domain, rewritten from scratch to fit new pipeline       |
| REMOVE   | Not part of the new specification; delete                     |

---

## Infrastructure Constructs (`infra/lib/`)

| Existing File                            | Action  | Notes                                                                              |
| ---------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `storage-construct.ts`                   | KEEP    | S3 bucket + DynamoDB table remain                                                  |
| `auth-construct.ts`                      | KEEP    | Cognito user pool unchanged                                                        |
| `api-construct.ts`                       | REBUILD | New 11 REST routes per section 5                                                   |
| `marp-lambda-construct.ts`              | KEEP    | Drives Stage 1 (page image generation via Marp)                                    |
| `polly-worker-construct.ts`             | KEEP    | Drives Stage 2 (audio generation via Polly)                                        |
| `composition-builder-construct.ts`      | REMOVE  | Replaced by clip + concat stages (Stages 4 and 5)                                 |
| `slide-generator-construct.ts`          | KEEP    | Bedrock-based outline generation                                                   |
| `render-state-machine-construct.ts`     | REBUILD | New 5-stage pipeline state machine (pages, audio, captions, clips, concat)         |
| `content-state-machine-construct.ts`    | REBUILD | Simplified flow for content generation                                             |
| `delivery-construct.ts`                 | KEEP    | CloudFront distribution unchanged                                                  |
| `frontend-construct.ts`                 | KEEP    | SPA hosting unchanged                                                              |
| `teaser-generator-construct.ts`         | REMOVE  | Not in spec                                                                        |
| `teaser-composition-builder-construct.ts` | REMOVE | Not in spec                                                                        |
| `teaser-state-machine-construct.ts`     | REMOVE  | Not in spec                                                                        |

---

## Lambda Functions (`lambdas/`)

| Existing Directory          | Action  | New Role                                                                 |
| --------------------------- | ------- | ------------------------------------------------------------------------ |
| `api/`                      | REBUILD | New path-based router with 11 endpoints (section 5)                      |
| `marp-render/`             | ADAPT   | Stage 1: render slides to PNG pages; output key format changes           |
| `polly-worker/`            | ADAPT   | Stage 2: change output from PCM to MP3, measure duration with ffprobe    |
| `render-worker/`           | REBUILD | Becomes clip-worker for Stage 4 (per-page MP4 clip generation)           |
| `slide-generator/`         | KEEP    | Outline + deck generation via Bedrock (no structural change)             |
| `composition-builder/`     | REMOVE  | Replaced by concat stage (Stage 5)                                       |
| `teaser-generator/`        | REMOVE  | Not in spec                                                              |
| `teaser-composition-builder/` | REMOVE | Not in spec                                                              |

---

## Packages (`packages/`)

| Existing Package              | Action  | Notes                                                              |
| ----------------------------- | ------- | ------------------------------------------------------------------ |
| `shared-types`               | DONE    | Rebuilt in FEAT-001 with zod-based Manifest schema                 |
| `core`                       | REBUILD | New s3-keys, duration, captions, script-hash (this feature)        |
| `renderer-port`             | REBUILD | Simplified interface for clip + concat pipeline                    |
| `renderer-ffmpeg`           | REBUILD | New clip-per-page and concat commands per section 6                |
| `renderer-hyperframes`      | REMOVE  | Not in spec                                                        |
| `evaluation`                | REMOVE  | Not in spec                                                        |
| `renderer-contract-tests`   | REMOVE  | Not needed with new architecture                                   |

---

## S3 Key Layout Migration

### Old Layout

```
{userId}/{projectId}/versions/v{NNNN}/
  slides/deck.001.png
  audio/slide-001.pcm
  audio/slide-001-marks.json
  captions/captions.json, full.ja.vtt, full.ja.srt
  video/video-manifest.json
  output/lt-full-16x9.mp4
```

### New Layout (section 4.1)

```
users/{userId}/projects/{projectId}/
  input/source.pdf | input/source.pptx
  deck/deck.md, deck/deck.pdf, deck/deck.pptx
  pages/page-001.png, page-002.png, ...
  audio/page-001.mp3, page-002.mp3, ...
  captions/captions.srt
  clips/page-001.mp4, page-002.mp4, ...
  output/{renderId}/video.mp4
  manifest.json
```

Key differences:
- Flat structure (no version nesting)
- `users/` prefix added to root
- Audio format changed from PCM to MP3
- Speech marks files removed (not needed; duration from ffprobe)
- Clips directory added for per-page video segments
- Output organized by renderId
- Single manifest.json at project root

---

## Duration Model Migration

### Old Model

- `durationMs = measuredAudioMs + leadInMs + leadOutMs`
- Millisecond-based throughout
- Lead-in/lead-out padding per slide

### New Model (section 4.2)

- `audioDurationSec`: per-page float measured by ffprobe after audio generation
- Total duration: simple sum of all pages' `audioDurationSec`
- Cumulative start time for SRT: sum of preceding pages' `audioDurationSec`
- No lead-in/lead-out; timing is pure audio duration
- Seconds-based (not milliseconds)

---

## Pipeline Stage Mapping

| Old Concept         | New Stage      | Description                                        |
| ------------------- | -------------- | -------------------------------------------------- |
| Slide rendering     | Stage 1: pages | Marp renders deck to per-page PNG images           |
| Audio generation    | Stage 2: audio | Polly generates MP3, ffprobe measures duration     |
| (none)              | Stage 3: captions | Generate captions.srt from cumulative timing    |
| Composition build   | Stage 4: clips | FFmpeg creates per-page MP4 (image + audio)        |
| (none)              | Stage 5: concat | FFmpeg concatenates all clips into final video   |

---

## Files to Delete (during subsequent features)

- `lambdas/composition-builder/`
- `lambdas/teaser-generator/`
- `lambdas/teaser-composition-builder/`
- `infra/lib/composition-builder-construct.ts`
- `infra/lib/teaser-generator-construct.ts`
- `infra/lib/teaser-composition-builder-construct.ts`
- `infra/lib/teaser-state-machine-construct.ts`
- `packages/renderer-hyperframes/`
- `packages/evaluation/`
- `packages/renderer-contract-tests/`
- `packages/core/src/teaser/`
- `packages/core/src/audio/` (PCM utilities)
- `packages/core/src/manifest/` (old manifest builder)
