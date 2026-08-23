# データ契約

この文書は、Slide-First AI Videoの現行4工程パイプラインにおける`manifest.json`の契約を定義します。工程間の状態はmanifestを正本とし、DynamoDBのプロジェクト記録はレンダリング開始時にAPIがmanifestへ変換します。

実装上の正本は`packages/shared-types/src/manifest.ts`、不変条件は`packages/shared-types/src/invariants.ts`です。文書とコードが異なる場合はコードを優先して修正対象として扱います。

## 1. S3レイアウト

```text
s3://<bucket>/users/{userId}/projects/{projectId}/
├─ input/source.pdf
├─ deck/
│  ├─ deck.md
│  ├─ deck.pdf
│  └─ deck.pptx
├─ pages/page-001.png, page-002.png, ...
├─ audio/page-001.wav, page-002.wav, ...
├─ captions/captions.srt
├─ output/{renderId}/page-001-video.mp4
└─ manifest.json
```

| パス                 | 用途                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `input/source.pdf`   | ③でアップロードしたPDF。PPTXのアップロードは受け付けません。                                                               |
| `deck/`              | ②で生成したMarp原稿、PDF、PowerPoint。動画生成には`deck/deck.pdf`を使用します。                                            |
| `pages/`             | 工程1で生成した、ページ番号を3桁ゼロ埋めしたPNGです。                                                                      |
| `audio/`             | 工程2で生成したPolly PCM由来のWAVです。                                                                                    |
| `captions/`          | 工程3で生成したSRTです。                                                                                                   |
| `output/{renderId}/` | 工程4のMediaConvert出力です。出力名は最初の入力画像名と`-video`のName Modifierから決まり、通常は`page-001-video.mp4`です。 |
| `manifest.json`      | パイプライン工程が読む唯一の状態正本です。                                                                                 |

`source.fileName`は画面表示とダウンロード名のための任意項目です。S3キーやパスの組み立てに利用してはいけません。

## 2. manifest.jsonの例

次は、9:16・上寄せ・下部safe-areaへ黒板風字幕を焼き込む実行時manifestの例です。

```json
{
  "schemaVersion": 1,
  "projectId": "01M0P3Z2X0WDVEW6YGQZ9N6MMP",
  "userId": "cognito-sub",
  "contentLanguage": "ja-JP",
  "source": {
    "kind": "uploaded",
    "fileKey": "users/cognito-sub/projects/01M0P3Z2X0WDVEW6YGQZ9N6MMP/input/source.pdf",
    "fileName": "sample.pdf",
    "pageCount": 1
  },
  "voice": {
    "id": "Takumi",
    "engine": "neural",
    "languageCode": "ja-JP",
    "sampleRate": "16000"
  },
  "output": {
    "aspect": "9:16",
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "captions": "burn",
    "narrationMode": "spoken",
    "silentPageDurationSec": 5,
    "verticalLayout": "top",
    "padColor": "navy",
    "captionStyle": "chalkboard",
    "captionPlacement": "safe-area",
    "captionSafeAreaYPosition": 1496
  },
  "lexicon": [],
  "pages": [
    {
      "pageNumber": 1,
      "imageKey": "users/cognito-sub/projects/01M0P3Z2X0WDVEW6YGQZ9N6MMP/pages/page-001.png",
      "script": { "mode": "plain", "text": "このページのナレーションです。" },
      "audioKey": "users/cognito-sub/projects/01M0P3Z2X0WDVEW6YGQZ9N6MMP/audio/page-001.wav",
      "audioDurationSec": 6.2375,
      "frameAlignedDurationMs": 6267
    }
  ],
  "stages": {
    "pages": "done",
    "audio": "done",
    "captions": "done",
    "video": "done"
  },
  "progress": {
    "stage": "video",
    "currentPage": 1,
    "totalPages": 1,
    "message": "動画の生成が完了しました。",
    "updatedAt": "2026-08-15T00:00:00.000Z"
  }
}
```

