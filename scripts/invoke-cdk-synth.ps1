<#
.SYNOPSIS
  リポジトリ内の一時ディレクトリを使ってCDK synthを実行します。

.DESCRIPTION
  Kiroから固定したPowerShell起動コマンドで呼び出せるように、TEMP/TMPの設定と
  `pnpm --filter @slide-first/infra exec cdk synth` をこのスクリプトへ集約します。
  AWS認証情報、AWSプロファイル、リージョン、デプロイ操作は変更しません。
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$tempDirectory = Join-Path $repoRoot ".tmp-cdk"
$originalTemp = $env:TEMP
$originalTmp = $env:TMP
$locationPushed = $false
$exitCode = 1

try {
  New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null
  $env:TEMP = $tempDirectory
  $env:TMP = $tempDirectory

  Push-Location -LiteralPath $repoRoot
  $locationPushed = $true

  & pnpm --filter "@slide-first/infra" exec cdk synth
  $exitCode = [int]$LASTEXITCODE

  if ($exitCode -ne 0) {
    [Console]::Error.WriteLine("CDK synth に失敗しました。終了コード: $exitCode")
  }
} catch {
  [Console]::Error.WriteLine("CDK synth を開始できませんでした: $($_.Exception.Message)")
  $exitCode = 1
} finally {
  if ($locationPushed) {
    Pop-Location
  }

  if ($null -eq $originalTemp) {
    Remove-Item Env:TEMP -ErrorAction SilentlyContinue
  } else {
    $env:TEMP = $originalTemp
  }

  if ($null -eq $originalTmp) {
    Remove-Item Env:TMP -ErrorAction SilentlyContinue
  } else {
    $env:TMP = $originalTmp
  }
}

exit $exitCode
