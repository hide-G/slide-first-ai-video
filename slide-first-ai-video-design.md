# スライド起点の生成AI動画アプリ設計書

- 仮称：SlideCast on AWS
- 文書バージョン：1.0
- 作成日：2026-08-05
- 設計方針：**生成AIで作ったLTスライドを正本とし、Amazon Pollyの読み上げ、字幕、演出を追加してMP4も生成する**
- 動画レンダラー候補：[Hyperframes](https://github.com/heygen-com/hyperframes)

## 1. 結論

Hyperframesは本アプリの動画レンダラーとして有力であり、第一候補にする。ただしHyperframesにスライドそのものを再設計させるのではなく、次の責務分担とする。

- **Amazon Bedrock / AgentCore**：LTの構成、Marp Markdown、発表者ノートを生成する。
- **Marp CLI**：同じMarkdownからPDF、PPTX、HTML、スライド別PNGを生成する。
- **Amazon Polly**：各スライドの発表者ノートを読み上げ、音声とspeech marksを生成する。
- **Hyperframes**：スライドPNG、Polly音声、字幕、トランジションを時間軸に配置し、動画をレンダリングする。
- **AWS Lambda + Step Functions + S3**：HyperframesをAWSアカウント内で分散実行する。
- **AWS Elemental MediaConvert**：必要な場合だけ、最終的な配信用トランスコードや複数品質の生成に使う。

重要な判断は次の2点である。

1. **Marp Markdownがコンテンツの正本**であり、動画用HTMLや動画Manifestは派生物とする。
2. Hyperframesの`/slideshow`機能は使わない。公式ガイドではインタラクティブなデッキ全体を線形MP4へ直接書き出せないため、スライド画像を入力とする**通常の動画コンポジション**を生成する。

この構成により、1つの承認済みスライド資産から、登壇用成果物、音声付きフル動画、X向け短尺動画を一貫して生成できる。

## 2. 目標

### 2.1 プロダクト目標

エンジニアがテーマやURLを入力すると、次の成果物をまとめて取得できるアプリを作る。

1. LT登壇用のMarp Markdown
2. PDF
3. PPTX
4. HTMLスライド
5. Amazon Pollyによる音声付きフル動画
6. 字幕付きのX向け短尺動画
7. X投稿文と出典一覧

### 2.2 「Xでバズりやすい」の扱い

動画形式だけでバズを保証することはできない。本アプリでは、バズを保証するのではなく、視聴されやすい条件を生成工程へ組み込む。

- 最初の1～2秒に問題提起または結論を表示する。
- 無音でも理解できる大きな字幕を付ける。
- X向け短尺版は30～60秒を標準とする。
- 1シーン1メッセージにする。
- タイトルスライドを長時間表示せず、内容へ早く入る。
- フック、サムネイル、投稿文を各3案生成する。
- フルLT動画とは別に、重要スライドだけを選んだ短尺版を作る。
- 出典ページへのリンクを投稿文へ含められるようにする。

### 2.3 非目標

- Marpを廃止して動画専用フォーマットへ置き換えること
- 生成AIにLTとは別の動画コンテンツを一から作らせること
- 初期版でXへの自動投稿まで行うこと
- 権利不明の画像、音楽、人物音声を自動取得すること
- 映画品質の長尺映像編集を提供すること

## 3. 本アプリの独自価値

本アプリは、Marp Markdownを単一の正本として、登壇用スライドと配信用動画を一貫して生成する。

- **単一ソース**：同じMarp MarkdownからPDF、PPTX、HTML、スライド画像、MP4を生成する。
- **発表者ノートの活用**：各スライドのpresenter notesをAmazon Pollyの読み上げ原稿として使用する。
- **同期字幕**：Polly speech marksから字幕の表示時刻を生成し、無音でも理解できる動画にする。
- **用途別動画**：全スライドを使うフルLT動画と、承認済みスライドを選んだ30～60秒のX向け短尺動画を出力する。
- **決定的な演出**：Hyperframesでトランジション、ズーム、字幕をフレーム時刻に基づいて配置する。
- **部分再生成**：スライド全体を作り直さず、1枚の音声、字幕、動画区間だけを更新できるようにする。
- **成果物の一貫性**：スライド、音声、動画、投稿文を同じdeckVersionへ関連付け、内容の食い違いを防ぐ。

中心価値は、**登壇に使えるスライドとSNSで視聴できる動画を、同じ承認済みソースから作ること**にある。

### 3.1 実装原則

- 要件、命名、データモデル、API、UI文言、プロンプト、テーマを本アプリ向けに定義する。
- AWSサービスと採用OSSの公式仕様および公開APIを実装根拠とする。
- 採用OSSのライセンス条件を確認し、必要なライセンス文書と帰属表示を保持する。

## 4. プロジェクト計画

本プロジェクトは3つのトラックで進める。3トラックは競合せず、同一のコア実装を共有する。

| トラック | 内容 | 位置づけ | 前提 |
|---|---|---|---|
| T1 | 完全な自作アプリとして実現する | 本命。所有権と設計判断を自分に残す | なし |
| T2 | 動画部分だけを切り出し、Spec-Driven Presentation Makerへ提案する | 外部実績づくり。採否は相手の判断 | T1のPhase 0 |
| T3 | 源内AIアプリAPI仕様に準拠し、T1の機能を再現する | 公的基盤へ接続可能な実装という位置づけ | T1のPhase 1 |

### 4.1 トラック間で共有するコア

3トラックの違いは、入力の受け取り方と結果の返し方だけである。動画を作る処理は1つに保つ。

```text
配信アダプタ（トラックごとに差し替え）
  ├─ T1：自作Web UIと独自REST API
  ├─ T2：上流ツールのツール境界に合わせた最小インターフェース
  └─ T3：源内AIアプリAPI（/requests、/status/{id}、progress、artifacts）
                    │
                    ▼
共通コア（配信経路に依存しない）
  入力アダプタ    Marp Markdown / PPTX / PDF / スライド画像
  原稿抽出        発表者ノートまたは指定テキスト
  音声生成        Amazon Polly（音声とspeech marks）
  字幕生成        speech marksから字幕とVTT/SRT
  尺の確定        実測した音声長からスライド開始時刻を算出
  合成            コンポジション生成とレンダリング
  出力            MP4（フル尺と短尺）
```

この分離を設計の前提とする。コアは配信プロトコルを知らず、アダプタが仕様差を吸収する。トラックを増やしてもコアは変更しない。

### 4.2 トラック1：完全な自作アプリとして実現する

**目的**：本設計書の全機能を自分の実装として完成させる。所有権、設計判断、公開の主導権を保持する。

**スコープ**：本設計書に記載する全範囲。入力から動画出力、品質保証、監視、コストまで。

**成果物**

- 自作リポジトリ（IaCを含む）
- フルLT動画（16:9、音声と字幕つき）
- X向け短尺動画
- 本アプリ自身で生成した紹介動画

**完了条件**

- 承認済みスライドから、同一内容のPDF、PPTX、音声付きMP4を取得できる
- 本アプリの紹介動画を本アプリ自身で生成できる

**優先度**：最優先。T2とT3の前提となる。

### 4.3 トラック2：動画部分を切り出してSpec-Driven Presentation Makerへ提案する

**対象**：[aws-samples/sample-spec-driven-presentation-maker](https://github.com/aws-samples/sample-spec-driven-presentation-maker)（MIT-0、Python、CDK）

**調査で確認した事実**

- 開発が活発で、リリース間隔が短い
- 直近40件のPRのうち、人間によるPRは単一メンテナのものだけで、外部コントリビューターのPRは確認できなかった
- 一方で外部Issueには応答実績がある

**受け入れ要件**（同リポジトリのCONTRIBUTING.mdより）

- `make all`（ruffとpytest）を通す
- AWS Automated Security Helperを`--fail-on-findings`で通す
- Conventional Commitsに従う
- 全public関数にdocstringと型ヒントを付ける
- ファイル冒頭にAmazonの著作権表記とSPDX識別子`MIT-0`を記載する
- ビジネスロジックは`sdpm/sdpm/`のエンジン層へ集約する

**進め方**：大型の機能PRを最初に出さない。3段階で進める。

1. 既存の未修正バグに対する小さなPRを出す。着手前にIssueへ意思表明する
2. 動画エクスポートを機能提案Issueとして出す。ユースケース、スコープ、非スコープ、外部依存、運用コストへの影響を明記する
3. 合意が得られた場合のみ実装PRを出す。得られない場合は外部サービス連携としてT1側に留める

**スコープの制約**：FFmpegとヘッドレスブラウザを持ち込むと、上流の運用コストとセキュリティスキャンの範囲が変わる。提案は「生成済みのPPTXまたはPDFを外部の動画化サービスへ渡す薄い連携」に絞る。

**完了条件**：マージされたPRが1件以上ある、または動画機能の提案Issueが記録されている。

**明記事項**：PRの採否は相手の判断である。本プロジェクトの成否をT2に依存させない。

### 4.4 トラック3：源内AIアプリAPI仕様に準拠してT1の機能を再現する

**対象**：源内（デジタル庁が開発・運用する生成AI利活用基盤）。AIアプリは源内Webと独立した環境で構築し、GUI操作で登録する方式が採られている。

**準拠する仕様**：源内WebのAIアプリAPI仕様。仕様には2026年3月時点のものであり今後変わる可能性があるとの注記がある。

**実装要件**

| 項目 | 仕様 |
|---|---|
| 認証 | `x-api-key`ヘッダー |
| ネットワーク | 源内Web側の外部アプリ用IPアドレスのみ許可するIP制限 |
| 入力フォーム | リクエスト形式JSONで定義し、利用者向け画面は自動生成される |
| 利用コンポーネント | `file`（`accept`、`multiple`、`max_size`、`max_file_count`）、`select`、`radio`、`textarea`、`hidden` |
| リクエスト | `inputs`でラップする。ファイルはBase64 |
| 非同期の起動 | `POST .../requests`。登録時はエンドポイント末尾に`/requests/`を付す |
| 受付レスポンス | `202 Accepted`、`request_id`、`status`、`status_url` |
| 進捗確認 | `GET /status/{request_id}` |
| 状態 | `PENDING` / `IN_PROGRESS` / `COMPLETED` / `ERROR` |
| 進捗表示 | `progress`に進捗文字列を入れる |
| 完了時 | `outputs`（Markdown可）と`artifacts`（`contents`はBase64、`display_name`） |
| 失敗時 | `error.message`と`error.details` |

**注意**：`max_size`はBase64変換後の値で検証される。入力上限の設計はこの前提で行う。

**設計判断：成果物を2経路に分ける**

`artifacts`はBase64であるため、フル尺1080pのMP4を載せることは現実的でない。次のとおり分離する。

- X向け短尺（30〜60秒、低ビットレート）は`artifacts`に載せる
- フルLT動画は`outputs`のMarkdownへ期限付きダウンロードリンクとして記載する

**状態の対応付け**

| 本設計書の状態 | 仕様の`status` | `progress`の例 |
|---|---|---|
| SLIDE_GENERATING | IN_PROGRESS | 構成を生成しています |
| SLIDE_RENDERING | IN_PROGRESS | スライド画像を生成しています 4/12 |
| VOICE_GENERATING | IN_PROGRESS | 音声を合成しています 7/12 |
| COMPOSITION_BUILDING | IN_PROGRESS | 合成の準備をしています |
| VIDEO_RENDERING | IN_PROGRESS | 動画をレンダリングしています 40% |
| VIDEO_QA | IN_PROGRESS | 出力を検査しています |
| COMPLETED | COMPLETED | 完了しました |
| FAILED | ERROR | 該当なし |

仕様にキャンセル状態は定義されていない。`CANCELLED`は`ERROR`として返し、`error.message`で理由を示す。

**プロトコル層の分離**：仕様が変更中であるため、アダプタとして独立させ、適合テストを用意する。参照した仕様の版を記録し、差分が出た時点でアダプタのみを更新する。

**ライセンスと引用**：源内のソフトウェアはMIT、ドキュメントはCC BY 4.0で公開されている。仕様文書を引用する場合は帰属表示を行う。

**貢献方針**：源内のリポジトリはPull Requestを受け付けていない。Issueも致命的な問題に限定されている。本トラックでは自環境での準拠実装のみを行い、本体への変更提案は行わない。

**完了条件**：自AWS環境へデプロイした準拠実装が、仕様どおりのリクエストとレスポンスで動作し、登録手順に必要な出力（エンドポイントとAPIキー）を提供できること。実際の源内環境への登録は管理者権限と対象チームを持つ主体の判断に依るため、本計画の完了条件には含めない。

### 4.5 実施順序とゲート

```text
ゲート1：T1 Phase 0（技術検証）完了
   └→ T2 Step 1（小さなPR）を並行開始できる

ゲート2：T1 Phase 1（フル動画のE2E）完了
   ├→ T2 Step 2（動画機能の提案Issue）を開始できる
   └→ T3（源内準拠アダプタの実装）を開始できる
```

動画が実際に動く前に外部へ提案しない。実物のない提案は説得力を持たないためである。

### 4.6 トラック別リスクと対応

| トラック | リスク | 対応 |
|---|---|---|
| T1 | スコープ拡大で完了しない | Phase 0とPhase 1の完了条件を固定し、9:16と演出強化を後段へ回す |
| T2 | 大型PRが受け入れられない | 先にIssueで合意形成し、実装は合意後に行う |
| T2 | 上流の変更速度が速くコンフリクトする | 変更範囲を小さく保ち、フォークを頻繁に同期する |
| T3 | 仕様が変更される | プロトコルをアダプタへ隔離し、適合テストと仕様の版管理を行う |
| T3 | `artifacts`のサイズ上限に収まらない | 短尺は`artifacts`、フル尺は期限付きリンクの2経路にする |
| T3 | 自分では源内環境へ登録できない | 完了条件を自環境での仕様適合検証に置く |
| 共通 | コアが配信経路に依存して再利用できない | 配信アダプタとコアの境界をレビュー項目に含める |
| 共通 | 出自を誤解される | 参照した公開実装と準拠仕様を謝辞として明記する |

## 5. 技術選定

### 5.1 動画レンダラー比較

| 候補 | 長所 | 短所 | 判定 |
|---|---|---|---|
| Hyperframes | HTML/CSS起点、エージェント向け、決定的レンダリング、音声・字幕、AWS Lambda対応、Apache 2.0 | 新しいプロジェクト、Marp直接入力なし、API変更リスク | **第一候補** |
| Remotion | React/TypeScript、実績とLambda基盤が成熟、フレーム制御が明示的 | Reactへの変換が必要、独自ライセンスの確認が必要 | 代替候補 |
| FFmpegのみ | 安定、軽量、自由度が高い | HTML演出、字幕アニメーション、プレビューUIを自作 | フォールバック |
| MediaConvertのみ | AWSマネージド、配信用変換に強い | HTML/CSSを描画できず、動的スライド演出には不向き | 最終変換のみ |
| Marp画像 + 単純FFmpeg | 最小構成でPoCが速い | 演出と編集性が弱い | Phase 0の検証用 |

### 5.2 Hyperframes採用判断

Hyperframesは、HTML、CSS、メディア、シーク可能なアニメーションをヘッドレスChromeでフレームごとに取得し、FFmpegでMP4へ変換する。今回の入力はMarpから生成したHTMLまたはPNGであり、Web技術との相性が良い。

採用理由：

- AIエージェントが生成しやすいプレーンHTMLを使う。
- `<audio>`と時間属性でPolly音声を配置できる。
- 字幕、チャート、トランジション用のCatalogがある。
- 同じ入力から同じフレームを生成する決定性を重視している。
- `@hyperframes/aws-lambda`がStep Functions、Lambda、S3による分散レンダリングを提供する。
- CDK Constructがあり、既存AWSアプリへ統合できる。
- Apache License 2.0で、レンダリング回数に応じたソフトウェア利用料がない。

注意点：

- Hyperframesのプレゼンテーション機能は、現時点でデッキ全体を1本の線形MP4へ直接エクスポートできない。
- Marpを認識する専用アダプターは確認できない。このためMarp CLIのPNG出力を正式な境界にする。
- 調査時点の`@hyperframes/cli`と`@hyperframes/aws-lambda`は`0.7.92`であり、まだ1.0未満である。採用時はnpm公開版を確認し、完全一致バージョンで固定する。
- Lambda版はNode.js 22以上、Chromium、FFmpegを使用する。
- AWS Lambdaレンダリングは現時点でSDRのみであり、完了Webhookはない。
- 新しいプロジェクトなので、最初に1本の実動画で画質、音声同期、日本語フォント、コストを検証する。

### 5.3 採用する構成

```text
Marp Markdown
  ├─ PDF / PPTX / HTML         Marp CLI
  ├─ slide-001.png ...         Marp CLI --images png
  ├─ presenter-notes.txt       Marp presenter notes
  └─ video-manifest.json       スライド番号と動画設定
              │
              ├─ voice-001.mp3          Amazon Polly
              ├─ speech-marks-001.json  Amazon Polly
              ├─ captions.json          字幕変換Lambda
              └─ index.html             Hyperframes composition builder
                         │
                         └─ MP4           Hyperframes on AWS Lambda
```

## 6. 正本となるスライド仕様

### 6.1 Marp Markdown

スライド生成・検証処理は、次を生成する。

- 完全なMarp Markdown
- 各スライドのMarpit presenter notes
- スライドごとの重要度
- 短尺動画への採用候補
- 読み上げ禁止の出典URLや補足情報

発表者ノートには、そのスライドを実際に登壇で説明するときの自然な口調を記載する。スライド上の文をそのまま読み上げない。

### 6.2 スライド品質ルール

- 16:9を標準とする。
- 1枚につき1つの主張を置く。
- X動画でも読めるよう、本文の文字量を減らす。
- コードは重要行だけに絞り、動画ではハイライト位置を指定する。
- 数値や最新情報には出典を持たせる。
- 画像内に細かい文字を入れない。
- タイトル、本文、コード、出典で最小フォントサイズを定める。
- PDF/PPTXと動画で同じテーマCSSと日本語フォントを使う。

### 6.3 Marpから画像への変換

Marp CLIはスライドごとのPNG出力を公式にサポートする。

```bash
marp --images png --image-scale 2 deck.md
```

出力例：

```text
deck.001.png
deck.002.png
deck.003.png
```

MVPではPNGを動画レンダラーへ渡す。これにより、PDF/PPTXと動画でレイアウトが変わる問題を避けられる。

将来、箇条書きやコードを要素単位でアニメーションさせる場合は、Marp HTMLを解析してHyperframes DOMへ移す「DOMモード」を追加する。ただしPNGモードを常に残し、表示の忠実性を保証する。

## 7. 動画Manifest

Marpが内容の正本であり、`video-manifest.json`は動画に必要な時間情報だけを保持する。

```json
{
  "schemaVersion": "1.0",
  "deckId": "deck_01",
  "deckVersion": 3,
  "locale": "ja-JP",
  "fullVideo": {
    "width": 1920,
    "height": 1080,
    "fps": 30
  },
  "slides": [
    {
      "slideNumber": 1,
      "imageKey": "slides/deck.001.png",
      "presenterNote": "今日は、生成AIの弱点を補う新しいWeb検索機能を紹介します。",
      "voiceKey": "audio/slide-001.mp3",
      "speechMarksKey": "audio/slide-001-marks.json",
      "durationMs": 6200,
      "transition": "fade",
      "importance": "HIGH",
      "includeInXTeaser": true
    }
  ]
}
```

`durationMs`はLLMの推測値ではなく、Pollyの音声または最終speech markを基準に決定し、前後に短い余白を加える。

## 8. Amazon Polly設計

### 8.1 音声生成

各スライドのpresenter notesをSSMLへ変換し、同じVoice、Engine、Textで2回呼び出す。

1. MP3またはPCM音声を生成する。
2. JSON形式のword、sentence、ssml speech marksを生成する。

speech marksは音声の代わりに返るため、1回の呼び出しで音声と時刻情報を同時取得する前提にしない。

### 8.2 音声選択

- `DescribeVoices`で日本語とEngineの対応を実行時に確認する。
- 音声名やEngineをコードに固定しない。
- speech marksに対応するニューラル、ロングフォーム、標準エンジンから選ぶ。
- ユーザーが声、速度、間を試聴してから最終動画を生成できるようにする。
- AWS固有名詞やサービス名はLexiconまたはSSMLの`phoneme`で補正する。
- 読み上げ速度を上げすぎず、原稿を短くすることで尺を調整する。

### 8.3 字幕

speech marksを日本語の意味単位へまとめ、Hyperframes用字幕JSONを作る。

- 1字幕は原則1～2行。
- 1行の文字数上限を設定する。
- 助詞の直前など不自然な位置で改行しない。
- 音声より先に字幕を消さない。
- 重要語だけ色または太字相当で強調する。
- スライドの重要部分を隠さない位置へ配置する。
- 無音再生でも理解できるか確認する。

## 9. Hyperframesコンポジション設計

### 9.1 生成方式

`CompositionBuilderFunction`が、スライド画像と音声情報からHyperframes用の`index.html`を生成する。

概念例：

```html
<div
  id="stage"
  data-composition-id="lt-full"
  data-start="0"
  data-width="1920"
  data-height="1080"
  data-fps="30"
>
  <img
    class="clip slide"
    data-start="0"
    data-duration="6.2"
    data-track-index="0"
    src="assets/deck.001.png"
  />
  <audio
    data-start="0"
    data-duration="6.2"
    data-track-index="1"
    src="assets/slide-001.mp3"
  ></audio>
</div>
```

実装では全スライドの開始秒を累積計算し、字幕レイヤー、トランジション、ロゴを追加する。

### 9.2 演出方針

スライドを見せることが主目的なので、演出は内容を邪魔しない範囲に限定する。

- スライド切替時の短いfadeまたはpush
- 静止画にごく弱いズーム
- コードスライドの注目行を枠で強調
- 重要語に同期した字幕ハイライト
- 章の切替だけ軽いサウンドエフェクト
- 冒頭1～2秒のフックテキスト
- 最後にスライドURLまたはアプリ名を表示

すべての動きはフレーム時刻から決まり、wall clock依存のアニメーションを避ける。

### 9.3 生成する動画

#### フルLT動画

- 全スライドを順番に使用
- 16:9、1080p、30fps
- presenter notesをすべて読み上げる
- PDF/PPTXと同じ内容
- 数分程度の技術解説を想定

#### X向け短尺動画

- `importance=HIGH`のスライドから3～6枚を選ぶ
- 30～60秒
- 冒頭にフックを追加
- presenter notesを短尺用に短縮するが、主張は変更しない
- まず16:9版を正式出力とする
- 必要に応じて9:16版も作る

9:16版では16:9スライドを単純クロップしない。上部にスライド全体、下部に拡大した要点と字幕を置く「slide card」レイアウトを使う。元スライドを出発点としつつ、モバイルで読める情報量にする。

## 10. AWSアーキテクチャ

```mermaid
flowchart LR
    U[ユーザー] --> WEB[Amplify Hosting\nReact]
    WEB --> AUTH[Amazon Cognito]
    WEB --> API[Amazon API Gateway]
    API --> PROJECT[Project API Lambda]
    PROJECT --> DDB[(DynamoDB)]
    PROJECT --> S3[(S3 Project Bucket)]
    PROJECT --> GEN[Content State Machine]

    GEN --> AGENT[Bedrock AgentCore Runtime]
    AGENT --> BR[Amazon Bedrock]
    AGENT --> SEARCH[AgentCore Gateway Web Search]
    GEN --> MARP[Marp Render Lambda\nContainer Image]
    MARP --> S3
    GEN --> VOICE[Polly Worker Lambda]
    VOICE --> POLLY[Amazon Polly]
    POLLY --> S3
    GEN --> BUILD[Composition Builder Lambda]
    BUILD --> S3

    GEN --> HF[Hyperframes Render State Machine]
    HF --> HFL[Hyperframes Render Lambda\nplan / renderChunk / assemble]
    HFL --> S3

    S3 --> MC[AWS Elemental MediaConvert\nOptional]
    MC --> S3
    S3 --> CDN[CloudFront Signed URL]
    CDN --> U

    CW[CloudWatch / X-Ray / CloudTrail] -.-> GEN
    CW -.-> HF
```

### 10.1 AWSサービスの責務

| サービス | 責務 |
|---|---|
| Amplify Hosting | React UIの配信 |
| Cognito | ログインとユーザー識別 |
| API Gateway | Project、Job、Download API |
| AgentCore Runtime | 対話、検索、Marp生成、修正 |
| Bedrock | LT構成、スライド、発表者ノート、短尺要約 |
| AgentCore Gateway Web Search | 最新情報と出典の取得 |
| Lambda | Marp変換、Polly連携、字幕、Composition生成 |
| Polly | 読み上げ音声とspeech marks |
| Step Functions Standard | 生成工程とHyperframes分散レンダリング |
| S3 | Markdown、PNG、音声、字幕、中間チャンク、MP4 |
| DynamoDB | Project、Version、Job、利用枠、冪等性 |
| Hyperframes Lambda adapter | Plan、RenderChunk、Assemble |
| MediaConvert | 任意の配信用変換、派生品質、サムネイル |
| CloudFront | 期限付き成果物配信 |
| CloudWatch / X-Ray / CloudTrail | メトリクス、トレース、監査 |

カスタムLambdaはTypeScript / Node.jsとAWS SDK for JavaScript v3で実装し、Marp変換とHyperframesを含めて本番と同じ技術スタックで検証する。Bedrockのテキスト生成は原則Converse APIを使い、すべての呼び出しで`maxTokens`を用途に合わせて明示する。モデルIDとInference Profileはデプロイ対象リージョンで確認し、未検証のIDをコードへ固定しない。

### 10.2 Hyperframes AWS Lambda構成

`@hyperframes/aws-lambda`のCDK Constructを使用する。SAM CLIに依存するデプロイ経路ではなく、アプリ全体のCDK TypeScriptへ統合する。

Hyperframesの状態機械は次の処理を行う。現行adapterはPlan、RenderChunk、Assembleごとに別Lambdaを作るのではなく、**1つのLambda関数がイベントの`Action`に応じて3処理を振り分ける**。RenderChunk段階では、同じ関数をStep FunctionsのMapから並列呼び出しする。

```text
Plan action
  -> Map(RenderChunk action 1..N)
  -> Assemble action
  -> S3へfinal.mp4
```

初期設定：

- Lambda Memory：1080p検証では10,240 MBを開始候補とする。
- Lambda Timeout：各チャンク15分以内。
- Reserved Concurrency：PoCは2～4、負荷試験後に調整する。
- Step Functions：Standard。
- Render bucket：Block Public Access、暗号化、ライフサイクル設定。
- Plan protocol：新規統合ではv2。
- バージョン：`@hyperframes/aws-lambda`とproducerを同じ完全一致バージョンに固定する。
- 出力：MP4、1080p、30fps、SDR。

Hyperframesの状態機械実行ARNをProject Jobへ保存する。完了Webhookがない制限は、Step Functions Execution Status ChangeをEventBridgeで受けてProjectへ反映することで補う。

## 11. 処理フロー

### 11.1 スライド生成

1. ユーザーがLTテーマ、対象者、持ち時間、URLを入力する。
2. AgentCoreが必要な情報をWeb Searchで調べる。
3. BedrockがMarp Markdownとpresenter notesを生成する。
4. スライド検証処理がMarkdown構造、枚数、文字量、ノートの有無を検証する。
5. `deck.md`をS3へ保存し、DynamoDBへVersionを登録する。
6. プレビューを表示し、ユーザーが修正・承認する。

### 11.2 動画生成

1. 承認済み`deck.md`を読み込む。
2. Marp CLIでPDF、PPTX、HTML、スライド別PNGを生成する。
3. presenter notesをスライド番号ごとに抽出する。
4. Pollyでスライド別音声とspeech marksを生成する。
5. speech marksから字幕JSONを生成する。
6. 実際の音声時間から各スライドの開始時刻と長さを計算する。
7. Hyperframesの`index.html`とassetsを生成する。
8. Hyperframes Lambdaへプロジェクトをstageする。
9. Hyperframes Render State Machineを開始する。
10. Lambda Mapでフレームチャンクを並列生成する。
11. 同じHyperframes LambdaのAssemble actionが音声をミックスし、MP4をS3へ保存する。
12. 必要な場合はMediaConvertで配信用派生ファイルを生成する。
13. 自動QA後、CloudFront署名URLを返す。

### 11.3 短尺版生成

1. Bedrockがスライドを重要度順に評価する。
2. ユーザーへ採用スライドと短縮原稿を提示する。
3. 承認後、短尺用Polly音声を生成する。
4. 同じスライドPNGから別のHyperframes Compositionを作る。
5. フック、字幕、CTAを追加してMP4へ出力する。

短尺版でもスライドの事実や結論を変更せず、説明の範囲だけを絞る。

## 12. 状態管理

```text
DRAFT
  -> SLIDE_GENERATING
  -> SLIDE_READY
  -> SLIDE_APPROVED
  -> SLIDE_RENDERING
  -> VOICE_GENERATING
  -> COMPOSITION_BUILDING
  -> VIDEO_RENDERING
  -> VIDEO_QA
  -> COMPLETED

処理中 -> FAILED | CANCEL_REQUESTED | CANCELLED
VIDEO_QA -> COMPLETED | NEEDS_REVISION
```

動画生成前に`SLIDE_APPROVED`を必須にする。これにより、スライド修正のたびにPollyと動画レンダリング費用が発生することを防ぐ。

## 13. API概要

| Method | Path | 用途 |
|---|---|---|
| POST | `/v1/projects` | Project作成 |
| POST | `/v1/projects/{id}/slides` | スライド生成開始 |
| GET | `/v1/projects/{id}/versions/{version}` | Markdownとプレビュー取得 |
| POST | `/v1/projects/{id}/versions/{version}/approve` | スライド承認 |
| POST | `/v1/projects/{id}/videos` | フル動画生成 |
| POST | `/v1/projects/{id}/videos/teaser` | X短尺動画生成 |
| GET | `/v1/jobs/{jobId}` | 進捗、段階、エラー取得 |
| POST | `/v1/jobs/{jobId}/cancel` | キャンセル要求 |
| POST | `/v1/projects/{id}/slides/{number}/voice` | 1枚の音声再生成 |
| POST | `/v1/projects/{id}/videos/{videoId}/rerender` | 動画再レンダリング |
| GET | `/v1/projects/{id}/deliverables` | PDF、PPTX、MP4等の一覧 |

変更系APIは`Idempotency-Key`を受け取り、同一操作の二重実行を防ぐ。大きいファイルをAPI Gateway経由で返さず、S3 presigned URLまたはCloudFront署名URLを使う。

## 14. S3構造

```text
s3://slidecast-projects/{userId}/{projectId}/
  source/
  versions/v0001/deck.md
  versions/v0001/deck.pdf
  versions/v0001/deck.pptx
  versions/v0001/slides/deck.001.png
  versions/v0001/slides/deck.002.png
  versions/v0001/audio/slide-001.mp3
  versions/v0001/audio/slide-001-marks.json
  versions/v0001/captions/captions.json
  versions/v0001/video/video-manifest.json
  versions/v0001/video/hyperframes/index.html
  versions/v0001/output/lt-full-16x9.mp4
  versions/v0001/output/x-teaser-16x9.mp4
  versions/v0001/output/x-teaser-9x16.mp4
```

ソース、派生物、中間物、最終物をプレフィックスで分離する。中間チャンクと古いプレビューには短いライフサイクルを設定し、承認済みMarkdownと最終成果物は保持する。

## 15. セキュリティ

- Cognitoの`sub`とProject所有者をAPIごとに照合する。
- S3 Block Public AccessとCloudFront OACを使用する。
- Lambdaごとに役割を分け、Projectプレフィックスだけを許可する。
- HyperframesではStep Functions実行ロールとLambda実行ロールを分離し、相互に必要な操作だけを許可する。
- Bedrockのモデル権限を採用モデルに限定する。
- Bedrock Guardrailsは次の3方式を目的別に使う。
  - `ApplyGuardrail`：ユーザー入力、アップロード資料、検索結果をモデル呼び出し前に検査する。
  - `guardrailConfig`：Converseの入力と出力全体を包括的に検査する。
  - `guardContent`：信頼済みシステム指示を除外しつつ、ユーザー入力、検索結果、ツール結果などすべての未信頼コンテンツを選択的に検査する。
- 本番Guardrailは番号付きバージョンを固定し、traceを無効にする。IAM条件で必須Guardrailを外せないようにする。
- PIIマスキング後もモデル呼び出しログに元入力が残る可能性を考慮し、機密用途では呼び出しログを無効化するかKMS暗号化、アクセス制御、短い保持期間を設定する。
- Web検索結果は未信頼入力として扱い、プロンプト命令として実行しない。
- URL、MIME、ファイルサイズ、ページ数、Markdown HTMLを検証する。
- ユーザーが許可した素材だけを動画へ含める。
- ログへ原稿全文、音声データ、JWTを出力しない。
- CloudWatch Logsの保持期間を明示する。
- CloudTrailでBedrock、Step Functions、Lambda、S3操作を監査する。
- Apache 2.0のLICENSEと必要な帰属表示を配布物・リポジトリへ保持する。

## 16. 信頼性と冪等性

- Step Functions Standardを使う。
- State間で音声や画像を渡さず、S3キーだけを渡す。
- 実行名を`projectId-version-outputType`にする。
- 音声キーへ原稿、Voice、Engineのハッシュを含める。
- スライド画像キーへMarkdownとテーマのハッシュを含める。
- Hyperframes siteIdはcontent-addressed uploadを利用する。
- 同じ入力の再レンダリングでは既存素材を再利用する。
- 一時的なスロットリングだけ指数バックオフで再試行する。
- 検証エラー、権限エラー、Guardrail拒否は自動再試行しない。
- HyperframesのproducerとLambda ZIPのバージョン不一致をデプロイ時に検出する。
- 失敗したMap処理と最終失敗イベントをDLQへ送る。

## 17. 品質保証

### 17.1 自動検査

- Marpのスライド枚数、行数、はみ出し
- presenter notesの欠落
- 発表時間に対する原稿量
- PNGの解像度と欠落
- Polly音声とspeech marksの対応
- 字幕の1行文字数、表示時間、重なり
- 音声ファイルの無音、クリップ、長さ
- Hyperframes `lint`と`check`
- 先頭、中間、末尾フレームのスナップショット比較
- MP4のcodec、fps、解像度、音声ストリーム
- 動画全体の長さとスライド時間合計
- 最後の音声や字幕が途中で切れていないこと

### 17.2 人による確認

- LTとして話の流れが成立する。
- スライドと音声が同じ主張をしている。
- AWSサービス名や技術用語の発音が正しい。
- 音声あり、無音の両方で理解できる。
- X短尺版の最初の2秒でテーマが分かる。
- 出典と日付が確認できる。
- スマートフォン表示で文字が読める。

## 18. コスト設計

1動画の概算は次の合計として扱う。

```text
Bedrock入力・出力トークン
+ Web Search利用
+ Polly文字数
+ Marp変換Lambda実行時間
+ Hyperframes Lambda GB秒
+ Step Functions状態遷移
+ S3 GET/PUT/保存容量
+ 任意のMediaConvert出力時間
+ CloudFront転送量
```

制御策：

- スライド承認前は動画を生成しない。
- 音声だけを先に試聴できるようにする。
- Draftは720pまたは短い範囲だけをレンダリングする。
- Lambda Reserved Concurrencyを小さく開始する。
- 1ユーザーの同時動画ジョブ数を制限する。
- 月次利用枠とジョブ開始前の概算を表示する。
- 同じハッシュの音声、PNG、Hyperframes siteを再利用する。
- 中間チャンクへS3 Lifecycleを設定する。
- AWS BudgetsとCost Anomaly Detectionを設定する。

## 19. 監視

主要メトリクス：

- SlideGenerationSuccessRate
- MarpRenderDuration
- PollyCharacters
- PollyFailureRate
- HyperframesRenderDuration
- HyperframesChunkFailureRate
- RenderedFrames
- VideoDurationSeconds
- CostEstimatePerRender
- StepFunctionsFailedExecutions
- LambdaThrottles
- DLQDepth

`projectId`、`deckVersion`、`jobId`、`renderId`を全ログの相関IDとして使う。CloudWatch Dashboardで生成段階別の時間と失敗を表示し、Step Functions失敗、Lambdaスロットリング、DLQ滞留へアラームを設定する。

## 20. 実装ロードマップ

### Phase 0：技術検証

- 既存Marp 3～5枚をPNGへ出力する。
- 手書き原稿をPollyで音声化する。
- HyperframesローカルCLIでスライド、音声、fadeを合成する。
- 日本語フォント、字幕、音声同期、MP4互換性を確認する。
- 同じ入力から同じフレームが生成されることを確認する。

終了条件：手元のLTスライドから、音声付き16:9 MP4を安定して1本作れる。

### Phase 1：MVP

- BedrockでMarpとpresenter notesを生成する。
- Marp LambdaでPDF/PPTX/PNGを生成する。
- Polly音声、speech marks、字幕を生成する。
- `@hyperframes/aws-lambda`のCDK Constructを導入する。
- フルLT動画をS3へ出力する。
- Job進捗と成果物ダウンロードを実装する。

終了条件：Web UIからスライドを承認し、同じ内容のPDF/PPTX/MP4を取得できる。

### Phase 2：X向け短尺版

- 重要スライド選択と短尺原稿を生成する。
- フック3案、字幕スタイル、サムネイルを生成する。
- 16:9短尺版を生成する。
- 9:16 slide cardテンプレートを追加する。
- 投稿文と出典ページを生成する。

終了条件：フルLTから30～60秒の短尺動画を追加生成できる。

### Phase 3：品質と運用

- シーン単位の音声・動画再生成
- ブランドテーマ
- コード行ハイライト
- A/B版管理
- 利用枠、費用見積もり、Budgets
- CloudWatch Dashboardとアラーム
- レンダラーの回帰テスト

### Phase 4：任意拡張

- Marp HTMLのDOMモード
- MediaConvertによる複数配信品質
- Nova Canvasによる補助背景。ただしスライドが主役であることを維持する。
- ユーザー承認を前提としたBGMライブラリ

## 21. 受け入れ条件

1. 生成された`deck.md`がMarpとして表示できる。
2. 同一`deck.md`からPDF、PPTX、スライド別PNGが作られる。
3. 全スライドにpresenter notesがある。
4. Polly音声がスライド番号と正しく対応する。
5. 字幕が音声と同期し、スライド内容を隠さない。
6. Hyperframesが16:9 MP4を生成する。
7. MP4のスライド順がPDFと一致する。
8. 動画の最後で音声と字幕が切れない。
9. X短尺版が承認済みスライドだけから構成される。
10. 1枚の音声を修正した場合、スライド全体を再生成せず動画を更新できる。
11. 二重リクエストで同じ動画ジョブが重複しない。
12. 他ユーザーがProject成果物へアクセスできない。
13. 失敗段階と再試行可否がUIに表示される。
14. すべての成果物に元のdeckVersionを追跡できる。

## 22. 主なリスクと対策

| リスク | 対策 |
|---|---|
| Hyperframes 0.xのAPI変更 | 完全一致バージョン固定、Renovateを自動マージしない、回帰動画を保持 |
| HyperframesのMarp直接対応がない | PNGを正式な安定境界にする |
| Lambda ZIP、Chromium、FFmpegの肥大化 | 公式adapterを使い、ZIPサイズ検査とバージョン整合をCIで実行 |
| 日本語フォント差異 | MarpとHyperframesへ同じNoto Sans CJKを同梱 |
| Pollyの固有名詞誤読 | Lexicon、SSML、音声承認ステップ |
| 短尺化で主張が変わる | 元スライド番号とclaim IDを保持し、ユーザー承認を必須化 |
| 動画費用の増加 | Draft、キャッシュ、同時実行制限、事前見積もり |
| 画面上でスライドが読みにくい | LT側の文字量ルール、短尺用slide card、端末確認 |
| レンダリング完了通知がない | EventBridgeでStep Functions状態変更を購読 |
| X仕様変更 | 出力プリセットを設定データ化し、投稿前に現行仕様を確認 |

## 23. 最終判断

**Hyperframesを採用する。ただし「Hyperframesでスライドを作る」のではなく、「Marpで作ったスライドをHyperframesで音声付き動画にする」。**

最初の実装は次に限定する。

```text
BedrockでMarp + presenter notes生成
-> Marp CLIでPNG生成
-> Pollyでスライド別音声 + speech marks生成
-> Hyperframes通常動画コンポジション生成
-> Hyperframes AWS Lambdaで16:9 MP4出力
```

これが成功してから、X短尺版、9:16、字幕演出、コードハイライトを追加する。この順序により、登壇用スライドを中核に据えたまま、音声付き動画を最短で実現できる。

## 24. 参考資料

### Marp

- [Marp CLI](https://github.com/marp-team/marp-cli)
- [Marpit presenter notes](https://marpit.marp.app/usage?id=presenter-notes)

### Hyperframes

- [Hyperframes GitHub](https://github.com/heygen-com/hyperframes)
- [Hyperframes rendering guide](https://hyperframes.heygen.com/guides/rendering)
- [Hyperframes AWS Lambda deployment](https://hyperframes.heygen.com/deploy/aws-lambda)
- [Hyperframes voice, sound, and captions](https://hyperframes.heygen.com/guides/voice-and-audio)
- [Hyperframes presentation guide](https://hyperframes.heygen.com/guides/slideshow)
- [Hyperframes vs Remotion](https://hyperframes.heygen.com/guides/hyperframes-vs-remotion)
- [Apache License 2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE)

### AWS

- [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
- [AgentCore Gateway Web Search Tool](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html)
- [Amazon Polly SynthesizeSpeech](https://docs.aws.amazon.com/polly/latest/dg/API_SynthesizeSpeech.html)
- [Amazon Polly speech marks](https://docs.aws.amazon.com/polly/latest/dg/speechmarks.html)
- [AWS Step Functions StandardとExpress](https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html)
- [Step Functionsのネスト実行](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-nested-workflows.html)
- [AWS Elemental MediaConvert連携](https://docs.aws.amazon.com/step-functions/latest/dg/connect-mediaconvert.html)
- [AWS Lambdaベストプラクティス](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

Content was rephrased for compliance with licensing restrictions.