この例の`captionSafeAreaYPosition`は実機E2Eで得た値です。画面が固定値を保存するものではありません。

## 3. フィールド定義

### 3.1 トップレベル

| フィールド             | 型               | 説明                                               |
| ---------------------- | ---------------- | -------------------------------------------------- |
| `schemaVersion`        | `1`              | 現行スキーマの固定値です。                         |
| `projectId` / `userId` | string           | プロジェクトと所有者の識別子です。                 |
| `contentLanguage`      | string           | 資料・ナレーションの言語です。                     |
| `source`               | object           | 入力PDFまたは生成デッキの情報です。                |
| `voice`                | object           | Polly音声の設定です。                              |
| `output`               | object           | 出力プロファイル、字幕、縦型レイアウトの設定です。 |
| `lexicon`              | array            | 読み方置換の辞書です。                             |
| `pages`                | array            | ページごとの画像、原稿、音声、正確な尺です。       |
| `stages`               | object           | `pages`、`audio`、`captions`、`video`の状態です。  |
| `progress`             | object, optional | ブラウザへ返す工程・ページ単位の進捗です。         |
| `cost`                 | object, optional | 推定額と後日照合する実績額のための構造です。       |

### 3.2 sourceとvoice

| フィールド         | 値・制約                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `source.kind`      | `"generated"` または `"uploaded"`                                                                            |
| `source.fileKey`   | uploaded素材ではバケットルート相対の完全なS3キー。例: `users/{userId}/projects/{projectId}/input/source.pdf` |
| `source.pageCount` | 1以上の整数                                                                                                  |
| `source.fileName`  | 任意。表示用の元ファイル名であり、S3キーに使わない                                                           |
| `voice.sampleRate` | WAV生成ではPCM用の`"16000"`を既定とします。既存入力の無効な値はAPIが`"16000"`へ正規化します。                |

Polly PCMで使用できるサンプルレートは`8000`または`16000`です。`24000`はMP3向けの値であり、PCM出力へ渡してはいけません。

### 3.3 output

| フィールド                 | 値・制約                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `aspect`                   | `"16:9"`、`"9:16"`、`"1:1"`、`"4:5"`                                                      |
| `width` / `height`         | aspectに対応する固定プロファイル。順に1920×1080、1080×1920、1080×1080、1080×1350です。    |
| `fps`                      | `30`または`60`                                                                            |
| `captions`                 | `"burn"`、`"srt"`、`"none"`                                                               |
| `narrationMode`            | `"spoken"`または`"none"`。`"none"`のとき字幕は必ず`"none"`です。                          |
| `silentPageDurationSec`    | 無音ページの表示時間。1から30秒の整数です。                                               |
| `verticalLayout`           | `"top"`、`"center"`、`"crop"`、または`null`                                               |
| `padColor`                 | `"white"`、`"navy"`、`"auto"`、または`null`。任意のHEX値は受け付けません。                |
| `captionStyle`             | `"white-outline"`、`"yellow-outline"`、`"black-background"`、`"chalkboard"`、または`null` |
| `captionPlacement`         | `"bottom"`、`"safe-area"`、または`null`                                                   |
| `captionSafeAreaYPosition` | ページ描画後に工程1が確定するY座標。画面の保存APIでは受け付けません。                     |

`captionStyle`と`captionPlacement`は`captions: "burn"`の場合だけ指定できます。`safe-area`は`9:16`または`4:5`かつ`verticalLayout: "top"`だけで有効です。`chalkboard`はさらに`captionPlacement: "safe-area"`を必要とします。

工程1はsafe-areaを使う縦長上寄せレイアウトで、ラスタライズしたPDFページ画像の矩形下端から字幕帯のY座標を計算します。古いmanifestやスペースが確保できない入力では、この値を`null`にしてMediaConvertの通常の下端配置へ戻します。

### 3.4 pagesとstages

