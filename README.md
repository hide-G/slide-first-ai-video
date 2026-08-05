# Slide-First AI Video

A slide-first AI video generation application that converts Marp Markdown presentations into narrated videos with captions and multiple output formats.

## Architecture

See [slide-first-ai-video-design.md](./slide-first-ai-video-design.md) for the complete design document.

## Project Structure

```
slide-first-ai-video/
  packages/
    shared-types/   - TypeScript type definitions (VideoRenderer port, VideoManifest, etc.)
    core/           - Shared business logic (S3 key builders, duration calc, idempotency)
  infra/            - AWS CDK infrastructure
  lambdas/
    marp-render/          - Marp Markdown to PNG conversion
    polly-worker/         - Amazon Polly TTS audio generation
    composition-builder/  - Video composition assembly
    api/                  - REST API handler
  config/           - Environment-specific configuration (dev/stg/prd)
```

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10+

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## Key Concepts

- **Marp Markdown** is the content source of truth
- **VideoManifest** holds timing and rendering configuration (derived from Marp)
- **VideoRenderer port** provides a swappable boundary for video generation implementations
- **productSlug** is configurable via CDK context, never hardcoded in source
