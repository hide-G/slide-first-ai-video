# Slide-First AI Video

> スライドを正本に、ナレーションと字幕つきの動画を生成するAWSアプリケーションです。生成AIでスライドを作る機能と、手持ちのPDFを動画化する機能は、それぞれ独立して使えます。
>
> An AWS application that turns slides into narrated, captioned videos. AI slide creation and PDF-to-video conversion are independent features.

[日本語](#japanese) | [English](#english)

---

<a id="japanese"></a>

## 日本語

### 何ができるか

| 機能           | 内容                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ② スライド作成 | 文章と参考URLから生成AIがスライドの骨子を作ります。利用者が確認・加筆修正してからMarpでスライドを生成し、Markdown、PDF、PowerPointを書き出します。 |
| ③ 動画作成     | PDFをアップロードし、ナレーションと字幕つきの動画にします。②を経由せず単独で使えます。PowerPointのアップロードは受け付けません。                   |

主な特徴です。

- **骨子をレビューしてから生成**: 生成AIの出力をそのまま採用せず、利用者が確定した文章だけをスライドにします。
- **画面の言語と資料の言語を分離**: 画面を英語表示にしたまま、日本語のスライドを作れます。
- **配信先に合わせた出力サイズ**: `16:9`、`9:16`、`1:1`、`4:5` を選べます。
- **縦長の字幕safe-area**: `9:16` または `4:5` の上寄せレイアウトでは、スライド下部の余白を字幕用に確保できます。位置はページ画像の実際の描画下端からサーバー側で算出します。
- **固定された焼き込み字幕スタイル**: `white-outline`、`yellow-outline`、`black-background`、`chalkboard` を選べます。`chalkboard` は縦長・上寄せ・safe-areaの組み合わせでだけ利用できます。
- **失敗工程からの再実行**: 互換な中間成果物がある場合は、失敗した`audio`、`captions`、`video`工程だけを再実行します。再利用できない場合は画面で`pages`からの再実行を明示します。
- **音声と映像を厳密に同期**: Polly PCMのバイト数から音声長を求め、フレーム境界に丸めてから動画にします。
- **読み方をSSMLで指定**: 英単語や固有名詞の読み、振り仮名、間を指定できます。
- **外部の実行ファイルを持ち込まない**: FFmpeg、ffprobe、LibreOffice、Dockerを使わず、AWSサービスとnpmパッケージだけで構成しています。

### アーキテクチャ

![Slide-First AI Video のアーキテクチャ図](./docs/assets/architecture.png)

高解像度版とベクター形式は [docs/assets/architecture.svg](./docs/assets/architecture.svg) にあります。画像は概念図です。実装上の正確な呼び出し関係は [docs/architecture.md](./docs/architecture.md) のシーケンス図を参照してください。

| 工程       | 実装                  | 出力                                   | 使う技術                                 |
| ---------- | --------------------- | -------------------------------------- | ---------------------------------------- |
| 1 pages    | `marp-render`         | `pages/page-NNN.png`                   | Chromium内のpdf.js、またはMarpの画像出力 |
| 2 audio    | `polly-worker`        | `audio/page-NNN.wav`                   | Amazon PollyのPCM出力とWAVヘッダ         |
| 3 captions | `caption-worker`      | `captions/captions.srt`                | 純粋なJavaScript                         |
| 4 video    | `mediaconvert-worker` | `output/{renderId}/page-001-video.mp4` | AWS Elemental MediaConvert               |

Step Functionsは4工程のLambdaを順番に呼びます。第4工程の`mediaconvert-worker`がMediaConvertジョブを作成し、`GetJob`をポーリングして終端状態を確認してからStep Functionsへ結果を返します。MediaConvertは最初のページ画像名と`-video`のName Modifierから出力名を決めるため、完成動画は通常`page-001-video.mp4`です。これはページ1だけの動画ではなく、全ページを連結した1本の動画です。

字幕を焼き込む場合は、SRTを最初のMediaConvert入力のCaption Selectorへ渡し、MP4出力の`BURN_IN` Caption Descriptionでレンダリングします。safe-areaのY座標はクライアント入力ではなく、工程1がPNGを描画した後に`manifest.output.captionSafeAreaYPosition`へ記録します。

実機の縦長・字幕safe-area検証結果は [設計指示書\_動画生成パイプライン.md](./設計指示書_動画生成パイプライン.md) に記録しています。

### 設計上の判断

| 一般的な選択                 | この構成での代替                            |
| ---------------------------- | ------------------------------------------- |
| FFmpegで動画を合成           | AWS Elemental MediaConvert                  |
| ffprobeで音声の長さを測る    | Polly PCM出力のバイト数から厳密に算出       |
| pdftoppmでPDFを画像化        | Chromium内のpdf.js                          |
| LibreOfficeでPPTXをPDFに変換 | 非対応。PowerPointからPDFで書き出してもらう |

### 制限事項

- **PowerPointのアップロードは非対応です。** PowerPointでPDFとして保存してからアップロードしてください。
- 書き出したPowerPointはテキスト編集用ではありません。Marpの仕様上、各ページは画像として貼り付けられます。
- 1つの動画で扱えるページ数は150までです。MediaConvertジョブの入力数上限に合わせています。
- `safe-area` は`9:16`または`4:5`かつ`verticalLayout: "top"`の焼き込み字幕にだけ指定できます。
- 費用の`actual`値は請求データの照合後に確定するものです。推定額と混同しません。

### 必要なもの

- Node.js 22（`.nvmrc`を参照）
- pnpm 10以降
- Bedrock、Polly、MediaConvertを利用できるAWSアカウント

### 使い方

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

インフラはAWS CDKです。`infra/cdk.json`の`app`は`node dist/bin/app.js`を指すため、CDKの前にビルドが必要です。`Code.fromAsset`が相対パスを使うため、CDKは`infra`ディレクトリから実行します。

```bash
pnpm build
cd infra
npx --yes aws-cdk@2 synth
npx --yes aws-cdk@2 diff
```

Windows PowerShellでは、リポジトリルートから固定のsynth手順を実行する補助スクリプトも使えます。

```powershell
powershell.exe -NoProfile -File .\scripts\invoke-cdk-synth.ps1
```

デプロイは既存スタックを更新する操作です。必ず差分を確認し、必要な承認を得てから実行してください。

### 画面モックアップ

実装の正本となる画面モックアップは`mockup/`にあります。ビルド不要で、`mockup/index.html`をブラウザで開くだけで画面遷移とUIを確認できます。通信や生成処理は行いません。

### プロジェクト構成

```text
slide-first-ai-video/
├─ frontend/                 React + ViteのSPA
├─ mockup/                   画面モックアップ
├─ infra/                    AWS CDK
│  ├─ src/main-stack.ts
│  └─ lib/                   機能単位のコンストラクト
├─ lambdas/
│  ├─ api/                   REST API
│  ├─ slide-generator/       Bedrockで骨子とナレーションを生成
│  ├─ marp-render/           工程1: ページ画像化とスライド生成
│  ├─ polly-worker/          工程2: 音声合成
│  ├─ caption-worker/        工程3: 字幕生成
│  └─ mediaconvert-worker/   工程4: MediaConvertジョブ作成と完了待機
├─ packages/
│  ├─ shared-types/          型、実行時バリデーション、S3キー
│  └─ core/                  共通ロジック
├─ config/                   環境別設定
└─ docs/                     契約、費用、移行、アーキテクチャ
```

### ドキュメント

| ファイル                                                                    | 内容                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------- |
| [docs/architecture.md](./docs/architecture.md)                              | 実装に対応したアーキテクチャ、シーケンス図、S3レイアウト |
| [docs/contract.md](./docs/contract.md)                                      | `manifest.json`、字幕safe-area、出力設定のデータ契約     |
| [docs/cost.md](./docs/cost.md)                                              | 推定額と実績額の区別、MediaConvert使用量、コスト配分タグ |
| [docs/migration.md](./docs/migration.md)                                    | 旧5工程から現行4工程への移行記録                         |
| [docs/kiro-powershell-cdk-synth.md](./docs/kiro-powershell-cdk-synth.md)    | PowerShellでCDK synthを固定コマンド化する補助手順        |
| [設計指示書\_動画生成パイプライン.md](./設計指示書_動画生成パイプライン.md) | 実装方針、実機検証の実測値、歴史的な調査記録             |
| [作業指示書\_残作業.md](./作業指示書_残作業.md)                             | 現行の作業手順と、過去の移行作業ログの位置付け           |
| [実装指示プロンプト.md](./実装指示プロンプト.md)                            | 現行4工程に合わせた実装指示                              |

---

<a id="english"></a>

## English

### What it does

| Feature        | Description                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Slide creation | AI drafts a slide outline from text and reference URLs. The user reviews it before Marp generates Markdown, PDF, and PowerPoint exports. |
| Video creation | Upload a PDF and create a narrated, captioned video without using slide creation. PowerPoint upload is intentionally unsupported.        |

Highlights:

- Output profiles: `16:9`, `9:16`, `1:1`, and `4:5`.
- The vertical top layout can reserve lower safe-area space for captions on `9:16` and `4:5` video.
- Burn-in captions use fixed presets: `white-outline`, `yellow-outline`, `black-background`, and `chalkboard`. The chalkboard preset requires the vertical safe-area layout.
- When compatible intermediate outputs exist, a failed `audio`, `captions`, or `video` stage can be retried without restarting pages. The UI explicitly offers a pages restart when reuse is unavailable.
- Polly PCM byte length is used to compute audio duration before frame alignment.
- No FFmpeg, ffprobe, LibreOffice, or Docker is used.

### Architecture

The conceptual diagram is shown above. The implementation flow is authoritative in [docs/architecture.md](./docs/architecture.md).

| Stage      | Implementation        | Output                                 | Technology                              |
| ---------- | --------------------- | -------------------------------------- | --------------------------------------- |
| 1 pages    | `marp-render`         | `pages/page-NNN.png`                   | pdf.js in Chromium or Marp image export |
| 2 audio    | `polly-worker`        | `audio/page-NNN.wav`                   | Amazon Polly PCM with a WAV header      |
| 3 captions | `caption-worker`      | `captions/captions.srt`                | Pure JavaScript                         |
| 4 video    | `mediaconvert-worker` | `output/{renderId}/page-001-video.mp4` | AWS Elemental MediaConvert              |

Step Functions invokes the four Lambda stages. `mediaconvert-worker` creates the MediaConvert job, polls `GetJob` to its terminal state, and returns the result to the state machine. MediaConvert derives the typical final filename, `page-001-video.mp4`, from the first input image and the `-video` Name Modifier. The file is the combined video, not only page 1.

For burn-in captions, the SRT is attached to the first MediaConvert input and rendered with a `BURN_IN` Caption Description. The page-rendering stage calculates the safe-area Y coordinate after it knows the actual content boundary; the browser cannot submit that runtime-only value.

### Constraints and local development

- Upload PDF, not PowerPoint. Export PDF from PowerPoint first.
- A video has at most 150 pages, matching the MediaConvert input limit.
- `safe-area` is valid only for burn-in captions with `9:16` or `4:5` and `verticalLayout: "top"`.
- Build before CDK synth because `infra/cdk.json` runs `node dist/bin/app.js`.

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
cd infra
npx --yes aws-cdk@2 synth
```

See the Japanese documents linked above for the precise contract, E2E measurements, operational guidance, and migration history.
