# 現行4工程への移行記録

この文書は、旧来のFFmpeg中心・5工程案から、現行のMediaConvert中心・4工程へ移行した結果を記録します。実装作業の現在の正本は`docs/contract.md`と`docs/architecture.md`です。この文書を、未実装の旧タスク一覧として使わないでください。

## 1. 移行の結論

現行パイプラインは次の4工程です。

```text
pages → audio → captions → video
```

- `pages`: `marp-render`がPDFをChromium内のpdf.jsでPNGへラスタライズします。
- `audio`: `polly-worker`がPCMをWAVに保存し、データ部のバイト数から正確な音声尺を計算します。
- `captions`: `caption-worker`がフレーム丸め後の累積時間からSRTを生成します。
- `video`: `mediaconvert-worker`がMediaConvertジョブを作成し、完了まで`GetJob`をポーリングします。

FFmpegによるページ別MP4 clip生成とconcatは、現行のデプロイ経路にありません。MediaConvertがPNGとWAVの入力をページ順に連結して1本のMP4を出力します。

## 2. 旧方式からの対応表

| 旧方式・概念                                        | 現行の対応                                                     | 状態     |
| --------------------------------------------------- | -------------------------------------------------------------- | -------- |
| PDF/PPTXを入力として受け付ける                      | PDFのみを受け付ける。PPTXは`PDF_REQUIRED`で拒否する。          | 現行方針 |
| MP3とffprobeによる音声尺                            | Polly PCMをWAV化し、PCMデータ部のバイト数から算出する。        | 移行済み |
| `clips/page-NNN.mp4`                                | 生成しない。MediaConvert入力としてPNGとWAVを直接連結する。     | 廃止     |
| FFmpegによるconcat                                  | `mediaconvert-worker`によるMediaConvertジョブ。                | 移行済み |
| 5工程の状態機械                                     | pages、audio、captions、videoの4工程。                         | 移行済み |
| Step FunctionsからMediaConvertへの直接`RUN_JOB`統合 | `mediaconvert-worker`が`CreateJob`と`GetJob`ポーリングを担う。 | 現行実装 |
| 任意の字幕座標                                      | `marp-render`が描画済みPNGからsafe-areaのY座標を算出する。     | 現行実装 |

## 3. S3レイアウトの変更

### 旧レイアウトの代表例

```text
{userId}/{projectId}/versions/v{NNNN}/
├─ slides/deck.001.png
├─ audio/slide-001.pcm
├─ captions/captions.json, full.ja.vtt, full.ja.srt
├─ clips/page-001.mp4
└─ output/lt-full-16x9.mp4
```

### 現行レイアウト

```text
users/{userId}/projects/{projectId}/
├─ input/source.pdf
├─ deck/deck.md, deck/deck.pdf, deck/deck.pptx
├─ pages/page-001.png, page-002.png, ...
├─ audio/page-001.wav, page-002.wav, ...
├─ captions/captions.srt
├─ output/{renderId}/page-001-video.mp4
└─ manifest.json
```

主な変更点は、`users/`接頭辞の導入、WAVへの統一、`clips/`の廃止、render ID単位の出力ディレクトリ、プロジェクト直下の単一manifestです。

## 4. 尺と字幕の移行

旧方式ではMP3の実測秒数とページ別clipを扱っていました。現行方式では次の値が正本です。

```text
PCM data bytes
  → audioDurationSec
  → frameAlignedDurationMs
  → SRT timecodes and MediaConvert VideoGenerator.Duration
```

フレーム境界への丸めは、音声より短い映像や、ページごとの切り上げが累積することによる字幕ずれを防ぎます。最終動画のMediaConvert報告尺は、丸め後合計との差が50ms以内であることを検証します。

## 5. 縦長字幕の追加

旧方式には、描画後のコンテンツ境界に基づく字幕safe-areaという契約はありませんでした。現行では以下を追加しています。

- `captionStyle`: `white-outline`、`yellow-outline`、`black-background`、`chalkboard`
- `captionPlacement`: `bottom`または`safe-area`
- `captionSafeAreaYPosition`: 工程1が実行時に決めるY座標
- `verticalLayout`: `top`、`center`、`crop`
- `padColor`: `white`、`navy`、`auto`

`chalkboard`は縦長・上寄せ・safe-areaの焼き込み字幕に限定し、濃緑の背景はMediaConvert字幕設定ではなくページPNGの余白として描画します。

## 6. 互換性と削除時の注意

- 旧manifestを読む場合でも、無効なサンプルレートは`16000`へ正規化します。
- 旧manifestにsafe-area座標がない場合は、MediaConvertの通常の下端字幕へフォールバックします。
- 旧FFmpeg、ffprobe、pdftoppm、LibreOffice、Docker前提のコードや運用手順を新たなデプロイ経路へ戻してはいけません。
- 過去の設計・障害記録はGit履歴と`設計指示書_動画生成パイプライン.md`に残しています。歴史的な記述と現行仕様が異なる場合は、現行契約と実装を優先します。

## 7. 移行後に確認する項目

1. `pnpm build`、`pnpm test`、`pnpm lint`、CDK synthが成功すること。
2. 1ページ以上のPDFで、PNG、WAV、SRT、MP4が生成されること。
3. `manifest.output`の幅・高さ・fpsとMediaConvertジョブ設定が一致すること。
4. 焼き込み字幕ではSRT Caption Selectorと`BURN_IN` Caption Descriptionが存在すること。
5. safe-areaを使う縦長上寄せでは、manifestの`captionSafeAreaYPosition`とMediaConvertの`YPosition`が一致すること。
6. 実績費用の表示を追加する場合は、推定額と請求データ照合済み額を分けること。

実機検証の数値と未実施の視覚確認は[設計指示書\_動画生成パイプライン.md](../設計指示書_動画生成パイプライン.md)に記録します。
