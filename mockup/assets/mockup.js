/*
  画面モックアップの操作。
  - 通信、AWS呼び出し、ファイル生成は一切行わない。
  - サンプルデータは、実際にローカルで生成した Kiro Crew 資料の内容をそのまま使用している。
*/

(function () {
  "use strict";

  var t = function (key, vars) {
    return window.MockI18n ? window.MockI18n.t(key, vars) : key;
  };

  /* ============ サンプルデータ ============ */

  // ②で作るスライド骨子（実際に生成した5ページ構成）
  var OUTLINE = [
    {
      lead: true,
      title: "Kiro Crew 入門",
      body: [
        "継続するAIエージェント作業を、安全に始めるために",
        "AWS利用経験が浅い開発者向け / 5分で全体像をつかむ資料",
        "大切な前提: AWSのフルマネージドサービスではなく、ローカルまたは自分で管理するリモート環境で動かせるオープンソースのAIエージェント"
      ].join("\n"),
      notes: "冒頭で「マネージドサービスではない」ことを明確に伝える。"
    },
    {
      title: "1. Kiro Crew とは",
      body: [
        "ひとことで言うと、会話が終わっても文脈を引き継げる個人用AIエージェント基盤",
        "実行場所を選べる: 手元のPC、または自分が管理するリモートマシン",
        "継続して働く: 記憶・スキル・設定を次のセッションへ引き継ぐ",
        "複数の入口: デスクトップ、Webダッシュボード、CLI、チャットなど",
        "既存設定を活用: Kiroの設定をそのまま利用できる設計"
      ].join("\n"),
      notes: ""
    },
    {
      title: "2. どんな作業に向くか",
      body: [
        "単発の質問より、複数セッション・複数ツール・待ち時間をまたぐ作業で価値が出る",
        "PRや障害の状況確認: 定期チェック、変化の検知、要点のまとめ",
        "長時間の移行作業: チェックポイント、検証、再試行の継続",
        "課題・チケットの整理: 仕分けと要確認事項の抽出",
        "調査と実装の並行処理: サブエージェントへの委任と結果の統合",
        "注意: 最初から本番変更を任せず、影響範囲の小さい作業から始める"
      ].join("\n"),
      notes: "表形式で見せる案もある。"
    },
    {
      title: "3. 安全性: 「任せる」前に確認すること",
      body: [
        "コードやCIにアクセスできるため、権限管理が最も重要",
        "公式情報ではサンドボックス、既定で拒否するコマンド方針、機密パス保護、資格情報のマスキング、監査ログが説明されている",
        "テスト用または読み取り中心のリポジトリから開始する",
        "ツール実行の承認を有効にし、最初は毎回内容を確認する",
        "秘密鍵やアクセストークンを作業領域へ置かない",
        "実行履歴と差分を人がレビューしてから採用する"
      ].join("\n"),
      notes: ""
    },
    {
      title: "4. 最初の一歩",
      body: [
        "公式のインストール手順を確認する",
        "セットアップと診断コマンドを順に実行する",
        "ローカルのダッシュボードで状態を確認する",
        "小さく始めて段階的に広げる（例: 朝のPR要約から）",
        "出典はすべて2026-08-15参照。内容は要約・言い換え"
      ].join("\n"),
      notes: "最終ページに出典URLを記載する。"
    }
  ];

  // ③で使うナレーション原稿（実際にPollyへ渡した原稿）
  var NARRATION = [
    "この資料では、Kiro Crewの全体像と、安全に始めるための考え方を説明します。Kiro Crewは、AWSのフルマネージドサービスではありません。ローカルPCや、自分で管理するリモートマシンで動かせる、オープンソースのAIエージェントです。便利な自動化の前に、実行場所と権限を自分で選び、確認できることを押さえましょう。",
    "Kiro Crewは、一回のチャットで終わらない開発作業を扱うための個人用AIエージェント基盤です。会話やプロジェクトの文脈、スキル、設定を次のセッションへ引き継げます。デスクトップ、Webダッシュボード、CLI、Slackなど、複数の入口から同じ作業を続けられることも特徴です。",
    "Kiro Crewが特に向くのは、複数のツールや時間をまたぐ作業です。たとえば、プルリクエストの定期確認、障害の調査、長時間の移行、チケットの仕分けです。独立した調査や実装は、サブエージェントへ並行して任せ、結果をまとめることもできます。ただし最初は、本番変更ではなく、読み取り中心の調査やレポート作成から始めることが重要です。",
    "AIエージェントにコードやCIへのアクセスを与えるときは、権限管理が最も重要です。Kiro Crewでは、サンドボックス、既定で拒否するコマンド方針、機密パスの保護、資格情報のマスキング、監査ログなど、多層的な安全策が説明されています。利用者側でも、承認を有効にし、秘密情報を置かず、実行履歴と変更差分を必ず人がレビューする運用から始めましょう。",
    "最初に、使っているOS向けの公式インストール手順を確認します。セットアップ後は、セットアップ、診断、ゲートウェイの順に実行し、ローカルのダッシュボードで状態を確認します。最初の仕事には、朝のプルリクエスト要約のような、小さくて確認しやすい作業を選びます。安全に見守れることを確認してから、定期監視や外部連携へ段階的に広げましょう。"
  ];

  // 日本語ナレーションの目安。実測（5ページ139.5秒）から逆算した概算値。
  var CHARS_PER_SEC = 6.6;

  function estimateSeconds(text) {
    var plain = text.replace(/<[^>]*>/g, "");
    return Math.round((plain.length / CHARS_PER_SEC) * 10) / 10;
  }

  function billedCharacters(text) {
    // SSMLタグは課金対象の文字数に含まれないため、タグを除いて数える。
    return text.replace(/<[^>]*>/g, "").length;
  }

  /* ============ 費用の推定 ============ */

  // 画面確認用のサンプル単価（USD）。実装時はAWS Price List APIから取得した単価に置き換える。
  var UNIT_PRICES = {
    bedrockInputPer1KTokens: 0.0008,
    bedrockOutputPer1KTokens: 0.0032,
    pollyNeuralPerMillionChars: 16.0,
    lambdaPerGbSecond: 0.0000166667,
    s3PutPer1KRequests: 0.005,
    s3StoragePerGbMonth: 0.025,
    stepFunctionsPer1KTransitions: 0.025
  };

  function usd(value) {
    return t("js.usd", { n: value.toFixed(4) });
  }

  function bedrockCost(inputTokens, outputTokens) {
    return (
      (inputTokens / 1000) * UNIT_PRICES.bedrockInputPer1KTokens +
      (outputTokens / 1000) * UNIT_PRICES.bedrockOutputPer1KTokens
    );
  }

  function pollyCost(characters) {
    return (characters / 1000000) * UNIT_PRICES.pollyNeuralPerMillionChars;
  }

  function lambdaCost(gbSeconds) {
    return gbSeconds * UNIT_PRICES.lambdaPerGbSecond;
  }

  function storageCost(putRequests, gigabytes) {
    return (
      (putRequests / 1000) * UNIT_PRICES.s3PutPer1KRequests + gigabytes * UNIT_PRICES.s3StoragePerGbMonth
    );
  }

  function stepFunctionsCost(transitions) {
    return (transitions / 1000) * UNIT_PRICES.stepFunctionsPer1KTransitions;
  }

  function renderCostTable(bodyId, totalId, rows) {
    var body = document.getElementById(bodyId);
    var total = document.getElementById(totalId);
    if (!body || !total) {
      return;
    }

    body.textContent = "";
    var sum = 0;

    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      [t(row.stageKey), row.service, row.usage].forEach(function (text) {
        var td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });

      var costCell = document.createElement("td");
      costCell.className = "num";
      costCell.textContent = usd(row.cost);
      tr.appendChild(costCell);

      body.appendChild(tr);
      sum += row.cost;
    });

    total.textContent = usd(sum);
  }

  /* ============ SSMLタグの対応状況 ============ */

  // Amazon Pollyの対応表に基づく。ニューラル音声では強調タグが使えない。
  var SSML_AVAILABILITY = {
    neural: {
      sub: "full",
      phoneme: "full",
      break: "full",
      "say-as": "partial",
      prosody: "partial",
      emphasis: "none"
    },
    standard: {
      sub: "full",
      phoneme: "full",
      break: "full",
      "say-as": "full",
      prosody: "full",
      emphasis: "full"
    }
  };

  /*
    SSMLチートシートの内容。
    対応状況はAmazon Polly公式ドキュメント「Supported SSML tags」の対応表に基づく。
    neural には ニューラル音声での対応（full / partial / none / select）を持たせる。
    標準音声では、ニュース読み上げ以外のタグが使える。
  */
  var SSML_CHEATSHEET = [
    { ja: "SSML全体を囲む", en: "Wrap the whole script", snippet: "<speak>|</speak>", neural: "full" },
    { ja: "間を入れる", en: "Add a pause", snippet: '<break time="400ms"/>', neural: "full" },
    { ja: "段落を区切る", en: "Separate paragraphs", snippet: "<p>|</p>", neural: "full" },
    { ja: "文を区切る", en: "Separate sentences", snippet: "<s>|</s>", neural: "full" },
    {
      ja: "別の読みに置き換える（振り仮名）",
      en: "Replace with another reading (furigana)",
      snippet: '<sub alias="キロクルー">|</sub>',
      neural: "full"
    },
    {
      ja: "発音記号で読ませる",
      en: "Use phonetic pronunciation",
      snippet: '<phoneme alphabet="x-sampa" ph="ki.ro">|</phoneme>',
      neural: "full"
    },
    { ja: "品詞を指定する", en: "Specify the part of speech", snippet: '<w role="amazon:VB">|</w>', neural: "full" },
    {
      ja: "一部を別の言語で読む",
      en: "Read part in another language",
      snippet: '<lang xml:lang="en-US">|</lang>',
      neural: "full"
    },
    { ja: "音量を変える", en: "Change volume", snippet: '<prosody volume="loud">|</prosody>', neural: "full" },
    { ja: "速度を変える", en: "Change speaking rate", snippet: '<prosody rate="95%">|</prosody>', neural: "full" },
    {
      ja: "声の高さを変える",
      en: "Change pitch",
      snippet: '<prosody pitch="+10%">|</prosody>',
      neural: "none"
    },
    {
      ja: "読み上げの最大の長さを指定する",
      en: "Set a maximum duration",
      snippet: '<prosody amazon:max-duration="3s">|</prosody>',
      neural: "none"
    },
    {
      ja: "数値として読む",
      en: "Read as a number",
      snippet: '<say-as interpret-as="cardinal">|</say-as>',
      neural: "full"
    },
    {
      ja: "1桁ずつ読む",
      en: "Read digit by digit",
      snippet: '<say-as interpret-as="digits">|</say-as>',
      neural: "full"
    },
    {
      ja: "日付として読む",
      en: "Read as a date",
      snippet: '<say-as interpret-as="date" format="ymd">|</say-as>',
      neural: "full"
    },
    {
      ja: "電話番号として読む",
      en: "Read as a telephone number",
      snippet: '<say-as interpret-as="telephone">|</say-as>',
      neural: "full"
    },
    {
      ja: "1文字ずつ読む",
      en: "Spell out each character",
      snippet: '<say-as interpret-as="characters">|</say-as>',
      neural: "partial"
    },
    { ja: "位置に目印を付ける", en: "Place a marker", snippet: '<mark name="chapter1"/>', neural: "full" },
    { ja: "強調する", en: "Emphasize words", snippet: '<emphasis level="moderate">|</emphasis>', neural: "none" },
    {
      ja: "ニュース読み上げの話し方にする",
      en: "Use the newscaster style",
      snippet: '<amazon:domain name="news">|</amazon:domain>',
      neural: "select"
    },
    {
      ja: "音の大小の差を圧縮する",
      en: "Apply dynamic range compression",
      snippet: '<amazon:effect name="drc">|</amazon:effect>',
      neural: "full"
    },
    {
      ja: "息継ぎの音を入れる",
      en: "Add breathing sounds",
      snippet: "<amazon:auto-breaths>|</amazon:auto-breaths>",
      neural: "none"
    },
    {
      ja: "ささやき声にする",
      en: "Whisper",
      snippet: '<amazon:effect name="whispered">|</amazon:effect>',
      neural: "none"
    },
    {
      ja: "柔らかい声にする",
      en: "Speak softly",
      snippet: '<amazon:effect phonation="soft">|</amazon:effect>',
      neural: "none"
    },
    {
      ja: "声質を変える",
      en: "Change the timbre",
      snippet: '<amazon:effect vocal-tract-length="+10%">|</amazon:effect>',
      neural: "none"
    }
  ];

  // 標準音声では、ニュース読み上げ以外のタグが使える。
  function supportFor(entry, engine) {
    if (engine === "standard") {
      return entry.neural === "select" ? "none" : "full";
    }
    return entry.neural;
  }

  /* ============ 共通部品 ============ */

  var toastTimer = null;

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 3200);
  }

  // ステップ表示を切り替える。表示時に実行したい処理は onShow に登録する。
  var stepHooks = {};

  function showStep(id) {
    var panels = document.querySelectorAll("[data-step-panel]");
    if (!panels.length) {
      return;
    }
    Array.prototype.forEach.call(panels, function (panel) {
      panel.hidden = panel.id !== id;
    });

    var items = document.querySelectorAll("[data-steps] li");
    Array.prototype.forEach.call(items, function (item) {
      var button = item.querySelector("[data-step-target]");
      var isCurrent = Boolean(button) && button.getAttribute("data-step-target") === id;
      if (isCurrent) {
        item.setAttribute("aria-current", "step");
      } else {
        item.removeAttribute("aria-current");
      }
    });

    var panel = document.getElementById(id);
    if (panel) {
      var heading = panel.querySelector("h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
    window.scrollTo({ top: 0, behavior: "auto" });

    if (typeof stepHooks[id] === "function") {
      stepHooks[id]();
    }

    // ステップが変わったことを通知する（チートシートの開閉などで使う）
    document.dispatchEvent(new CustomEvent("mock:step", { detail: { id: id } }));
  }

  function setupCommon() {
    // ステップ移動
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-step-target]");
      if (!target) {
        return;
      }
      event.preventDefault();
      showStep(target.getAttribute("data-step-target"));
    });

    // モック動作の通知
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-mock-toast]");
      if (!target) {
        return;
      }
      event.preventDefault();
      var key = target.getAttribute("data-mock-toast");
      showToast(key.indexOf(".") > 0 ? t(key) : key);
    });

    // パスワード表示切り替え
    var toggles = document.querySelectorAll("[data-toggle-password]");
    Array.prototype.forEach.call(toggles, function (toggle) {
      toggle.addEventListener("change", function () {
        var field = document.getElementById(toggle.getAttribute("data-toggle-password"));
        if (field) {
          field.type = toggle.checked ? "text" : "password";
        }
      });
    });

    // モックのフォーム送信（認証は行わず画面遷移だけする）
    var forms = document.querySelectorAll("[data-mock-submit]");
    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var to = form.getAttribute("data-mock-submit");
        var lang = window.MockI18n ? window.MockI18n.lang : "ja";
        window.location.href = to + "?lang=" + lang;
      });
    });
  }

  /* ============ 疑似スライドの描画 ============ */

  function buildThumb(item, index, captionText) {
    var figure = document.createElement("figure");
    figure.className = "slide-thumb";
    figure.style.margin = "0";

    var canvas = document.createElement("div");
    canvas.className = "slide-canvas" + (item.lead ? " is-lead" : "");

    var heading = document.createElement("h4");
    heading.textContent = item.title;
    canvas.appendChild(heading);

    var lines = item.body.split("\n").filter(function (line) {
      return line.trim() !== "";
    });

    if (item.lead) {
      // 表紙は白いボックスの中に説明を置く。文字色は濃色にして読めるようにする。
      var subtitle = document.createElement("div");
      subtitle.textContent = lines[0] || "";
      subtitle.style.fontSize = "10px";
      subtitle.style.marginBottom = "4px";
      canvas.appendChild(subtitle);

      var box = document.createElement("div");
      box.className = "mini-box";
      box.textContent = lines[lines.length - 1] || "";
      canvas.appendChild(box);
    } else {
      var list = document.createElement("ul");
      lines.slice(0, 4).forEach(function (line) {
        var li = document.createElement("li");
        li.textContent = line.length > 46 ? line.slice(0, 46) + "…" : line;
        list.appendChild(li);
      });
      canvas.appendChild(list);
    }

    figure.appendChild(canvas);

    var caption = document.createElement("figcaption");
    var left = document.createElement("span");
    left.textContent = captionText;
    caption.appendChild(left);

    var right = document.createElement("span");
    right.textContent = String(index + 1) + " / " + OUTLINE.length;
    caption.appendChild(right);

    figure.appendChild(caption);
    return figure;
  }

  function renderThumbs(container, labelKey) {
    if (!container) {
      return;
    }
    container.textContent = "";
    OUTLINE.forEach(function (item, index) {
      container.appendChild(buildThumb(item, index, t(labelKey, { n: index + 1 })));
    });
  }

  /* ============ ② スライド作成画面 ============ */

  function setupSlideStudio() {
    var selected = 0;

    var list = document.getElementById("outline-list");
    var titleInput = document.getElementById("outline-title");
    var bodyInput = document.getElementById("outline-body");
    var notesInput = document.getElementById("outline-notes");
    var indexLabel = document.getElementById("outline-index-label");

    function renderList() {
      list.textContent = "";
      OUTLINE.forEach(function (item, index) {
        var li = document.createElement("li");
        var button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-current", String(index === selected));

        var label = document.createElement("span");
        label.textContent = String(index + 1) + ". " + item.title;
        button.appendChild(label);

        var count = document.createElement("span");
        count.className = "dur";
        count.textContent =
          String(
            item.body.split("\n").filter(function (line) {
              return line.trim() !== "";
            }).length
          ) + (window.MockI18n && window.MockI18n.lang === "en" ? " items" : " 項目");
        button.appendChild(count);

        button.addEventListener("click", function () {
          saveCurrent();
          selected = index;
          renderList();
          loadCurrent();
        });

        li.appendChild(button);
        list.appendChild(li);
      });
    }

    function loadCurrent() {
      var item = OUTLINE[selected];
      titleInput.value = item.title;
      bodyInput.value = item.body;
      notesInput.value = item.notes || "";
      indexLabel.textContent = t("js.slideLabel", { n: selected + 1 });
    }

    function saveCurrent() {
      var item = OUTLINE[selected];
      if (!item) {
        return;
      }
      item.title = titleInput.value;
      item.body = bodyInput.value;
      item.notes = notesInput.value;
    }

    [titleInput, bodyInput, notesInput].forEach(function (field) {
      field.addEventListener("input", function () {
        saveCurrent();
        renderList();
      });
    });

    document.getElementById("outline-up").addEventListener("click", function () {
      if (selected === 0) {
        return;
      }
      saveCurrent();
      var moved = OUTLINE.splice(selected, 1)[0];
      selected -= 1;
      OUTLINE.splice(selected, 0, moved);
      renderList();
      loadCurrent();
    });

    document.getElementById("outline-down").addEventListener("click", function () {
      if (selected >= OUTLINE.length - 1) {
        return;
      }
      saveCurrent();
      var moved = OUTLINE.splice(selected, 1)[0];
      selected += 1;
      OUTLINE.splice(selected, 0, moved);
      renderList();
      loadCurrent();
    });

    document.getElementById("outline-add").addEventListener("click", function () {
      saveCurrent();
      OUTLINE.splice(selected + 1, 0, { title: t("js.newSlideTitle"), body: "", notes: "" });
      selected += 1;
      renderList();
      loadCurrent();
      titleInput.focus();
    });

    document.getElementById("outline-delete").addEventListener("click", function () {
      if (OUTLINE.length <= 1) {
        return;
      }
      OUTLINE.splice(selected, 1);
      selected = Math.max(0, selected - 1);
      renderList();
      loadCurrent();
    });

    // 参考URLの行を増減する
    var urlRows = document.getElementById("url-rows");
    document.getElementById("add-url").addEventListener("click", function () {
      var row = document.createElement("div");
      row.className = "url-row";

      var input = document.createElement("input");
      input.type = "url";
      input.placeholder = "https://";
      input.setAttribute("aria-label", t("slide.refUrlAria"));
      input.setAttribute("data-i18n-aria-label", "slide.refUrlAria");
      row.appendChild(input);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-danger btn-sm";
      remove.setAttribute("data-remove-url", "");
      remove.setAttribute("data-i18n", "common.remove");
      remove.textContent = t("common.remove");
      row.appendChild(remove);

      urlRows.appendChild(row);
      input.focus();
    });

    urlRows.addEventListener("click", function (event) {
      var button = event.target.closest("[data-remove-url]");
      if (!button) {
        return;
      }
      if (urlRows.querySelectorAll(".url-row").length <= 1) {
        return;
      }
      button.closest(".url-row").remove();
    });

    // ②で発生した費用の内訳（モックの使用量から計算する）
    function renderDeckCosts() {
      var outlineTokens = { input: 1240, output: 980 };
      renderCostTable("deck-cost-body", "deck-cost-total", [
        {
          stageKey: "cost.stageOutline",
          service: "Amazon Bedrock",
          usage: t("js.usageTokens", { in: outlineTokens.input, out: outlineTokens.output }),
          cost: bedrockCost(outlineTokens.input, outlineTokens.output)
        },
        {
          stageKey: "cost.stageDeck",
          service: "AWS Lambda",
          usage: t("js.usageGbSec", { n: "6.8" }),
          cost: lambdaCost(6.8)
        },
        {
          stageKey: "cost.stageStorage",
          service: "Amazon S3",
          usage: t("js.usageStorage", { puts: 3, gb: "0.004" }),
          cost: storageCost(3, 0.004)
        }
      ]);
    }

    // ステップ3を開いたときにサムネイルと費用を描き直す
    stepHooks["step-3"] = function () {
      saveCurrent();
      renderThumbs(document.getElementById("deck-thumbs"), "js.slideLabel");
      renderDeckCosts();
    };

    renderList();
    loadCurrent();

    window.MockI18n.onChange(function () {
      renderList();
      indexLabel.textContent = t("js.slideLabel", { n: selected + 1 });
      var thumbs = document.getElementById("deck-thumbs");
      if (thumbs && thumbs.children.length) {
        renderThumbs(thumbs, "js.slideLabel");
        renderDeckCosts();
      }
    });
  }

  /* ============ ③ 動画作成画面 ============ */

  function setupVideoStudio() {
    var selected = 0;
    var scripts = NARRATION.slice();
    var ssmlMode = false;

    var narrList = document.getElementById("narr-list");
    var narrText = document.getElementById("narr-text");
    var narrLabel = document.getElementById("narr-index-label");
    var charCount = document.getElementById("char-count");
    var estSec = document.getElementById("est-sec");
    var totalEst = document.getElementById("total-est");
    var ssmlNote = document.getElementById("ssml-note");
    var ssmlAvailability = document.getElementById("ssml-availability");
    var toolbarButtons = document.querySelectorAll("#ssml-toolbar button[data-ssml-tag]");
    var cheatsheet = document.getElementById("ssml-cheatsheet");
    var cheatsheetOpenButton = document.getElementById("cheatsheet-open");
    var costLine = document.getElementById("audio-cost-line");
    var engineSelect = document.getElementById("voice-engine");

    // 選択中のエンジンで使えないSSMLタグを無効化し、注意が必要なタグには説明を付ける。
    function updateSsmlAvailability() {
      var engine = engineSelect.value.trim();
      var map = SSML_AVAILABILITY[engine] || SSML_AVAILABILITY.standard;
      var unavailable = [];

      Array.prototype.forEach.call(toolbarButtons, function (button) {
        var tag = button.getAttribute("data-ssml-tag");
        var availability = map[tag] || "full";

        button.disabled = !ssmlMode || availability === "none";

        if (availability === "none") {
          button.title = t("video.ssmlUnavailable");
          unavailable.push("<" + tag + ">");
        } else if (availability === "partial") {
          button.title = t("video.ssmlPartial");
        } else {
          button.removeAttribute("title");
        }
      });

      cheatsheetOpenButton.disabled = !ssmlMode;

      ssmlAvailability.hidden = !ssmlMode;
      ssmlAvailability.textContent = unavailable.length
        ? t("js.ssmlUnavailableList", { engine: engine, tags: unavailable.join(", ") })
        : t("js.ssmlAllAvailable", { engine: engine });

      renderCheatsheet();
    }

    // 音声合成の推定コスト。課金対象文字数はSSMLタグを除いて数える。
    function updateAudioCostLine() {
      var characters = scripts.reduce(function (sum, text) {
        return sum + billedCharacters(text);
      }, 0);

      costLine.textContent =
        t("js.audioCost", {
          label: t("cost.audioLine"),
          cost: usd(pollyCost(characters)),
          chars: t("js.usageChars", { n: characters.toLocaleString() })
        }) +
        " " +
        t("cost.ssmlExcluded");
    }

    // ③で発生した費用の内訳。使用量はモックの値と、実際の原稿の文字数から求める。
    function renderVideoCosts() {
      var narrationTokens = { input: 1850, output: 1420 };
      var characters = scripts.reduce(function (sum, text) {
        return sum + billedCharacters(text);
      }, 0);

      renderCostTable("cost-body", "cost-total", [
        {
          stageKey: "cost.stageNarration",
          service: "Amazon Bedrock",
          usage: t("js.usageTokens", { in: narrationTokens.input, out: narrationTokens.output }),
          cost: bedrockCost(narrationTokens.input, narrationTokens.output)
        },
        {
          stageKey: "cost.stagePages",
          service: "AWS Lambda",
          usage: t("js.usageGbSec", { n: "12.4" }),
          cost: lambdaCost(12.4)
        },
        {
          stageKey: "cost.stageAudio",
          service: "Amazon Polly",
          usage: t("js.usageChars", { n: characters.toLocaleString() }),
          cost: pollyCost(characters)
        },
        {
          stageKey: "cost.stageCaptions",
          service: "AWS Lambda",
          usage: t("js.usageGbSec", { n: "0.9" }),
          cost: lambdaCost(0.9)
        },
        {
          stageKey: "cost.stageClips",
          service: "AWS Lambda",
          usage: t("js.usageGbSec", { n: "96.5" }),
          cost: lambdaCost(96.5)
        },
        {
          stageKey: "cost.stageConcat",
          service: "AWS Lambda",
          usage: t("js.usageGbSec", { n: "22.3" }),
          cost: lambdaCost(22.3)
        },
        {
          stageKey: "cost.stageStorage",
          service: "Amazon S3",
          usage: t("js.usageStorage", { puts: 17, gb: "0.062" }),
          cost: storageCost(17, 0.062)
        },
        {
          stageKey: "cost.stageOrchestration",
          service: "AWS Step Functions",
          usage: t("js.usageTransitions", { n: 24 }),
          cost: stepFunctionsCost(24)
        }
      ]);
    }

    // ②から遷移してきた場合の引き継ぎ表示
    var from = new URLSearchParams(window.location.search).get("from");
    if (from === "slide") {
      var handoff = document.getElementById("handoff-card");
      if (handoff) {
        handoff.hidden = false;
      }
    }

    renderThumbs(document.getElementById("source-thumbs"), "js.pageLabel");

    function renderNarrList() {
      narrList.textContent = "";
      scripts.forEach(function (text, index) {
        var li = document.createElement("li");
        var button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-current", String(index === selected));

        var label = document.createElement("span");
        label.textContent = t("js.pageLabel", { n: index + 1 }) + " " + OUTLINE[index].title;
        button.appendChild(label);

        var dur = document.createElement("span");
        dur.className = "dur";
        dur.textContent = t("js.estSec", { n: estimateSeconds(text).toFixed(1) });
        button.appendChild(dur);

        button.addEventListener("click", function () {
          scripts[selected] = narrText.value;
          selected = index;
          renderNarrList();
          loadScript();
        });

        li.appendChild(button);
        narrList.appendChild(li);
      });

      var total = scripts.reduce(function (sum, text) {
        return sum + estimateSeconds(text);
      }, 0);
      totalEst.textContent = t("js.totalEst", { count: scripts.length, sec: total.toFixed(1) });
    }

    function loadScript() {
      narrText.value = scripts[selected];
      narrLabel.textContent = t("js.pageLabel", { n: selected + 1 });
      updateCounter();
    }

    function updateCounter() {
      var text = narrText.value;
      charCount.textContent = t("js.chars", { n: billedCharacters(text) });
      estSec.textContent = t("js.estSec", { n: estimateSeconds(text).toFixed(1) });
      updateAudioCostLine();
    }

    narrText.addEventListener("input", function () {
      scripts[selected] = narrText.value;
      updateCounter();
    });

    narrText.addEventListener("blur", renderNarrList);

    // 通常文章とSSMLの切り替え
    var modeInputs = document.querySelectorAll('input[name="narr-mode"]');
    Array.prototype.forEach.call(modeInputs, function (input) {
      input.addEventListener("change", function () {
        ssmlMode = input.value === "ssml";
        ssmlNote.hidden = !ssmlMode;
        updateSsmlAvailability();

        // SSMLを選んだら、参照用のチートシートを開く
        if (ssmlMode) {
          openCheatsheet();
        } else {
          closeCheatsheet(false);
        }

        var current = narrText.value;
        if (ssmlMode) {
          if (current.indexOf("<speak>") === -1) {
            narrText.value = "<speak>" + current + "</speak>";
          }
        } else {
          narrText.value = current.replace(/^<speak>/, "").replace(/<\/speak>$/, "");
        }
        scripts[selected] = narrText.value;
        updateCounter();
      });
    });

    /*
      SSMLの挿入。テンプレートに「|」があれば選択範囲を囲み、無ければカーソル位置へ挿入する。
      ツールバーとチートシートの両方から使う。
    */
    function insertIntoScript(template) {
      if (!template) {
        return;
      }

      var start = narrText.selectionStart;
      var end = narrText.selectionEnd;
      var value = narrText.value;
      var replacement =
        template.indexOf("|") >= 0 ? template.replace("|", value.slice(start, end)) : template;

      narrText.value = value.slice(0, start) + replacement + value.slice(end);
      scripts[selected] = narrText.value;

      var caret = start + replacement.length;
      narrText.focus();
      narrText.setSelectionRange(caret, caret);
      updateCounter();
    }

    Array.prototype.forEach.call(toolbarButtons, function (button) {
      button.addEventListener("click", function () {
        insertIntoScript(button.getAttribute("data-ssml-wrap") || button.getAttribute("data-ssml-insert"));
      });
    });

    /* ---- 移動できるSSMLチートシート ---- */

    var supportLabels = {
      full: { key: "video.supportFull", className: "support-full" },
      partial: { key: "video.supportPartial", className: "support-partial" },
      none: { key: "video.supportNone", className: "support-none" },
      select: { key: "video.supportSelect", className: "support-select" }
    };

    function renderCheatsheet() {
      var body = document.getElementById("cheatsheet-body");
      var engineLabel = document.getElementById("cheatsheet-engine");
      if (!body) {
        return;
      }

      var engine = engineSelect.value.trim();
      var isEnglish = window.MockI18n.lang === "en";
      engineLabel.textContent = t("js.cheatsheetEngine", { engine: engine });
      body.textContent = "";

      SSML_CHEATSHEET.forEach(function (entry) {
        var support = supportFor(entry, engine);
        var meta = supportLabels[support] || supportLabels.full;
        var row = document.createElement("tr");

        var purpose = document.createElement("td");
        purpose.textContent = isEnglish ? entry.en : entry.ja;
        row.appendChild(purpose);

        var syntax = document.createElement("td");
        var code = document.createElement("code");
        code.textContent = entry.snippet;
        syntax.appendChild(code);
        row.appendChild(syntax);

        var supportCell = document.createElement("td");
        var supportText = document.createElement("span");
        supportText.className = "support " + meta.className;
        supportText.textContent = t(meta.key);
        supportCell.appendChild(supportText);
        row.appendChild(supportCell);

        var action = document.createElement("td");
        var insertButton = document.createElement("button");
        insertButton.type = "button";
        insertButton.className = "btn btn-ghost btn-sm";
        insertButton.textContent = t("video.cheatsheetInsert");
        insertButton.disabled = support === "none";
        if (support === "none") {
          insertButton.title = t("video.ssmlUnavailable");
        }
        insertButton.addEventListener("click", function () {
          insertIntoScript(entry.snippet);
        });
        action.appendChild(insertButton);
        row.appendChild(action);

        body.appendChild(row);
      });
    }

    function openCheatsheet() {
      cheatsheet.hidden = false;
      cheatsheetOpenButton.setAttribute("aria-expanded", "true");
      renderCheatsheet();
    }

    function closeCheatsheet(returnFocus) {
      cheatsheet.hidden = true;
      cheatsheetOpenButton.setAttribute("aria-expanded", "false");
      if (returnFocus && !cheatsheetOpenButton.disabled) {
        cheatsheetOpenButton.focus();
      }
    }

    cheatsheetOpenButton.addEventListener("click", function () {
      if (cheatsheet.hidden) {
        openCheatsheet();
        document.getElementById("cheatsheet-head").focus();
      } else {
        closeCheatsheet(false);
      }
    });

    document.getElementById("cheatsheet-close").addEventListener("click", function () {
      closeCheatsheet(true);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !cheatsheet.hidden) {
        closeCheatsheet(true);
      }
    });

    // ナレーション編集以外の画面へ移ったら閉じる
    document.addEventListener("mock:step", function (event) {
      if (event.detail.id !== "step-3") {
        closeCheatsheet(false);
      }
    });

    // 見出しをドラッグ、または矢印キーで移動する
    (function enableDrag() {
      var handle = document.getElementById("cheatsheet-head");
      var dragging = false;
      var startX = 0;
      var startY = 0;
      var startLeft = 0;
      var startTop = 0;

      function moveTo(left, top) {
        var maxLeft = Math.max(8, window.innerWidth - cheatsheet.offsetWidth - 8);
        var maxTop = Math.max(8, window.innerHeight - 60);
        cheatsheet.style.left = Math.min(Math.max(8, left), maxLeft) + "px";
        cheatsheet.style.top = Math.min(Math.max(8, top), maxTop) + "px";
        cheatsheet.style.right = "auto";
        cheatsheet.style.bottom = "auto";
      }

      handle.addEventListener("pointerdown", function (event) {
        if (event.target.closest("button")) {
          return;
        }
        var rect = cheatsheet.getBoundingClientRect();
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        cheatsheet.classList.add("is-dragging");
        handle.setPointerCapture(event.pointerId);
      });

      handle.addEventListener("pointermove", function (event) {
        if (!dragging) {
          return;
        }
        moveTo(startLeft + (event.clientX - startX), startTop + (event.clientY - startY));
      });

      ["pointerup", "pointercancel"].forEach(function (type) {
        handle.addEventListener(type, function () {
          dragging = false;
          cheatsheet.classList.remove("is-dragging");
        });
      });

      handle.addEventListener("keydown", function (event) {
        var offsets = {
          ArrowUp: [0, -16],
          ArrowDown: [0, 16],
          ArrowLeft: [-16, 0],
          ArrowRight: [16, 0]
        };
        var offset = offsets[event.key];
        if (!offset) {
          return;
        }
        event.preventDefault();
        var rect = cheatsheet.getBoundingClientRect();
        moveTo(rect.left + offset[0], rect.top + offset[1]);
      });
    })();

    // 画面サイズの選択をプレビューへ反映
    var previewFrame = document.getElementById("preview-frame");
    var previewDim = document.getElementById("preview-dim");
    var verticalOptions = document.getElementById("vertical-options");
    var aspectInputs = document.querySelectorAll('input[name="aspect"]');

    function applyAspect(input) {
      var aspect = input.getAttribute("data-aspect");
      var dim = input.getAttribute("data-dim");
      var isVertical = input.getAttribute("data-vertical") === "true";

      previewFrame.style.setProperty("--preview-aspect", aspect);
      previewFrame.classList.toggle("is-vertical", isVertical);
      previewDim.textContent = dim;
      verticalOptions.hidden = !isVertical;

      var resultPreview = document.getElementById("result-preview");
      var resultDim = document.getElementById("result-dim");
      if (resultPreview) {
        resultPreview.style.setProperty("--preview-aspect", aspect);
        resultPreview.classList.toggle("is-vertical", isVertical);
      }
      if (resultDim) {
        resultDim.textContent = dim;
      }
    }

    Array.prototype.forEach.call(aspectInputs, function (input) {
      input.addEventListener("change", function () {
        if (input.checked) {
          applyAspect(input);
        }
      });
      if (input.checked) {
        applyAspect(input);
      }
    });

    // セーフエリアの表示切り替え
    var safeArea = document.getElementById("safe-area");
    safeArea.addEventListener("change", function () {
      var existing = previewFrame.querySelector(".preview-safe");
      if (safeArea.checked && !existing) {
        var guide = document.createElement("div");
        guide.className = "preview-safe";
        guide.textContent = "safe area";
        previewFrame.appendChild(guide);
      } else if (!safeArea.checked && existing) {
        existing.remove();
      }
    });

    // 読み方辞書の行追加・削除
    var dictBody = document.getElementById("dict-body");
    document.getElementById("dict-add").addEventListener("click", function () {
      var template = dictBody.querySelector("tr");
      var row = template.cloneNode(true);
      Array.prototype.forEach.call(row.querySelectorAll("input"), function (input) {
        input.value = "";
      });
      dictBody.appendChild(row);
      var firstInput = row.querySelector("input");
      if (firstInput) {
        firstInput.focus();
      }
    });

    dictBody.addEventListener("click", function (event) {
      var button = event.target.closest("[data-remove-row]");
      if (!button) {
        return;
      }
      if (dictBody.querySelectorAll("tr").length <= 1) {
        return;
      }
      button.closest("tr").remove();
    });

    // 生成の進行表示（モック）
    var jobStarted = false;

    stepHooks["step-4"] = function () {
      if (jobStarted) {
        return;
      }
      jobStarted = true;

      var items = document.querySelectorAll("#progress-list li");
      var bar = document.getElementById("progress-bar");
      var text = document.getElementById("progress-text");
      var resultCard = document.getElementById("result-card");
      var costCard = document.getElementById("cost-card");
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var interval = reduceMotion ? 120 : 900;

      Array.prototype.forEach.call(items, function (item) {
        item.setAttribute("data-state", "wait");
      });
      bar.style.width = "0%";
      resultCard.hidden = true;
      costCard.hidden = true;

      var index = 0;

      function step() {
        if (index > 0) {
          items[index - 1].setAttribute("data-state", "done");
          items[index - 1].querySelector(".state").textContent = "OK";
        }

        if (index >= items.length) {
          bar.style.width = "100%";
          text.textContent = t("js.jobDone");
          resultCard.hidden = false;
          costCard.hidden = false;
          renderVideoCosts();
          return;
        }

        items[index].setAttribute("data-state", "run");
        var name = items[index].querySelector("span:last-child").textContent;
        text.textContent = t("js.jobRunning", { name: name });
        bar.style.width = String(Math.round((index / items.length) * 100)) + "%";
        index += 1;
        window.setTimeout(step, interval);
      }

      step();
    };

    // エンジンを変えたら、使えるSSMLタグの一覧を作り直す
    engineSelect.addEventListener("change", updateSsmlAvailability);

    renderNarrList();
    loadScript();
    updateSsmlAvailability();

    window.MockI18n.onChange(function () {
      renderNarrList();
      narrLabel.textContent = t("js.pageLabel", { n: selected + 1 });
      updateCounter();
      updateSsmlAvailability();
      renderThumbs(document.getElementById("source-thumbs"), "js.pageLabel");
      var costBody = document.getElementById("cost-body");
      if (costBody && costBody.children.length) {
        renderVideoCosts();
      }
    });
  }

  /* ============ 初期化 ============ */

  document.addEventListener("DOMContentLoaded", function () {
    window.MockI18n.init();
    setupCommon();

    var page = document.body.getAttribute("data-page");
    if (page === "slide-studio") {
      setupSlideStudio();
    } else if (page === "video-studio") {
      setupVideoStudio();
    }
  });
})();
