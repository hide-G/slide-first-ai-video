import { describe, expect, it } from "vitest";
import {
  detectNarrationLanguage,
  extractAudibleNarrationText,
  hasUnsupportedNarrationSsmlDeclaration,
  isNarrationTextInLanguage,
  prepareNarrationSsmlContent,
  resolveNarrationLanguage,
} from "./narration-language.js";

describe("ナレーション言語判定", () => {
  it("日本語本文を日本語として判定する", () => {
    const detection = detectNarrationLanguage(
      "AWSの可用性を高めるために、複数AZへワークロードを分散します。",
    );

    expect(detection).toMatchObject({ languageCode: "ja-JP" });
    expect(detection.japaneseCharacterCount).toBeGreaterThan(detection.latinCharacterCount);
  });

  it("英語本文を英語として判定する", () => {
    const detection = detectNarrationLanguage(
      "Amazon MediaConvert creates adaptive bitrate video outputs for multiple devices.",
    );

    expect(detection).toMatchObject({ languageCode: "en-US" });
    expect(detection.latinCharacterCount).toBeGreaterThan(detection.japaneseCharacterCount);
  });

  it("混在または短すぎる本文を不確定として扱う", () => {
    expect(detectNarrationLanguage("日本語 English").languageCode).toBeNull();
    expect(detectNarrationLanguage("図1").languageCode).toBeNull();
  });

  it("漢字だけまたは中国語の本文をAutoで日本語に決め打ちしない", () => {
    expect(detectNarrationLanguage("経営戦略").languageCode).toBeNull();
    expect(detectNarrationLanguage("这是中文说明文本").languageCode).toBeNull();
  });

  it("句読点なしで日本語へ連結した中国語をAutoで受理しない", () => {
    const mixedText = "これは日本語のナレーションです本次报告介绍人工智能技术";

    expect(detectNarrationLanguage(mixedText).languageCode).toBeNull();
    expect(isNarrationTextInLanguage(mixedText, "ja-JP")).toBe(false);
  });

  it("ページ上書き、プロジェクト設定、Auto判定の順で言語を決定する", () => {
    const englishText = "This slide explains the MediaConvert video encoding workflow.";

    expect(resolveNarrationLanguage("auto", englishText)).toBe("en-US");
    expect(resolveNarrationLanguage("ja-JP", englishText)).toBe("ja-JP");
    expect(resolveNarrationLanguage("ja-JP", englishText, "en-US")).toBe("en-US");
  });

  it("Autoで判定できない場合は既定の日本語へ戻さない", () => {
    expect(resolveNarrationLanguage("auto", "図1")).toBeNull();
  });

  it("生成原稿が期待した言語であることを検証できる", () => {
    expect(isNarrationTextInLanguage("This is an English narration draft.", "en-US")).toBe(true);
    expect(isNarrationTextInLanguage("これは日本語のナレーション原稿です。", "en-US")).toBe(
      false,
    );
  });
});