| フィールド                       | 説明                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `pages[].pageNumber`             | 1始まりの連番です。                                                                        |
| `pages[].imageKey`               | `users/{userId}/projects/{projectId}/pages/page-NNN.png`というバケットルート相対キーです。 |
| `pages[].script`                 | `mode`は`"plain"`または`"ssml"`、`text`は確定済みのナレーション原稿です。                  |
| `pages[].audioKey`               | `users/{userId}/projects/{projectId}/audio/page-NNN.wav`というバケットルート相対キーです。 |
| `pages[].audioDurationSec`       | WAVヘッダを除いたPCMデータ部のバイト数から算出した秒数です。                               |
| `pages[].frameAlignedDurationMs` | 音声尺を出力fpsの次フレーム境界へ切り上げた表示時間です。                                  |
| `stages.*`                       | `"pending"`、`"running"`、`"done"`、`"failed"`のいずれかです。                             |

### 3.5 部分再実行 / partial render

`POST /projects/{id}/renders`は、任意の`startFromStage`として`"pages"`、`"audio"`、`"captions"`、`"video"`を受け付けます。省略時は`"pages"`です。`audio`、`captions`、`video`から始める場合、APIは既存`manifest.json`を読み、新しいDynamoDB設定を正本としたfresh manifestへ再利用可能な実行時状態だけを合成します。過去の`progress`、`cost`、失敗状態は引き継ぎません。さらに、開始工程で省略する前工程の成果物を確認してからfresh manifestを書き戻し、Step Functionsを開始します。

- `audio`再実行は、全ページの`users/{userId}/projects/{projectId}/pages/page-NNN.png`を確認してから、ページ画像とsafe-area座標を引き継ぎ、音声尺・以降の工程を再実行します。
- `captions`再実行は、全ページのPNGと`users/{userId}/projects/{projectId}/audio/page-NNN.wav`を確認してから、ページ画像、safe-area座標、実測音声尺を引き継ぎます。
- `video`再実行は、全ページのPNGとWAVを確認します。`captions: "burn"`の場合だけ`users/{userId}/projects/{projectId}/captions/captions.srt`も確認してから、ページ画像、safe-area座標、実測音声尺、字幕完了状態を引き継ぎます。`captions: "srt"`または`"none"`ではSRTをMediaConvert入力にしないため、video再実行の前提にしません。
- 再利用成果物が欠損する場合、APIはmanifestを上書きせずStep Functionsも起動せず、`pages`からの再実行を要求します。
- 字幕設定追加前のmanifestで`captionStyle`と`captionPlacement`が未指定の場合、互換性比較時だけ`white-outline`と`bottom`として扱います。現在の保存設定が異なる場合はページから再実行します。

| 条件                                                                               | HTTP | エラーコード                                | クライアントの回復操作                         |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------------------- | ---------------------------------------------- |
| 既存manifestまたは再利用成果物の欠損、空本文、JSON不正、スキーマ不正、互換性不成立 | 409  | `PARTIAL_RENDER_REQUIRES_PAGES`             | `pages`から明示的に再実行する                  |
| 既存manifestへのLambdaからのS3アクセス拒否                                         | 500  | `MANIFEST_READ_ACCESS_DENIED`               | 運用者がIAMまたはバケットポリシーを復旧する    |
| 既存manifestのS3一時障害、タイムアウト、スロットリング、5xx                        | 503  | `MANIFEST_READ_UNAVAILABLE`                 | 同じ工程で時間をおいて再試行する               |
| その他の既存manifest読取失敗（`NoSuchBucket`を含む）                               | 502  | `MANIFEST_READ_FAILED`                      | 利用者は時間をおいて再試行し、継続時は調査する |
| 再利用成果物へのS3アクセス拒否                                                     | 500  | `PARTIAL_RENDER_ARTIFACT_ACCESS_DENIED`     | 運用者がIAMまたはバケットポリシーを復旧する    |
| 再利用成果物確認中のS3一時障害、タイムアウト、スロットリング、5xx                  | 503  | `PARTIAL_RENDER_ARTIFACT_CHECK_UNAVAILABLE` | 同じ工程で時間をおいて再試行する               |
| その他の再利用成果物確認失敗（`NoSuchBucket`を含む）                               | 502  | `PARTIAL_RENDER_ARTIFACT_CHECK_FAILED`      | 利用者は時間をおいて再試行し、継続時は調査する |

