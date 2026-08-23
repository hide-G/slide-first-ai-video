# 費用配分と追跡

この文書は、Slide-First AI Videoで推定額と実績額を混同せずに扱うための契約と運用方針です。料金そのものはリージョン、契約、使用時期で変化するため、この文書に単価を固定しません。

## 1. 現行の実装範囲

`manifest.cost`のスキーマは`packages/shared-types`にありますが、現行の動画生成E2Eで確認したのはPolly、Step Functions、MediaConvertによる成果物生成と完了状態です。Price Listからの単価取得、工程ごとの推定額の継続記録、Cost Explorerによる実請求額照合は、このE2Eの検証対象ではありません。

したがって、次を厳守します。

- `estimatedCost`を実請求額として表示しない。
- `actual.status: "pending"`を、料金が無料またはゼロである意味に使わない。
- 使用量や単価の取得を実装するまでは、画面で確定した費用であるかのように表示しない。
- 新しい費用表示を実装する場合は、APIの戻り値またはAWSメーターから取得できる実測使用量だけを使う。

## 2. コスト配分タグ

プロジェクト単位の後日照合を行う場合は、次のユーザー定義タグを使います。

| タグキー    | 意味                         | 適用対象                               |
| ----------- | ---------------------------- | -------------------------------------- |
| `projectId` | ULID形式のプロジェクト識別子 | プロジェクトに紐づくリソース・呼び出し |
| `renderId`  | レンダリング実行識別子       | レンダリング工程のコスト               |
| `userId`    | Cognitoの`sub`               | 所有者単位のコスト                     |

### 請求コンソールでの有効化

1. AWS Billing ConsoleのCost Allocation Tagsを開きます。
2. User-defined cost allocation tagsを選びます。
3. `projectId`、`renderId`、`userId`を有効化します。
4. 請求データへの反映後にCost ExplorerまたはCURで絞り込みます。

有効化前のコストには遡及適用されません。実績照合を始める前にタグの反映状態を確認してください。

## 3. サービス別の使用量

| サービス                   | 使用量の信頼できる取得元                                                                                    | manifestへの記録例                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Amazon Bedrock             | Converseレスポンスの`usage.inputTokens`、`usage.outputTokens`。キャッシュ利用時は該当トークンも記録します。 | `{ "inputTokens": 1500, "outputTokens": 3000 }`                 |
| Amazon Polly               | SynthesizeSpeechレスポンスの課金対象文字数ヘッダ                                                            | `{ "billedCharacters": 921 }`                                   |
| AWS Lambda                 | 課金対象実行時間と割り当てメモリから算出したGB秒、呼び出し数                                                | `{ "gbSeconds": 12.4, "invocations": 4 }`                       |
| Amazon S3                  | オブジェクト数、合計バイト数、PUT/GET数                                                                     | `{ "objectCount": 5, "totalSizeBytes": 300000 }`                |
| AWS Step Functions         | 実行履歴から数えた状態遷移数                                                                                | `{ "stateTransitions": 12 }`                                    |
| AWS Elemental MediaConvert | 完了ジョブの出力尺と出力解像度                                                                              | `{ "outputDurationSec": 6.3, "outputResolution": "1080x1920" }` |

MediaConvertの出力尺は、完了したジョブの`OutputGroupDetails[0].OutputDetails[0].DurationInMs`から取得できます。動画の概算に入力した尺、推定尺、画面表示用の秒数を代用してはいけません。

## 4. manifestの費用構造

```json
{
  "cost": {
    "currency": "USD",
    "priceListFetchedAt": "2026-08-15T00:00:00.000Z",
    "stages": [
      {
        "stage": "audio",
        "service": "polly",
        "usage": { "billedCharacters": 921 },
        "estimatedCost": 0.0
      },
      {
        "stage": "video",
        "service": "mediaconvert",
        "usage": {
          "outputDurationSec": 6.3,
          "outputResolution": "1080x1920"
        },
        "estimatedCost": 0.0
      }
    ],
    "estimatedTotal": 0.0,
    "actual": {
      "status": "pending",
      "amount": null,
      "reconciledAt": null
    }
  }
}
```

| フィールド            | 意味                                                |
| --------------------- | --------------------------------------------------- |
| `currency`            | 推定計算で使う通貨です。現行契約ではUSDを使います。 |
| `priceListFetchedAt`  | 単価を取得した時刻またはカタログの基準時刻です。    |
| `stages[]`            | 工程別のサービス、実測使用量、推定額です。          |
| `estimatedTotal`      | 各`estimatedCost`の合計です。                       |
| `actual.status`       | `pending`または`reconciled`です。                   |
| `actual.amount`       | 照合済みの実績額。未照合なら`null`です。            |
| `actual.reconciledAt` | 実績額を照合した時刻です。                          |

単価はコードに直接埋め込まず、AWS Price Listまたは契約上の正式な料金カタログから取得し、適用条件と取得時刻を保持します。

## 5. 推定額と実績額のライフサイクル

1. 工程が完了したら、サービス固有の実測使用量を取得します。
2. 取得済みの単価と使用量から推定額を計算し、`estimatedCost`へ保存します。
3. 請求データが利用可能になるまでは`actual.status`を`pending`にします。
4. 有効化済みのコスト配分タグを使って後日照合します。
5. 根拠が確認できる額だけを`actual.amount`へ保存し、`actual.status`を`reconciled`に更新します。

複数サービスの請求データが同じ粒度・同じ時刻に到着するとは限りません。照合できないサービスが残る場合は、全体を`reconciled`と表示せず、対象範囲と未照合理由を明示してください。

## 6. ダッシュボード・運用の確認観点

Cost ExplorerまたはCURで次の観点を確認します。

- `userId`ごとの費用
- `projectId`ごとの費用
- `renderId`ごとのレンダリング費用
- サービス別の内訳
- 推定額と後日照合した実績額の差

AWS請求情報は機密性を持つため、利用者向け画面にはその利用者が所有するプロジェクトの集計だけを返し、アカウント全体の請求情報や他利用者のタグ値を返してはいけません。
