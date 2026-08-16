/*
  UI表示言語（日本語 / English）の切り替え。
  - スライドやナレーションの「内容の言語」とは別管理。画面を英語にしても内容は日本語のまま扱う。
  - 辞書に無いキーはHTMLに書かれた日本語をそのまま残す（表示が壊れないようにするため）。
*/

(function () {
  "use strict";

  var DICT = {
    ja: {
      "common.skip": "本文へ移動",
      "common.brandSub": "スライドを正本に、音声と字幕で動画化",
      "common.mockBadge": "画面モックアップ",
      "common.uiLang": "UI表示言語",
      "common.or": "または",
      "common.logout": "ログアウト",
      "common.home": "ホーム",
      "common.open": "開く",
      "common.remove": "削除",
      "common.back": "戻る",
      "common.backHome": "ホームへ戻る",
      "common.footer": "Slide-First AI Video 画面モックアップ / 通信・生成処理は行いません",
      "common.toastMockFile": "モックアップのため、実ファイルの書き出しは行いません。",

      "login.title": "ログイン | Slide-First AI Video",
      "login.heading": "スライドを正本に、音声と字幕つき動画をつくる",
      "login.lead":
        "生成AIでスライドの骨子を作る工程と、手持ちの資料を動画化する工程は独立しています。必要な側だけを使えます。",
      "login.point1": "① スライド生成：文章と参考URLを渡し、骨子を確認・修正してからMarpスライドを作ります。",
      "login.point2": "② 動画生成：PDFやPowerPointをそのままアップロードし、ナレーションと字幕を付けて書き出します。",
      "login.point3": "③ 読み方の指定：英単語や固有名詞の読み、振り仮名、間の取り方をSSMLで調整できます。",
      "login.formTitle": "ログイン",
      "login.formSub": "社内アカウントまたはメールアドレスでログインします。",
      "login.email": "メールアドレス",
      "login.password": "パスワード",
      "login.showPassword": "パスワードを表示する",
      "login.submit": "ログイン",
      "login.sso": "シングルサインオンでログイン",
      "login.forgot": "パスワードを忘れた場合",
      "login.signup": "アカウントを新規作成",
      "login.mockNote":
        "これは画面確認用のモックアップです。認証処理は実装されておらず、入力内容はどこにも送信されません。",
      "login.toastReset": "モックアップのため、パスワード再設定は動作しません。",
      "login.toastSignup": "モックアップのため、アカウント作成は動作しません。",

      "home.title": "ホーム | Slide-First AI Video",
      "home.heading": "何をつくりますか",
      "home.lead":
        "スライド生成と動画生成は独立した機能です。本アプリ以外で作ったPDFやPowerPointを、動画生成へ直接アップロードできます。",
      "home.card1Kicker": "機能 ②",
      "home.card1Title": "生成AIでスライドを作る",
      "home.card1Body":
        "文章や参考文献のURLを渡すと、生成AIがスライドの骨子を作ります。内容を確認・加筆修正してからMarpでスライドを生成します。",
      "home.card1Point1": "スライドの言語を日本語・英語から選択",
      "home.card1Point2": "骨子をレビューして文章を編集",
      "home.card1Point3": "Markdown・PDF・PowerPointで書き出し",
      "home.card1Cta": "スライド作成をはじめる",
      "home.card2Kicker": "機能 ③",
      "home.card2Title": "資料から動画を作る",
      "home.card2Body":
        "PDFまたはPowerPointをアップロードし、ナレーションと字幕を付けて動画にします。スライド生成を経由せず、単独で使えます。",
      "home.card2Point1": "横型・縦型・正方形の出力サイズを選択",
      "home.card2Point2": "ページごとのナレーション案を自動作成",
      "home.card2Point3": "SSMLで読み方と振り仮名を指定",
      "home.card2Cta": "動画作成をはじめる",
      "home.recentTitle": "最近のプロジェクト",
      "home.recentSub": "表示内容はモックアップ用のサンプルです。",
      "home.thName": "名前",
      "home.thKind": "種別",
      "home.thSize": "出力",
      "home.thUpdated": "更新",
      "home.thState": "状態",
      "home.thAction": "操作",
      "home.kindVideo": "動画",
      "home.kindSlide": "スライド",
      "home.slides6": "6ページ",
      "home.stateDone": "完了",
      "home.stateRunning": "生成中",
      "home.stateDraft": "下書き",
      "home.specTitle": "この画面構成で想定しているAWS側の処理（設計メモ）",
      "home.spec1": "①ログイン：Amazon Cognito。以降の入力・成果物はユーザー単位で分離します。",
      "home.spec2":
        "②骨子生成：Amazon Bedrockでスライド骨子のテキストを生成。ユーザーが確定した骨子だけをスライド生成へ渡します。",
      "home.spec3": "②スライド生成：Marpでスライドを生成し、Markdown・PDF・PowerPointをS3へ保存します。",
      "home.spec4": "③素材受け取り：PDF・PowerPointをS3へアップロードし、ページ画像へ変換します。",
      "home.spec5":
        "③音声と字幕：ナレーション原稿はBedrockで下書きし、確定原稿をAmazon Pollyで音声化。字幕は同じ原稿から生成します。",
      "home.spec6": "③動画結合：ページ画像・音声・字幕を結合。ページごとの尺は音声の実測時間に合わせます。",
      "home.spec7": "進行管理：工程を分けて実行し、失敗した工程だけを再実行できる構成にします。",

      "slide.title": "スライド作成 | Slide-First AI Video",
      "slide.heading": "② 生成AIでスライドを作る",
      "slide.lead": "骨子を確認・修正してからスライドを生成します。生成AIの出力をそのまま採用しません。",
      "slide.stepA": "入力と条件",
      "slide.stepB": "骨子のレビューと編集",
      "slide.stepC": "スライド生成と書き出し",
      "slide.s1Title": "スライドの内容と条件を入力する",
      "slide.s1Sub": "入力後、まず骨子だけを生成します。この時点ではスライドは作られません。",
      "slide.langNote":
        "言語の考え方：画面の表示言語（ヘッダーの日本語 / English）と、これから作るスライドの言語は別に指定します。画面を英語にしたまま日本語のスライドを作れます。",
      "slide.outputLang": "スライドの言語",
      "slide.langJa": "日本語",
      "slide.langJaHint": "本文・ナレーションを日本語で作成",
      "slide.langEn": "English",
      "slide.langEnHint": "本文・ナレーションを英語で作成",
      "slide.topic": "タイトル・テーマ",
      "slide.sourceText": "渡したい文章・要件",
      "slide.sourcePlaceholder": "伝えたい内容、前提、必ず入れたい注意事項などを貼り付けます。",
      "slide.sourceHint": "機密情報や資格情報は入力しないでください。",
      "slide.refUrls": "参考文献のURL",
      "slide.refUrlAria": "参考文献のURL",
      "slide.addUrl": "URLを追加",
      "slide.refHint": "参照した内容は要約・言い換えして使い、出典を最終ページに記載します。",
      "slide.audience": "対象読者",
      "slide.audience1": "はじめて触る人",
      "slide.audience2": "実務で使う開発者",
      "slide.audience3": "意思決定者",
      "slide.pages": "ページ数",
      "slide.tone": "トーン",
      "slide.tone1": "説明中心",
      "slide.tone2": "講義・研修",
      "slide.tone3": "紹介・告知",
      "slide.theme": "デザインテーマ",
      "slide.theme1": "ブルー基調（既定）",
      "slide.theme2": "モノトーン",
      "slide.theme3": "高コントラスト",
      "slide.genOutline": "骨子を生成する",
      "slide.s2Title": "骨子をレビューして修正する",
      "slide.s2Sub":
        "スライドを生成する前の工程です。ここで確定した文章がスライドとナレーションの元になります。",
      "slide.outlineList": "スライド一覧",
      "slide.moveUp": "上へ",
      "slide.moveDown": "下へ",
      "slide.addSlide": "追加",
      "slide.aiDraft": "生成AIの下書き",
      "slide.slideTitle": "見出し",
      "slide.slideBody": "本文（1行につき1項目）",
      "slide.slideBodyHint": "加筆・削除・言い換えは自由に行えます。事実確認は必ず人が行ってください。",
      "slide.slideNotes": "補足メモ（スライドには表示しない）",
      "slide.regen": "このページだけAIに再提案させる",
      "slide.factCheck": "出典との対応を確認する",
      "slide.toastRegen": "モックアップのため、再提案は行いません。",
      "slide.toastCheck": "モックアップのため、出典照合は行いません。",
      "slide.genDeck": "この骨子でスライドを生成する",
      "slide.s3Title": "スライドを生成しました",
      "slide.s3Sub": "サムネイルは表示イメージです。実ファイルはモックアップには含まれません。",
      "slide.downloadTitle": "書き出し",
      "slide.downloadSub": "同じ内容から3つの形式を書き出します。",
      "slide.pptxNote": "PowerPointは拡張子だけでなく、実際にPowerPointで開けるファイルとして書き出します。",
      "slide.pptxEditNote":
        "PowerPointは各ページを画像として貼り付けた形式で書き出されます。開いて表示や書き込みはできますが、テキストの編集はできません。",
      "slide.backOutline": "骨子の編集に戻る",
      "slide.toVideo": "この資料で動画を作る",

      "video.title": "動画作成 | Slide-First AI Video",
      "video.heading": "③ 資料から動画を作る",
      "video.lead":
        "PDFまたはPowerPointを起点に、ナレーションと字幕を付けて書き出します。スライド作成機能を使わず、単独で利用できます。",
      "video.stepA": "素材の読み込み",
      "video.stepB": "出力設定",
      "video.stepC": "ナレーションと読み方",
      "video.stepD": "生成と書き出し",
      "video.handoffTitle": "スライド作成から引き継ぎました",
      "video.handoffNote":
        "スライド作成で確定した内容をそのまま読み込みました。差し替える場合は下からアップロードしてください。",
      "video.uploadTitle": "資料をアップロードする",
      "video.uploadSub": "PDF、または PowerPoint（.pptx）に対応します。",
      "video.dropTitle": "ここにファイルをドラッグ、またはクリックして選択",
      "video.dropHint": "1ファイル、最大50ページを想定",
      "video.toastUpload": "モックアップのため、ファイルの読み込みは行いません。",
      "video.independentNote":
        "この画面は単独で使えます。他のツールで作ったスライドをここへアップロードして動画化できます。",
      "video.pagesTitle": "読み込んだページ",
      "video.pagesSub": "ページ数と、後で作るナレーションの数を一致させます。",
      "video.toSettings": "出力設定へ進む",
      "video.previewTitle": "プレビュー",
      "video.previewSlide": "スライド表示領域",
      "video.previewCaption": "ここに字幕が表示されます",
      "video.sizeTitle": "画面サイズ",
      "video.sizeSub": "配信先に合わせて選びます。同じ原稿から別サイズを追加で書き出せます。",
      "video.sizeLegend": "出力する画面サイズ",
      "video.size169": "横型 16:9",
      "video.size169Hint": "1920×1080 / 通常の動画・研修資料",
      "video.size916": "縦型 9:16",
      "video.size916Hint": "1080×1920 / ショート動画・リール",
      "video.size11": "正方形 1:1",
      "video.size11Hint": "1080×1080 / タイムライン投稿",
      "video.size45": "縦長 4:5",
      "video.size45Hint": "1080×1350 / 縦長タイムライン",
      "video.verticalNote":
        "縦型では16:9のスライドがそのままでは小さくなります。配置と拡大方法を指定してください。",
      "video.vLayout": "スライドの配置",
      "video.vLayout1": "上寄せ（下に字幕）",
      "video.vLayout2": "中央（上下に余白）",
      "video.vLayout3": "拡大して切り抜き",
      "video.vBg": "余白の色",
      "video.vBg1": "白",
      "video.vBg2": "濃紺",
      "video.vBg3": "スライドの色に合わせる",
      "video.safeArea": "UIに隠れない範囲（セーフエリア）を表示する",
      "video.fps": "フレームレート",
      "video.subtitleTitle": "字幕",
      "video.subtitleLegend": "字幕の出力方法",
      "video.subBurn": "映像に焼き込む",
      "video.subBurnHint": "どの環境でも同じ見た目になります",
      "video.subSrt": "字幕ファイルを別に出す",
      "video.subSrtHint": "SRTを同時に書き出します",
      "video.subNone": "字幕なし",
      "video.subNoneHint": "音声のみで構成します",
      "video.subSize": "文字サイズ",
      "video.subSizeS": "小",
      "video.subSizeM": "中",
      "video.subSizeL": "大（ショート動画向け）",
      "video.subPos": "表示位置",
      "video.subPosBottom": "下",
      "video.subPosCenter": "中央下",
      "video.subPosTop": "上",
      "video.voiceTitle": "読み上げ音声",
      "video.voiceId": "音声",
      "video.engine": "エンジン",
      "video.sampleRate": "サンプルレート",
      "video.speechRate": "読み上げ速度",
      "video.rateDefault": "100%（既定）",
      "video.voiceTest": "この音声で短い文を試聴する",
      "video.voiceTestHint":
        "音声とエンジンの組み合わせによって使えない指定があります。本番の生成前に短い文で確認できます。",
      "video.toastVoiceTest": "モックアップのため、音声は再生されません。",
      "video.toNarration": "ナレーション案を作る",
      "video.narrTitle": "ナレーションを確認・編集する",
      "video.narrSub":
        "生成AIがページごとに原稿案を作成しました。読み上げる文章は、ここで確定した内容が使われます。",
      "video.pageListTitle": "ページ",
      "video.aiDraft": "生成AIの下書き",
      "video.inputMode": "原稿の記述方法",
      "video.modePlain": "通常の文章",
      "video.modePlainHint": "そのまま読み上げます",
      "video.modeSsml": "SSMLで細かく指定",
      "video.modeSsmlHint": "読み方・振り仮名・間を指定します",
      "video.script": "読み上げ原稿",
      "video.ssmlToolbar": "SSMLの挿入",
      "video.ssmlSub": "読み替え",
      "video.ssmlRuby": "振り仮名",
      "video.ssmlPhoneme": "発音記号",
      "video.ssmlSpell": "1文字ずつ読む",
      "video.ssmlBreak": "間を入れる",
      "video.ssmlRate": "速度",
      "video.ssmlEmphasis": "強調",
      "video.estHint": "推定時間の目安です。実際の尺は音声を生成したあとに実測値で確定します。",
      "video.ssmlNote":
        "振り仮名は読み替えタグで指定します。音声とエンジンの組み合わせによって使えないタグがあるため、試聴で確認してください。",
      "video.previewAudio": "この原稿を試聴する",
      "video.regenScript": "AIに再提案させる",
      "video.toastPreviewAudio": "モックアップのため、音声は再生されません。",
      "video.toastRegenScript": "モックアップのため、再提案は行いません。",
      "video.dictTitle": "読み方の辞書（資料全体に適用）",
      "video.dictSub": "繰り返し出る英単語や固有名詞は、ページごとに書かずに辞書で統一します。",
      "video.dictWord": "表記",
      "video.dictRead": "読み方",
      "video.dictMethod": "指定方法",
      "video.dictSubTag": "読み替え",
      "video.dictPhonemeTag": "発音記号",
      "video.dictSpellTag": "1文字ずつ",
      "video.dictAdd": "行を追加",
      "video.generate": "動画を生成する",
      "video.jobTitle": "生成の進行状況",
      "video.jobSub": "工程ごとに進みます。途中で失敗した場合は、その工程だけを再実行します。",
      "video.job1": "ページを画像に変換",
      "video.job2": "ナレーション音声を合成",
      "video.job3": "音声の長さを実測して字幕を作成",
      "video.job4": "ページごとの動画を作成",
      "video.job5": "全ページを連結して書き出し",
      "video.jobWaiting": "開始待ち",
      "video.resultTitle": "動画ができました",
      "video.resultPreview": "完成した動画のプレビュー",
      "video.resultCaption": "字幕つきで再生されます",
      "video.resFile": "ファイル",
      "video.resPages": "ページ数",
      "video.res5pages": "5ページ",
      "video.resDuration": "長さ",
      "video.resVideo": "映像",
      "video.resAudio": "音声",
      "video.dlMp4": "MP4をダウンロード",
      "video.dlSrt": "字幕（SRT）",
      "video.dlAudio": "音声ファイル",
      "video.reuseNote": "原稿を変えていない場合、音声を作り直さずに別サイズの動画を書き出せます。",
      "video.makeVertical": "同じ原稿で縦型（1080×1920）も書き出す",
      "video.toastVertical": "モックアップのため、追加の書き出しは行いません。",
      "video.backNarration": "ナレーション編集に戻る",

      "video.ssmlUnavailable": "選択した音声・エンジンでは使えないタグです",
      "video.ssmlPartial": "音声によって結果が変わるタグです。試聴で確認してください",
      "video.cheatsheetOpen": "SSMLチートシート",
      "video.cheatsheetTitle": "Amazon Polly SSML チートシート",
      "video.cheatsheetClose": "閉じる",
      "video.cheatsheetMoveHelp": "見出しをドラッグすると移動できます。見出しを選んで矢印キーでも移動できます。右下をドラッグすると大きさを変えられます。",
      "video.cheatsheetThPurpose": "用途",
      "video.cheatsheetThTag": "タグと書き方",
      "video.cheatsheetThSupport": "対応",
      "video.cheatsheetThInsert": "挿入",
      "video.cheatsheetInsert": "挿入",
      "video.supportFull": "使える",
      "video.supportPartial": "一部のみ",
      "video.supportNone": "使えない",
      "video.supportSelect": "一部の音声のみ",
      "video.cheatsheetNote1":
        "ニューラル音声では、prosody の volume と rate は使えますが、pitch は使えません。標準音声ではすべて使えます。",
      "video.cheatsheetNote2":
        "say-as の characters（1文字ずつ読む）は、ニューラル音声では該当の文だけ標準音声で合成されます。課金はニューラル音声として行われます。",
      "video.cheatsheetNote3": "対応していないタグを使うとエラーになります。生成前に試聴で確認してください。",
      "video.cheatsheetSource": "出典: Amazon Polly 公式ドキュメント「Supported SSML tags」",

      "cost.sectionTitle": "工程別の費用",
      "cost.sectionSub": "使用量から計算した推定額です。実際の請求額は、あとで集計して照合します。",
      "cost.thStage": "工程",
      "cost.thService": "サービス",
      "cost.thUsage": "使用量",
      "cost.thEstimate": "推定コスト",
      "cost.stageOutline": "骨子の生成",
      "cost.stageDeck": "スライドの生成",
      "cost.stageNarration": "ナレーション案の生成",
      "cost.stagePages": "ページ画像の変換",
      "cost.stageAudio": "音声合成",
      "cost.stageCaptions": "字幕の生成",
      "cost.stageClips": "ページ動画の作成",
      "cost.stageConcat": "連結と書き出し",
      "cost.stageStorage": "保存とリクエスト",
      "cost.stageOrchestration": "工程の実行管理",
      "cost.total": "推定合計",
      "cost.estimateBadge": "推定",
      "cost.actualBadge": "実績",
      "cost.actualPending": "実績値: 集計待ち（反映まで最大24時間）",
      "cost.unitNote":
        "表示している単価は画面確認用のサンプルです。実装時はAWS Price List APIから取得した単価を使い、計算に使った単価の取得日を記録します。",
      "cost.disclaimer": "無料利用枠は考慮していません。日本円は請求時のレートによって変わります。",
      "cost.audioLine": "この原稿の推定音声コスト",
      "cost.ssmlExcluded": "SSMLタグは課金対象の文字数に含まれません。",
      "cost.deckEstimate": "このスライド生成にかかった推定コスト",
      "cost.recentCost": "推定コスト",

      "js.slideLabel": "スライド {n}",
      "js.pageLabel": "ページ {n}",
      "js.chars": "{n} 文字",
      "js.estSec": "推定 {n} 秒",
      "js.totalEst": "全{count}ページの推定合計: 約{sec}秒",
      "js.newSlideTitle": "新しいスライド",
      "js.jobRunning": "処理中: {name}",
      "js.jobDone": "完了しました。書き出したファイルを確認できます。",
      "js.contentLangNote": "内容は日本語のまま表示しています",
      "js.usageTokens": "入力 {in} / 出力 {out} トークン",
      "js.usageChars": "課金対象 {n} 文字",
      "js.usageGbSec": "{n} GB秒",
      "js.usageStorage": "{puts} リクエスト / {gb} GB・月",
      "js.usageTransitions": "{n} 状態遷移",
      "js.usd": "{n} USD",
      "js.ssmlUnavailableList": "現在のエンジン（{engine}）では使えないタグ: {tags}",
      "js.ssmlAllAvailable": "現在のエンジン（{engine}）では、一覧のタグをすべて使えます。",
      "js.audioCost": "{label}: {cost}（{chars}）",
      "js.cheatsheetEngine": "選択中のエンジン: {engine}"
    },

    en: {
      "common.skip": "Skip to main content",
      "common.brandSub": "Slides as the source of truth, with narration and captions",
      "common.mockBadge": "UI mockup",
      "common.uiLang": "Interface language",
      "common.or": "or",
      "common.logout": "Sign out",
      "common.home": "Home",
      "common.open": "Open",
      "common.remove": "Remove",
      "common.back": "Back",
      "common.backHome": "Back to home",
      "common.footer": "Slide-First AI Video UI mockup / no network or generation happens here",
      "common.toastMockFile": "This is a mockup, so no file is produced.",

      "login.title": "Sign in | Slide-First AI Video",
      "login.heading": "Turn slides into narrated, captioned video",
      "login.lead":
        "Generating slide outlines and turning documents into video are independent. Use only the part you need.",
      "login.point1": "1. Slide generation: pass text and reference URLs, review the outline, then build the deck.",
      "login.point2": "2. Video generation: upload a PDF or PowerPoint and export it with narration and captions.",
      "login.point3": "3. Pronunciation control: adjust readings, furigana and pauses with SSML.",
      "login.formTitle": "Sign in",
      "login.formSub": "Use your organization account or email address.",
      "login.email": "Email address",
      "login.password": "Password",
      "login.showPassword": "Show password",
      "login.submit": "Sign in",
      "login.sso": "Sign in with single sign-on",
      "login.forgot": "Forgot your password",
      "login.signup": "Create an account",
      "login.mockNote":
        "This is a UI mockup. Authentication is not implemented and nothing you type is sent anywhere.",
      "login.toastReset": "This is a mockup, so password reset does not work.",
      "login.toastSignup": "This is a mockup, so sign-up does not work.",

      "home.title": "Home | Slide-First AI Video",
      "home.heading": "What would you like to make",
      "home.lead":
        "Slide generation and video generation are separate. You can upload a PDF or PowerPoint made elsewhere straight into video generation.",
      "home.card1Kicker": "Feature 2",
      "home.card1Title": "Generate slides with AI",
      "home.card1Body":
        "Provide text and reference URLs, and AI drafts a slide outline. Review and edit it before the deck is generated.",
      "home.card1Point1": "Choose Japanese or English for the slides",
      "home.card1Point2": "Review and edit the outline",
      "home.card1Point3": "Export Markdown, PDF and PowerPoint",
      "home.card1Cta": "Start creating slides",
      "home.card2Kicker": "Feature 3",
      "home.card2Title": "Turn a document into video",
      "home.card2Body":
        "Upload a PDF or PowerPoint and export it as video with narration and captions. Works on its own, without slide generation.",
      "home.card2Point1": "Pick landscape, vertical or square output",
      "home.card2Point2": "Draft narration for each page automatically",
      "home.card2Point3": "Control readings and furigana with SSML",
      "home.card2Cta": "Start creating video",
      "home.recentTitle": "Recent projects",
      "home.recentSub": "Sample rows for the mockup.",
      "home.thName": "Name",
      "home.thKind": "Type",
      "home.thSize": "Output",
      "home.thUpdated": "Updated",
      "home.thState": "Status",
      "home.thAction": "Actions",
      "home.kindVideo": "Video",
      "home.kindSlide": "Slides",
      "home.slides6": "6 pages",
      "home.stateDone": "Done",
      "home.stateRunning": "Running",
      "home.stateDraft": "Draft",
      "home.specTitle": "Intended AWS processing behind these screens (design note)",
      "home.spec1": "1. Sign-in: Amazon Cognito. Inputs and outputs are separated per user.",
      "home.spec2":
        "2. Outline: Amazon Bedrock drafts the outline text. Only the outline the user confirms is passed to slide generation.",
      "home.spec3": "2. Slides: Marp builds the deck; Markdown, PDF and PowerPoint are stored in S3.",
      "home.spec4": "3. Source intake: PDF and PowerPoint are uploaded to S3 and converted into page images.",
      "home.spec5":
        "3. Audio and captions: Bedrock drafts narration, Amazon Polly speaks the confirmed script, and captions come from the same script.",
      "home.spec6":
        "3. Video assembly: page images, audio and captions are combined, with each page matched to the measured audio length.",
      "home.spec7": "Orchestration: stages run separately so a failed stage can be retried on its own.",

      "slide.title": "Create slides | Slide-First AI Video",
      "slide.heading": "2. Generate slides with AI",
      "slide.lead": "Review and edit the outline before the deck is generated. AI output is never used as is.",
      "slide.stepA": "Input and options",
      "slide.stepB": "Review and edit outline",
      "slide.stepC": "Generate and export",
      "slide.s1Title": "Describe the content and options",
      "slide.s1Sub": "Only the outline is generated first. No slides are built at this point.",
      "slide.langNote":
        "About language: the interface language (Japanese / English in the header) is set separately from the language of the slides. You can keep the interface in English and still produce Japanese slides.",
      "slide.outputLang": "Slide language",
      "slide.langJa": "Japanese",
      "slide.langJaHint": "Write body text and narration in Japanese",
      "slide.langEn": "English",
      "slide.langEnHint": "Write body text and narration in English",
      "slide.topic": "Title or topic",
      "slide.sourceText": "Source text and requirements",
      "slide.sourcePlaceholder": "Paste what you want to convey, assumptions, and any required cautions.",
      "slide.sourceHint": "Do not enter secrets or credentials.",
      "slide.refUrls": "Reference URLs",
      "slide.refUrlAria": "Reference URL",
      "slide.addUrl": "Add URL",
      "slide.refHint": "References are summarized and paraphrased, with sources listed on the last page.",
      "slide.audience": "Audience",
      "slide.audience1": "First-time users",
      "slide.audience2": "Working developers",
      "slide.audience3": "Decision makers",
      "slide.pages": "Number of pages",
      "slide.tone": "Tone",
      "slide.tone1": "Explanatory",
      "slide.tone2": "Training",
      "slide.tone3": "Announcement",
      "slide.theme": "Design theme",
      "slide.theme1": "Blue (default)",
      "slide.theme2": "Monotone",
      "slide.theme3": "High contrast",
      "slide.genOutline": "Generate outline",
      "slide.s2Title": "Review and edit the outline",
      "slide.s2Sub":
        "This happens before slides are built. The text you confirm here drives both the deck and the narration.",
      "slide.outlineList": "Slides",
      "slide.moveUp": "Move up",
      "slide.moveDown": "Move down",
      "slide.addSlide": "Add",
      "slide.aiDraft": "AI draft",
      "slide.slideTitle": "Heading",
      "slide.slideBody": "Body (one item per line)",
      "slide.slideBodyHint": "Edit freely. A person must verify the facts.",
      "slide.slideNotes": "Private notes (not shown on the slide)",
      "slide.regen": "Ask AI to redraft this page",
      "slide.factCheck": "Check against the sources",
      "slide.toastRegen": "This is a mockup, so no redraft is generated.",
      "slide.toastCheck": "This is a mockup, so no source check runs.",
      "slide.genDeck": "Generate slides from this outline",
      "slide.s3Title": "Slides generated",
      "slide.s3Sub": "Thumbnails are illustrative. The mockup contains no real files.",
      "slide.downloadTitle": "Export",
      "slide.downloadSub": "Three formats from the same content.",
      "slide.pptxNote": "PowerPoint is exported as a file that really opens in PowerPoint, not just a renamed file.",
      "slide.pptxEditNote":
        "Each page is embedded in the PowerPoint file as an image. You can open, present and annotate it, but the text is not editable.",
      "slide.backOutline": "Back to outline editing",
      "slide.toVideo": "Make a video from this deck",

      "video.title": "Create video | Slide-First AI Video",
      "video.heading": "3. Turn a document into video",
      "video.lead":
        "Start from a PDF or PowerPoint and export it with narration and captions. This works on its own, without the slide generator.",
      "video.stepA": "Load source",
      "video.stepB": "Output settings",
      "video.stepC": "Narration and readings",
      "video.stepD": "Generate and export",
      "video.handoffTitle": "Carried over from slide creation",
      "video.handoffNote": "The confirmed deck was loaded as is. Upload a file below to replace it.",
      "video.uploadTitle": "Upload a document",
      "video.uploadSub": "PDF or PowerPoint (.pptx) is supported.",
      "video.dropTitle": "Drag a file here, or click to choose",
      "video.dropHint": "One file, up to about 50 pages",
      "video.toastUpload": "This is a mockup, so no file is loaded.",
      "video.independentNote":
        "This screen works on its own. Upload slides made in another tool and turn them into video.",
      "video.pagesTitle": "Loaded pages",
      "video.pagesSub": "The page count and the number of narration scripts are kept equal.",
      "video.toSettings": "Continue to output settings",
      "video.previewTitle": "Preview",
      "video.previewSlide": "Slide area",
      "video.previewCaption": "Captions appear here",
      "video.sizeTitle": "Frame size",
      "video.sizeSub": "Choose per destination. You can export another size later from the same script.",
      "video.sizeLegend": "Output frame size",
      "video.size169": "Landscape 16:9",
      "video.size169Hint": "1920x1080 / standard video and training",
      "video.size916": "Vertical 9:16",
      "video.size916Hint": "1080x1920 / short-form video and reels",
      "video.size11": "Square 1:1",
      "video.size11Hint": "1080x1080 / timeline posts",
      "video.size45": "Tall 4:5",
      "video.size45Hint": "1080x1350 / tall timeline posts",
      "video.verticalNote":
        "In vertical output, a 16:9 slide becomes small. Choose how it is placed and scaled.",
      "video.vLayout": "Slide placement",
      "video.vLayout1": "Top (captions below)",
      "video.vLayout2": "Centered (padding above and below)",
      "video.vLayout3": "Scale up and crop",
      "video.vBg": "Padding color",
      "video.vBg1": "White",
      "video.vBg2": "Navy",
      "video.vBg3": "Match the slide",
      "video.safeArea": "Show the safe area not covered by platform UI",
      "video.fps": "Frame rate",
      "video.subtitleTitle": "Captions",
      "video.subtitleLegend": "How captions are delivered",
      "video.subBurn": "Burn into the video",
      "video.subBurnHint": "Looks the same everywhere",
      "video.subSrt": "Export a separate caption file",
      "video.subSrtHint": "An SRT file is written alongside",
      "video.subNone": "No captions",
      "video.subNoneHint": "Audio only",
      "video.subSize": "Text size",
      "video.subSizeS": "Small",
      "video.subSizeM": "Medium",
      "video.subSizeL": "Large (for short-form video)",
      "video.subPos": "Position",
      "video.subPosBottom": "Bottom",
      "video.subPosCenter": "Lower center",
      "video.subPosTop": "Top",
      "video.voiceTitle": "Narration voice",
      "video.voiceId": "Voice",
      "video.engine": "Engine",
      "video.sampleRate": "Sample rate",
      "video.speechRate": "Speaking rate",
      "video.rateDefault": "100% (default)",
      "video.voiceTest": "Preview a short line with this voice",
      "video.voiceTestHint":
        "Some settings are not accepted by every voice and engine combination. Check with a short line before the full run.",
      "video.toastVoiceTest": "This is a mockup, so no audio plays.",
      "video.toNarration": "Draft the narration",
      "video.narrTitle": "Review and edit the narration",
      "video.narrSub": "AI drafted a script per page. The text you confirm here is what gets spoken.",
      "video.pageListTitle": "Pages",
      "video.aiDraft": "AI draft",
      "video.inputMode": "Script format",
      "video.modePlain": "Plain text",
      "video.modePlainHint": "Spoken as written",
      "video.modeSsml": "SSML for fine control",
      "video.modeSsmlHint": "Set readings, furigana and pauses",
      "video.script": "Narration script",
      "video.ssmlToolbar": "Insert SSML",
      "video.ssmlSub": "Reading",
      "video.ssmlRuby": "Furigana",
      "video.ssmlPhoneme": "Phonemes",
      "video.ssmlSpell": "Spell out",
      "video.ssmlBreak": "Pause",
      "video.ssmlRate": "Rate",
      "video.ssmlEmphasis": "Emphasis",
      "video.estHint": "This is an estimate. The final length is set from the measured audio.",
      "video.ssmlNote":
        "Furigana is expressed with the reading tag. Some tags are rejected by certain voice and engine combinations, so preview before the full run.",
      "video.previewAudio": "Preview this script",
      "video.regenScript": "Ask AI to redraft",
      "video.toastPreviewAudio": "This is a mockup, so no audio plays.",
      "video.toastRegenScript": "This is a mockup, so no redraft is generated.",
      "video.dictTitle": "Pronunciation dictionary (applies to the whole document)",
      "video.dictSub": "Define recurring terms once here instead of repeating them on every page.",
      "video.dictWord": "Written form",
      "video.dictRead": "Reading",
      "video.dictMethod": "Method",
      "video.dictSubTag": "Reading",
      "video.dictPhonemeTag": "Phonemes",
      "video.dictSpellTag": "Spell out",
      "video.dictAdd": "Add row",
      "video.generate": "Generate the video",
      "video.jobTitle": "Generation progress",
      "video.jobSub": "Stages run in order. If one fails, only that stage is retried.",
      "video.job1": "Convert pages to images",
      "video.job2": "Synthesize narration audio",
      "video.job3": "Measure audio length and build captions",
      "video.job4": "Render one clip per page",
      "video.job5": "Join all pages and export",
      "video.jobWaiting": "Waiting to start",
      "video.resultTitle": "Your video is ready",
      "video.resultPreview": "Preview of the finished video",
      "video.resultCaption": "Plays with captions",
      "video.resFile": "File",
      "video.resPages": "Pages",
      "video.res5pages": "5 pages",
      "video.resDuration": "Length",
      "video.resVideo": "Video",
      "video.resAudio": "Audio",
      "video.dlMp4": "Download MP4",
      "video.dlSrt": "Captions (SRT)",
      "video.dlAudio": "Audio files",
      "video.reuseNote": "If the script is unchanged, another size can be exported without redoing the audio.",
      "video.makeVertical": "Also export vertical (1080x1920) from this script",
      "video.toastVertical": "This is a mockup, so no extra export runs.",
      "video.backNarration": "Back to narration editing",

      "video.ssmlUnavailable": "Not supported by the selected voice and engine",
      "video.ssmlPartial": "Results vary by voice. Preview before the full run",
      "video.cheatsheetOpen": "SSML cheat sheet",
      "video.cheatsheetTitle": "Amazon Polly SSML cheat sheet",
      "video.cheatsheetClose": "Close",
      "video.cheatsheetMoveHelp":
        "Drag the header to move this panel. Focus the header and use arrow keys to move it. Drag the lower right corner to resize.",
      "video.cheatsheetThPurpose": "Purpose",
      "video.cheatsheetThTag": "Tag and syntax",
      "video.cheatsheetThSupport": "Support",
      "video.cheatsheetThInsert": "Insert",
      "video.cheatsheetInsert": "Insert",
      "video.supportFull": "Supported",
      "video.supportPartial": "Partial",
      "video.supportNone": "Not supported",
      "video.supportSelect": "Select voices only",
      "video.cheatsheetNote1":
        "Neural voices support the volume and rate attributes of prosody but not pitch. Standard voices support all of them.",
      "video.cheatsheetNote2":
        "With neural voices, say-as characters causes the affected sentence to be synthesized with the related standard voice, and it is still billed as a neural voice.",
      "video.cheatsheetNote3": "Using an unsupported tag returns an error. Preview before the full run.",
      "video.cheatsheetSource": "Source: Amazon Polly documentation, Supported SSML tags",

      "cost.sectionTitle": "Cost per stage",
      "cost.sectionSub": "Estimated from measured usage. Actual charges are reconciled later.",
      "cost.thStage": "Stage",
      "cost.thService": "Service",
      "cost.thUsage": "Usage",
      "cost.thEstimate": "Estimated cost",
      "cost.stageOutline": "Outline generation",
      "cost.stageDeck": "Deck generation",
      "cost.stageNarration": "Narration drafting",
      "cost.stagePages": "Page image conversion",
      "cost.stageAudio": "Speech synthesis",
      "cost.stageCaptions": "Caption generation",
      "cost.stageClips": "Per-page clip rendering",
      "cost.stageConcat": "Join and export",
      "cost.stageStorage": "Storage and requests",
      "cost.stageOrchestration": "Stage orchestration",
      "cost.total": "Estimated total",
      "cost.estimateBadge": "Estimate",
      "cost.actualBadge": "Actual",
      "cost.actualPending": "Actual: pending (up to 24 hours to appear)",
      "cost.unitNote":
        "The unit prices shown are placeholders for this mockup. The implementation reads unit prices from the AWS Price List API and records the date they were fetched.",
      "cost.disclaimer": "Free tier is not applied. Local currency depends on the exchange rate at billing time.",
      "cost.audioLine": "Estimated speech cost for this script",
      "cost.ssmlExcluded": "SSML tags are not counted as billed characters.",
      "cost.deckEstimate": "Estimated cost of generating this deck",
      "cost.recentCost": "Est. cost",

      "js.slideLabel": "Slide {n}",
      "js.pageLabel": "Page {n}",
      "js.chars": "{n} characters",
      "js.estSec": "about {n} s",
      "js.totalEst": "Estimated total for {count} pages: about {sec} s",
      "js.newSlideTitle": "New slide",
      "js.jobRunning": "Running: {name}",
      "js.jobDone": "Finished. The exported files are listed below.",
      "js.contentLangNote": "Content is still shown in Japanese",
      "js.usageTokens": "{in} in / {out} out tokens",
      "js.usageChars": "{n} billed characters",
      "js.usageGbSec": "{n} GB-seconds",
      "js.usageStorage": "{puts} requests / {gb} GB-month",
      "js.usageTransitions": "{n} state transitions",
      "js.usd": "{n} USD",
      "js.ssmlUnavailableList": "Not supported by the current engine ({engine}): {tags}",
      "js.ssmlAllAvailable": "All listed tags are supported by the current engine ({engine}).",
      "js.audioCost": "{label}: {cost} ({chars})",
      "js.cheatsheetEngine": "Current engine: {engine}"
    }
  };

  var listeners = [];
  var current = "ja";

  // 保存領域はブラウザ設定によって使えないことがあるため、失敗しても続行する。
  function readStored() {
    try {
      return window.localStorage.getItem("mockup-lang");
    } catch (error) {
      return null;
    }
  }

  function writeStored(lang) {
    try {
      window.localStorage.setItem("mockup-lang", lang);
    } catch (error) {
      /* 保存できない環境では無視する */
    }
  }

  function resolveInitialLang() {
    var fromQuery = new URLSearchParams(window.location.search).get("lang");
    if (fromQuery === "ja" || fromQuery === "en") {
      return fromQuery;
    }
    var stored = readStored();
    return stored === "en" ? "en" : "ja";
  }

  function translate(key, vars) {
    var table = DICT[current] || DICT.ja;
    var text = table[key];
    if (typeof text !== "string") {
      return null;
    }
    if (!vars) {
      return text;
    }
    return text.replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
    });
  }

  function applyAttr(attrName, targetAttr) {
    var nodes = document.querySelectorAll("[" + attrName + "]");
    Array.prototype.forEach.call(nodes, function (node) {
      var text = translate(node.getAttribute(attrName));
      if (text !== null) {
        node.setAttribute(targetAttr, text);
      }
    });
  }

  function apply() {
    document.documentElement.lang = current;

    // 本文テキスト
    var nodes = document.querySelectorAll("[data-i18n]");
    Array.prototype.forEach.call(nodes, function (node) {
      var text = translate(node.getAttribute("data-i18n"));
      if (text !== null) {
        node.textContent = text;
      }
    });

    applyAttr("data-i18n-placeholder", "placeholder");
    applyAttr("data-i18n-aria-label", "aria-label");

    // ページタイトル
    var titleKey = document.body.getAttribute("data-i18n-title");
    if (titleKey) {
      var titleText = translate(titleKey);
      if (titleText !== null) {
        document.title = titleText;
      }
    }

    // 言語切替ボタンの選択状態
    var buttons = document.querySelectorAll(".lang-btn");
    Array.prototype.forEach.call(buttons, function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-lang") === current));
    });

    listeners.forEach(function (callback) {
      callback(current);
    });
  }

  function setLang(lang) {
    current = lang === "en" ? "en" : "ja";
    writeStored(current);
    updateInternalLinks();

    // 画面を再読み込みせずにURLへ言語を残す（別ページへ引き継ぐため）
    try {
      var url = new URL(window.location.href);
      url.searchParams.set("lang", current);
      window.history.replaceState({}, "", url);
    } catch (error) {
      /* file:// などで失敗しても表示は継続する */
    }

    apply();
  }

  // ページをまたいでも表示言語を保つため、内部リンクへ lang を付ける。
  function updateInternalLinks() {
    var links = document.querySelectorAll('a[href$=".html"], a[href*=".html?"]');
    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute("href");
      if (!href || href.indexOf("http") === 0) {
        return;
      }
      var parts = href.split("#");
      var base = parts[0];
      var hash = parts[1] ? "#" + parts[1] : "";
      var query = base.indexOf("?") >= 0 ? base.substring(base.indexOf("?") + 1) : "";
      var path = base.indexOf("?") >= 0 ? base.substring(0, base.indexOf("?")) : base;
      var params = new URLSearchParams(query);
      params.set("lang", current);
      link.setAttribute("href", path + "?" + params.toString() + hash);
    });
  }

  window.MockI18n = {
    t: function (key, vars) {
      var text = translate(key, vars);
      return text === null ? key : text;
    },
    get lang() {
      return current;
    },
    onChange: function (callback) {
      listeners.push(callback);
    },
    init: function () {
      current = resolveInitialLang();
      updateInternalLinks();
      apply();

      var buttons = document.querySelectorAll(".lang-btn");
      Array.prototype.forEach.call(buttons, function (button) {
        button.addEventListener("click", function () {
          setLang(button.getAttribute("data-lang"));
        });
      });
    }
  };
})();