describe("SSML・辞書を含む可聴テキスト", () => {
  it("subは表示本文でなくaliasをAuto判定と検証の対象にする", () => {
    const audibleText = extractAudibleNarrationText({
      mode: "ssml",
      text: '<sub alias="Amazon Web Services">アマゾン・ウェブ・サービス</sub> provides cloud services.',
    });

    expect(audibleText).toBe("Amazon Web Services provides cloud services.");
    expect(resolveNarrationLanguage("auto", audibleText ?? "")).toBe("en-US");
    expect(isNarrationTextInLanguage(audibleText ?? "", "en-US")).toBe(true);
  });

  it("数値文字参照をデコードしたaliasで言語を検証する", () => {
    const audibleText = extractAudibleNarrationText({
      mode: "ssml",
      text: "<sub alias=\"&#x3053;&#x308C;&#x306f;&#x65e5;&#x672c;&#x8a9e;&#x3067;&#x3059;\">English</sub>",
    });

    expect(audibleText).toBe("これは日本語です");
    expect(isNarrationTextInLanguage(audibleText ?? "", "en-US")).toBe(false);
  });

  it("辞書展開後のsub aliasを可聴テキストとして使う", () => {
    const lexicon = [{ written: "AWS", reading: "アマゾンウェブサービス", method: "sub" as const }];
    const script = { mode: "plain" as const, text: "AWS" };

    expect(prepareNarrationSsmlContent(script, lexicon)).toBe(
      '<sub alias="アマゾンウェブサービス">AWS</sub>',
    );
    const audibleText = extractAudibleNarrationText(script, lexicon);
    expect(audibleText).toBe("アマゾンウェブサービス");
    expect(resolveNarrationLanguage("auto", audibleText ?? "")).toBe("ja-JP");
  });

  it("plain原稿はXMLエスケープしてから辞書を展開する", () => {
    const ssmlContent = prepareNarrationSsmlContent(
      { mode: "plain", text: "AWS & <value>" },
      [{ written: "AWS", reading: "Amazon Web Services", method: "sub" }],
    );

    expect(ssmlContent).toBe(
      '<sub alias="Amazon Web Services">AWS</sub> &amp; &lt;value&gt;',
    );
  });

  it("可聴テキストのリテラル角括弧はplain原稿として英語検証できる", () => {
    const audibleText = "This narration explains <code> tags in English.";

    expect(isNarrationTextInLanguage(audibleText, "en-US")).toBe(false);
    expect(
      isNarrationTextInLanguage(audibleText, "en-US", { allowLiteralMarkup: true }),
    ).toBe(true);
  });

  it.each([
    ["CDATA", "<prosody>This is English. <![CDATA[これは日本語です。]]></prosody>"],
    ["DOCTYPE", "<!DOCTYPE speak><prosody>This is English.</prosody>"],
    ["ENTITY", '<!ENTITY narration "This is English."><prosody>English</prosody>'],
  ] as const)("%sを含むSSMLは可聴テキストへ変換せず拒否する", (_kind, text) => {
    const script = { mode: "ssml" as const, text };

    expect(hasUnsupportedNarrationSsmlDeclaration(script)).toBe(true);
    expect(extractAudibleNarrationText(script)).toBeNull();
  });
});

describe("生成原稿の言語検証", () => {
  it("英語原稿へ日本語が混在した場合は英語として受理しない", () => {
    expect(
      isNarrationTextInLanguage(
        "This slide explains the MediaConvert workflow for multiple devices. 日本語の注記です。",
        "en-US",
      ),
    ).toBe(false);
  });

  it("AWS製品名を含む日本語原稿は日本語として受理する", () => {
    expect(
      isNarrationTextInLanguage(
        "Amazon EC2 は、クラウド上で仮想サーバーを提供します。",
        "ja-JP",
      ),
    ).toBe(true);
  });

  it("漢字主体の自然な日本語原稿は受理する", () => {
    expect(
      isNarrationTextInLanguage(
        "本日のテーマは経営戦略、事業計画、市場分析、顧客価値、技術開発です。",
        "ja-JP",
      ),
    ).toBe(true);
  });

  it("将来と与えるを含む自然な日本語原稿を中国語として誤拒否しない", () => {
    const futurePlan = "将来の計画を説明します。";
    const valueStatement = "利用者に価値を与える仕組みです。";

    expect(detectNarrationLanguage(futurePlan).languageCode).toBe("ja-JP");
    expect(detectNarrationLanguage(valueStatement).languageCode).toBe("ja-JP");
    expect(isNarrationTextInLanguage(futurePlan, "ja-JP")).toBe(true);
    expect(isNarrationTextInLanguage(valueStatement, "ja-JP")).toBe(true);
  });

  it("英語優勢の混在原稿は日本語として受理しない", () => {
    expect(
      isNarrationTextInLanguage(
        "This English sentence has some words. 日本語の文章を説明します。",
        "ja-JP",
      ),
    ).toBe(false);
  });

  it("マークアップ内の異言語を含む原稿は受理しない", () => {
    expect(
      isNarrationTextInLanguage(
        "This is an English narration draft. <日本語の注記です。>",
        "en-US",
      ),
    ).toBe(false);
  });

  it("かなが多い日本語へ漢字だけの中国語を混在させても受理しない", () => {
    expect(
      isNarrationTextInLanguage(
        "これはひらがなだけでじゅうぶんににほんごです。這是中文說明。",
        "ja-JP",
      ),
    ).toBe(false);
  });

  it("第三言語を含む原稿は指定言語として受理しない", () => {
    expect(isNarrationTextInLanguage("Русский текст abc", "en-US")).toBe(false);
    expect(isNarrationTextInLanguage("这是中文说明文本", "ja-JP")).toBe(false);
  });

  it("英語だけの原稿は日本語として受理しない", () => {
    expect(isNarrationTextInLanguage("This is an English narration draft.", "ja-JP")).toBe(
      false,
    );
  });
});
