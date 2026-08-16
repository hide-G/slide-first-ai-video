# Slide-First AI Video

> スライドを正本に、ナレーションと字幕つきの動画を生成するAWSアプリケーション。生成AIでスライドを作る機能と、手持ちの資料を動画化する機能を、それぞれ独立して使えます。
>
> Turn slides into narrated, captioned video on AWS. Generating a deck with AI and turning an existing deck into video are two independent features.

[日本語](#japanese) | [English](#english)

---

<a id="japanese"></a>

## 日本語

### 何ができるか

2つの機能があり、互いに独立しています。片方だけを使えます。

| 機能 | 内容 |
| --- | --- |
| ② スライド作成 | 文章と参考URLを渡すと、生成AIがスライドの骨子を作ります。内容を確認・加筆修正してからMarpでスライドを生成し、Markdown・PDF・PowerPointで書き出します |
| ③ 動画作成 | PDFをアップロードし、ナレーションと字幕を付けて動画にします。②を経由せず単独で使えます |

主な特徴です。

- **骨子をレビューしてから生成** — 生成AIの出力をそのまま採用せず、ユーザーが確定した文章だけをスライドにします
- **画面の言語と資料の言語を分離** — 画面を英語表示にしたまま日本語のスライドを作れます
- **配信先に合わせた出力サイズ** — 16:9 / 9:16 / 1:1 / 4:5
- **音声と映像を厳密に同期** — 音声の長さを実測し、フレーム境界に丸めてから動画にします
- **読み方をSSMLで指定** — 英単語や固有名詞の読み、振り仮名、間。移動できるチートシートつき
- **工程ごとの費用表示** — 使用量から推定額を出し、実績額とは区別して表示します
- **外部の実行ファイルを持ち込まない** — FFmpegやLibreOfficeを使わず、AWSのサービスとnpmパッケージだけで構成しています

### アーキテクチャ

![Slide-First AI Video のアーキテクチャ図](./docs/assets/architecture.png)

高解像度版とベクター形式は [docs/assets/architecture.svg](./docs/assets/architecture.svg) にあります。

| 工程 | 実装 | 出力 | 使う技術 |
| --- | --- | --- | --- |
| 1 pages | `marp-render` | `pages/page-NNN.png` | Chromium + pdf.js、またはMarpの画像出力 |
| 2 audio | `polly-worker` | `audio/page-NNN.wav` | Amazon Polly（PCM出力） |
| 3 captions | `caption-worker` | `captions/captions.srt` | 純粋なJavaScript |
| 4 video | Step Functions → MediaConvert | `output/{renderId}/video.mp4` | AWS Elemental MediaConvert |

各工程は単独で再実行できます。原稿を変えていなければ、音声を作り直さずに別サイズの動画を書き出せます。

シーケンス図やMediaConvertのジョブ構造、S3のレイアウトは [docs/architecture.md](./docs/architecture.md) にあります。

### 設計上の判断

このアプリは**外部の実行ファイルを一切使いません。** 開発機がMacBook上のBoot Campで動くWindows 10で、Dockerを導入できないためです。コンテナイメージを作れない環境でも保守できる構成にしています。

| 一般的な選択 | この構成での代替 |
| --- | --- |
| FFmpegで動画を合成 | AWS Elemental MediaConvert |
| ffprobeで音声の長さを測る | PollyのPCM出力のバイト数から厳密に算出 |
| pdftoppmでPDFを画像化 | Chromium内のpdf.js |
| LibreOfficeでPPTXをPDFに変換 | 非対応。PowerPointからPDFで書き出してもらう |

MediaConvertとChromiumは、実際のAWS環境でジョブと検証用Lambdaを動かして成立を確認しています。実測値は [設計指示書_動画生成パイプライン.md](./設計指示書_動画生成パイプライン.md) に記載しています。

### 制限事項

- **PowerPointのアップロードは非対応です。** PowerPointで「PDFとして保存」してからアップロードしてください。変換にLibreOfficeが必要で、この構成では動かせません
- **書き出したPowerPointはテキストを編集できません。** Marpの仕様上、各ページが画像として貼り付けられます。表示や書き込みは可能です
- 1つの動画で扱えるページ数は150までです（MediaConvertの入力数上限）

### 必要なもの

- Node.js 22（`.nvmrc` を参照）
- pnpm 10以降
- AWSアカウント（Bedrock、Polly、MediaConvertを利用します）

### 使い方

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

インフラは AWS CDK です。`infra/cdk.json` の `app` が `node dist/bin/app.js` を指しているため、CDKを実行する前にビルドが必要です。`Code.fromAsset` が相対パスなので `infra` ディレクトリから実行します。

```bash
pnpm build
cd infra
npx --yes aws-cdk@2 synth
npx --yes aws-cdk@2 diff
```

デプロイは差分を確認してから行ってください。既存スタックを更新する操作です。

### 画面モックアップ

実装の正本となる画面モックアップが `mockup/` にあります。ビルド不要で、`mockup/index.html` をブラウザで開くだけで画面遷移とUIを確認できます。通信も生成処理も行いません。

### プロジェクト構成

```text
slide-first-ai-video/
├─ frontend/            React + Vite のSPA
├─ mockup/              画面モックアップ（UIの正本）
├─ infra/               AWS CDK
│  ├─ src/main-stack.ts
│  └─ lib/              機能単位のコンストラクト
├─ lambdas/
│  ├─ api/              REST API
│  ├─ slide-generator/  Bedrockで骨子とナレーションを生成
│  ├─ marp-render/      工程1 ページ画像化とスライド生成
│  ├─ polly-worker/     工程2 音声合成
│  └─ caption-worker/   工程3 字幕生成
├─ packages/
│  ├─ shared-types/     型と実行時バリデーション、S3キー
│  └─ core/             共通ロジック
├─ config/              環境別の設定
└─ docs/                契約、費用、移行、アーキテクチャ
```

### ドキュメント

| ファイル | 内容 |
| --- | --- |
| [docs/architecture.md](./docs/architecture.md) | アーキテクチャ図、シーケンス図、S3レイアウト |
| [docs/contract.md](./docs/contract.md) | `manifest.json` のデータ契約と不変条件 |
| [docs/cost.md](./docs/cost.md) | 費用の計測方法とコスト配分タグ |
| [docs/migration.md](./docs/migration.md) | 旧構成からの移行記録 |
| [設計指示書_動画生成パイプライン.md](./設計指示書_動画生成パイプライン.md) | 動画生成の実装指示と実機検証の実測値 |
| [作業指示書_残作業.md](./作業指示書_残作業.md) | 作業の進め方、環境情報、完了条件 |
| [実装指示プロンプト.md](./実装指示プロンプト.md) | アプリ全体の仕様 |

---

<a id="english"></a>

## English

### What it does

Two independent features. You can use either one on its own.

| Feature | Description |
| --- | --- |
| Slide creation | Provide text and reference URLs, and AI drafts a slide outline. Review and edit it, then generate the deck with Marp and export Markdown, PDF and PowerPoint |
| Video creation | Upload a PDF and export it as video with narration and captions. Works without going through slide creation |

Highlights:

- **Review the outline before generating** — AI output is never used as is. Only the text you confirm becomes a slide
- **Interface language is separate from content language** — keep the UI in English and still produce Japanese slides
- **Output sizes per destination** — 16:9, 9:16, 1:1, 4:5
- **Audio and video stay in sync** — audio length is measured, then aligned to frame boundaries before rendering
- **Pronunciation control with SSML** — readings, furigana and pauses, with a movable cheat sheet
- **Cost shown per stage** — estimated from measured usage, kept distinct from actual charges
- **No external executables** — no FFmpeg, no LibreOffice. Only AWS services and npm packages

### Architecture

![Architecture of Slide-First AI Video](./docs/assets/architecture.png)

Labels in the diagram are in Japanese. A vector version is available at [docs/assets/architecture.svg](./docs/assets/architecture.svg). The diagrams in [docs/architecture.md](./docs/architecture.md) use English service and stage names.

| Stage | Implementation | Output | Technology |
| --- | --- | --- | --- |
| 1 pages | `marp-render` | `pages/page-NNN.png` | Chromium with pdf.js, or Marp image export |
| 2 audio | `polly-worker` | `audio/page-NNN.wav` | Amazon Polly, PCM output |
| 3 captions | `caption-worker` | `captions/captions.srt` | Pure JavaScript |
| 4 video | Step Functions to MediaConvert | `output/{renderId}/video.mp4` | AWS Elemental MediaConvert |

Each stage can be retried on its own. If the script has not changed, another output size can be exported without redoing the audio.

Sequence diagrams, the MediaConvert job structure and the S3 layout are in [docs/architecture.md](./docs/architecture.md).

### Design decisions

This application uses **no external executables**. The development machine runs Windows 10 under Boot Camp on a MacBook and cannot install Docker, so the design stays maintainable without building container images.

| Common choice | Alternative used here |
| --- | --- |
| Compose video with FFmpeg | AWS Elemental MediaConvert |
| Measure audio length with ffprobe | Computed exactly from the byte count of Polly PCM output |
| Rasterize PDF with pdftoppm | pdf.js running inside Chromium |
| Convert PPTX to PDF with LibreOffice | Not supported. Users export to PDF from PowerPoint |

MediaConvert and Chromium were validated by running a real job and a probe Lambda in AWS. The measurements are recorded in [設計指示書_動画生成パイプライン.md](./設計指示書_動画生成パイプライン.md).

### Limitations

- **PowerPoint upload is not supported.** Save as PDF in PowerPoint first. The conversion needs LibreOffice, which this design cannot run
- **Exported PowerPoint is not text editable.** Marp embeds each page as an image. Presenting and annotating still work
- Up to 150 pages per video, which is the MediaConvert input limit

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- pnpm 10 or later
- An AWS account with access to Bedrock, Polly and MediaConvert

### Getting started

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

Infrastructure is AWS CDK. The `app` entry in `infra/cdk.json` points to `node dist/bin/app.js`, so build before running CDK. `Code.fromAsset` uses relative paths, so run CDK from the `infra` directory.

```bash
pnpm build
cd infra
npx --yes aws-cdk@2 synth
npx --yes aws-cdk@2 diff
```

Review the diff before deploying. Deployment updates an existing stack.

### UI mockup

The UI mockup that serves as the source of truth lives in `mockup/`. No build step is needed. Open `mockup/index.html` in a browser to walk the screens. It performs no network calls and no generation.

### Project structure

```text
slide-first-ai-video/
├─ frontend/            React + Vite SPA
├─ mockup/              UI mockup, the source of truth for screens
├─ infra/               AWS CDK
│  ├─ src/main-stack.ts
│  └─ lib/              one construct per capability
├─ lambdas/
│  ├─ api/              REST API
│  ├─ slide-generator/  outline and narration via Bedrock
│  ├─ marp-render/      stage 1 rasterization and deck generation
│  ├─ polly-worker/     stage 2 speech synthesis
│  └─ caption-worker/   stage 3 captions
├─ packages/
│  ├─ shared-types/     types, runtime validation, S3 keys
│  └─ core/             shared logic
├─ config/              per environment configuration
└─ docs/                contract, cost, migration, architecture
```

### Documentation

| File | Contents |
| --- | --- |
| [docs/architecture.md](./docs/architecture.md) | Architecture and sequence diagrams, S3 layout |
| [docs/contract.md](./docs/contract.md) | The `manifest.json` data contract and its invariants |
| [docs/cost.md](./docs/cost.md) | How cost is measured, and cost allocation tags |
| [docs/migration.md](./docs/migration.md) | Migration notes from the previous architecture |
| [設計指示書_動画生成パイプライン.md](./設計指示書_動画生成パイプライン.md) | Implementation instructions for the video pipeline with verified measurements (Japanese) |
| [作業指示書_残作業.md](./作業指示書_残作業.md) | How to run the work, environment facts, completion criteria (Japanese) |
| [実装指示プロンプト.md](./実装指示プロンプト.md) | Full application specification (Japanese) |