失敗状態の取得では、manifestの`progress.stage`を優先し、取得できない場合だけStep Functions履歴の最後の工程を使います。Video Studioはこの工程からの再実行ボタンを表示し、409の場合だけ`pages`からの再実行ボタンへ切り替えます。

## 4. 不変条件と実行時検証

`validateInvariants()`は少なくとも次を検証します。

1. `pages.length === source.pageCount`。
2. 音声工程が`running`または`done`で、かつ`narrationMode !== "none"`なら、全ページの`script.text`が空ではないこと。
3. 音声工程が`done`なら、全ページの`audioDurationSec`が正であること。
4. 音声工程が`done`なら、`frameAlignedDurationMs >= audioDurationSec * 1000`であること。
5. フレーム丸めによる超過が指定fpsの1フレーム以内であること。上限は30fpsで34ms、60fpsで17msです。
6. `pageNumber`が1からの連番であること。

フレーム丸めは次式で行います。

```text
frameMs    = 1000 / fps
frames     = ceil(audioDurationSec × 1000 / frameMs)
durationMs = round(frames × frameMs)
```

SRTの時刻は`audioDurationSec`ではなく、`frameAlignedDurationMs`の累積値から生成します。MediaConvertの各`VideoGenerator.Duration`にも同じ値を渡します。MediaConvert完了後の動画全体の許容差は`TOLERANCES.TOTAL_DURATION_MS`、すなわち50msです。

## 5. 字幕とMediaConvertの境界

`captions: "burn"`では、`captions/captions.srt`をMediaConvertの最初の入力にSRT Caption Selectorとして設定し、出力の`BURN_IN` Caption Descriptionで焼き込みます。言語が日本語なら`LanguageCode: JPN`、`FontScript: AUTOMATIC`を使います。

スタイルはMediaConvertが受け付ける色・不透明度・アウトライン・影だけで構成します。`chalkboard`の濃緑背景は字幕設定で指定するのではなく、工程1がsafe-areaのPNG余白を濃緑に描画して実現します。

`captions: "srt"`は字幕ファイルだけを成果物として返し、`captions: "none"`はSRT生成・焼き込みとも行いません。

## 6. cost（任意）

`cost`は推定額と実績額を混同しないための任意構造です。動画工程の使用量を記録する場合は、次の形を使います。

```json
{
  "stage": "video",
  "service": "mediaconvert",
  "usage": {
    "outputDurationSec": 6.3,
    "outputResolution": "1080x1920"
  },
  "estimatedCost": 0.0
}
```

`estimatedCost`はPrice Listで確認した単価と実測使用量から導く推定値です。`actual.status: "pending"`は請求データとの照合前を表し、実請求額ではありません。現行のレンダリングE2Eは成果物とMediaConvert完了を検証しており、請求額の実績照合は検証対象外です。実装状況と運用方針は[docs/cost.md](./cost.md)を参照してください。

## 7. 実装ファイル

- `packages/shared-types/src/manifest.ts`: Zodスキーマ、型、出力プロファイル
- `packages/shared-types/src/invariants.ts`: 不変条件と許容差
- `packages/shared-types/src/s3-keys.ts`: S3キー生成
- `lambdas/api/src/manifest/build-manifest.ts`: DynamoDB記録からのmanifest組み立てと既定値の正規化
- `lambdas/marp-render/src/index.ts`: ページ画像化とsafe-area Y座標の確定
- `lambdas/mediaconvert-worker/src/job-builder.ts`: MediaConvertジョブと焼き込み字幕の組み立て
