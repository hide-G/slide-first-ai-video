# KiroのPowerShell承認とCDK synthラッパー

## 目的

KiroでCDK synthを実行する際に、次のようなインライン環境変数代入を含むPowerShellコマンドが解析できず、毎回の承認だけが可能になる問題への運用手順です。

```powershell
$env:TEMP = "..."; $env:TMP = "..."; pnpm --filter @slide-first/infra exec cdk synth
```

本リポジトリでは、この処理を [`scripts/invoke-cdk-synth.ps1`](../scripts/invoke-cdk-synth.ps1) に集約します。Kiroからは固定された単一のPowerShell起動コマンドを実行するため、解析可能な場合にワークスペース限定の保存済み許可ルールへ登録しやすくなります。

> このラッパーはKiroの承認を自動的に無効化するものではありません。Kiroがコマンドを解析できた場合に限り、利用者が設定した権限ルールと照合されます。

## 調査して分かったこと

### 1. Kiroの権限は capability とルールで管理される

Kiroは `shell` などの capability ごとに、許可・確認・拒否のルールを設定できます。解析可能な定型コマンドは、承認ダイアログの **Always allow** からセッション、ワークスペース、または全ワークスペースの範囲で保存できます。

一方、インラインの環境変数代入と複数コマンド連結を含む今回の形式は、Kiroが安全に解析できない場合があります。そのときは個別の保存ルールと照合できず、実行ごとの Allow / Deny だけが提示されます。

### 2. `shell: "*"` は全Shell操作を無承認にする

ダイアログに表示される `shell resource '*'` の許可は、特定のCDK操作だけでなく、すべてのShellコマンドに一致する広い許可です。Git操作、パッケージ操作、AWS CLI、削除操作なども無承認で実行できる状態になり得るため、通常の開発環境では推奨しません。

### 3. 権限設定はリポジトリへコミットしない

Kiroの権限ファイルはユーザー環境に保存されます。代表的な保存先は次のとおりです。

- 全ワークスペース: `~/.kiro/settings/permissions.yaml`
- ワークスペース限定: `~/.kiro/workspace-roots/<workspace-rootのhash>/permissions.yaml`

このリポジトリには権限ファイルを追加しません。権限の範囲は、利用者がKiroの承認UIまたは自分のローカル設定で管理してください。

### 4. ラッパーの責務

ラッパーは次だけを行います。

1. スクリプト自身の場所からリポジトリルートを解決する。
2. リポジトリルートの `.tmp-cdk` を作成し、実行中だけ `TEMP` と `TMP` の両方へ設定する。
3. 既存の `pnpm --filter @slide-first/infra exec cdk synth` を実行する。
4. カレントディレクトリ、`TEMP`、`TMP` を実行後に復元し、CDKの終了コードを呼び出し元へ返す。

AWSプロファイル、リージョン、デプロイ操作は設定しません。認証済みの呼び出し元環境をそのまま使い、`synth` だけを実行します。

## 実行方法

前提として、CDKアプリが `infra/dist/bin/app.js` を実行するため、先にビルドしてください。

```powershell
pnpm build
powershell.exe -NoProfile -File .\scripts\invoke-cdk-synth.ps1
```

スクリプトは実行場所に依存せずリポジトリルートを解決しますが、上記のようにリポジトリルートから起動すると、Kiroの許可対象にするコマンドを一定に保てます。

CDK synthはCloud AssemblyやLambdaアセットなどの一時出力を作成します。本リポジトリでは `.tmp-cdk/` をGit管理対象外にしています。実行中でないことを確認してから、必要に応じて手動で削除してください。

## Kiroでの最小権限の考え方

承認ダイアログに **Always allow** が表示される場合は、次の原則で設定してください。

1. **This workspace** を選び、他リポジトリへ許可を広げない。
2. `powershell.exe -NoProfile -File .\scripts\invoke-cdk-synth.ps1` のような固定コマンドだけを許可する。
3. `powershell *`、`pnpm *`、`npx *`、`*` のような広いパターンは恒久許可しない。
4. Kiroがこの起動コマンドも解析できない場合は、`shell: "*"` を追加せず都度承認を維持する。

権限ルールの形式例です。実際にはKiroのUIで表示される解析済みコマンドを基準に、利用者がローカル設定へ登録してください。

```yaml
rules:
  - capability: shell
    match:
      - "powershell.exe -NoProfile -File .\\scripts\\invoke-cdk-synth.ps1"
    effect: allow
```

KiroのAutopilot / Supervised設定と capability-based permissions は別の仕組みです。コード変更のレビューを残したい場合は、Shell操作だけを狭く許可し、必要以上に自律性を上げない運用が適しています。

## 参照した公式記事

- [Kiro Permissions](https://kiro.dev/docs/permissions/) - capabilityごとの権限ルール、許可・確認・拒否の基本仕様。
- [Kiro IDE 1.0: Capability-based permissions](https://kiro.dev/docs/ide/whats-new-v1/permissions/) - 自律性設定と権限ルールの関係、承認UIの考え方。
- [Kiro Configuration](https://kiro.dev/docs/configuration/) - Kiro設定の管理方法。
- [AWS CDK CLI: synth](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd-synth.html) - synthがCloud Assemblyとアセット出力を生成するCLI操作であること。

確認日: 2026-08-15

> ライセンス対応: 外部資料に関する説明は、内容を要約・言い換えて記述しています。
