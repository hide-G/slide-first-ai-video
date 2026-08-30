import type { LexiconEntry, ScriptMode } from "@slide-first/shared-types";

/**
 * ナレーション生成・音声合成で共通利用する言語判定ユーティリティ。
 * Auto は推測できない場合に既定の言語へ戻さず、呼び出し元へ明示選択を要求する。
 */

export const NARRATION_LANGUAGE_CODES = ["ja-JP", "en-US"] as const;
export type NarrationLanguageCode = (typeof NARRATION_LANGUAGE_CODES)[number];

export const NARRATION_LANGUAGE_SETTINGS = ["auto", ...NARRATION_LANGUAGE_CODES] as const;
export type NarrationLanguageSetting = (typeof NARRATION_LANGUAGE_SETTINGS)[number];

export interface NarrationLanguageDetection {
  languageCode: NarrationLanguageCode | null;
  japaneseCharacterCount: number;
  latinCharacterCount: number;
}

/** Pollyへ渡す前の原稿と、辞書展開に必要な最小契約。 */
export interface NarrationScriptInput {
  mode: ScriptMode;
  text: string;
}

export type NarrationLexiconEntry = Pick<LexiconEntry, "written" | "reading" | "method">;

const MINIMUM_LANGUAGE_CHARACTERS = 3;
const REQUIRED_DOMINANCE_RATIO = 0.75;
const MARKUP_TAG_PATTERN = /<[^>]*>/g;
const MARKUP_TAG_DETECTION_PATTERN = /<[^>]*>/u;
const SSML_TAG_PATTERN = /<[^>]*>/gu;
const SSML_SUB_ELEMENT_PATTERN = /<sub\b([^>]*)>[\s\S]*?<\/sub\s*>/giu;
const SSML_ALIAS_ATTRIBUTE_PATTERN = /\balias\s*=\s*(?:"([^"]*)"|'([^']*)')/iu;
const SSML_UNSUPPORTED_DECLARATION_PATTERN = /<!\s*(?:\[CDATA\[|DOCTYPE\b|ENTITY\b)/iu;
const XML_ENTITY_PATTERN = /&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|lt|gt|quot|apos));/giu;
const XML_ENTITY_LIKE_PATTERN = /&(?:#(?:x)?[0-9a-z]+|[a-z]+);/iu;
const XML_NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};
const JAPANESE_CHARACTER_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu;
const LATIN_CHARACTER_PATTERN = /\p{Script=Latin}/gu;
const JAPANESE_SYLLABARY_CHARACTER_PATTERN =
  /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u;
const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;
const SENTENCE_BOUNDARY_PATTERN = /[。！？!?…\r\n]+/u;

// 日本語の新字体では通常使わない中国語の簡体字と、中国語固有の語順を検出する。
// 将来・与えるなど日本語でも一般的な字は単独では中国語の根拠にしない。
const CHINESE_SIMPLIFIED_CHARACTER_PATTERN = /[这说们个吗么对为时发经过从报绍术语]/u;
const CHINESE_EXPRESSION_PATTERN =
  /(?:这是|這是|中文|汉语|漢語|说明|說明|我们|我們|你们|你們|他们|他們|她们|她們|一个|一個|没有|沒有|可以|需要|用于|用於|通过|通過|以及|因为|因為|如果|或者|但是|正在|已经|已經|什么|什麼|为什么|為什麼|我[爱愛]|你[好們们]?|本次(?:报告|報告)|人工智能)/u;
const JAPANESE_PREDICATE_FOLLOWED_BY_HAN_PATTERN =
  /(?:です|ます|でした|ました|でしょう|だ)(?:\p{Script=Han}{4,})/u;

export function isNarrationLanguageCode(value: unknown): value is NarrationLanguageCode {
  return typeof value === "string" && (NARRATION_LANGUAGE_CODES as readonly string[]).includes(value);
}

export function isNarrationLanguageSetting(value: unknown): value is NarrationLanguageSetting {
  return typeof value === "string" && (NARRATION_LANGUAGE_SETTINGS as readonly string[]).includes(value);
}

function countCharacters(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function containsJapaneseSyllabary(text: string): boolean {
  return JAPANESE_SYLLABARY_CHARACTER_PATTERN.test(text);
}

function containsLikelyChineseText(text: string): boolean {
  return (
    CHINESE_SIMPLIFIED_CHARACTER_PATTERN.test(text) ||
    CHINESE_EXPRESSION_PATTERN.test(text) ||
    JAPANESE_PREDICATE_FOLLOWED_BY_HAN_PATTERN.test(text)
  );
}

/**
 * かなを含まない漢字主体の文は日本語と中国語を区別できない。
 * Auto判定やBedrock出力検証では、安全側で未確定または不一致として扱う。
 */
function containsAmbiguousHanOnlySentence(text: string): boolean {
  return text.split(SENTENCE_BOUNDARY_PATTERN).some((sentence) => {
    const letterCharacters = Array.from(sentence).filter((character) => /\p{L}/u.test(character));
    return (
      letterCharacters.some((character) => HAN_CHARACTER_PATTERN.test(character)) &&
      !letterCharacters.some((character) => containsJapaneseSyllabary(character))
    );
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** SSMLのCDATA・DOCTYPE・ENTITY宣言は可聴本文の検証を回避できるため受け付けない。 */
export function hasUnsupportedNarrationSsmlDeclaration(script: NarrationScriptInput): boolean {
  return script.mode === "ssml" && SSML_UNSUPPORTED_DECLARATION_PATTERN.test(script.text);
}

/**
 * Polly workerと同じ規則で辞書をSSMLへ展開する。
 * plain原稿は先にXMLエスケープし、ssml原稿はそのまま辞書の検索対象にする。
 */
export function prepareNarrationSsmlContent(
  script: NarrationScriptInput,
  lexicon: readonly NarrationLexiconEntry[] = [],
): string {
  const textIsEscaped = script.mode === "plain";
  let result = textIsEscaped ? escapeXml(script.text) : script.text;

  for (const entry of lexicon) {
    const searchForm = textIsEscaped ? escapeXml(entry.written) : entry.written;

    if (entry.method === "sub") {
      result = result.replaceAll(
        searchForm,
        `<sub alias="${escapeXml(entry.reading)}">${escapeXml(entry.written)}</sub>`,
      );
    } else if (entry.method === "phoneme") {
      result = result.replaceAll(
        searchForm,
        `<phoneme alphabet="x-amazon-pron" ph="${escapeXml(entry.reading)}">${escapeXml(entry.written)}</phoneme>`,
      );
    } else if (entry.method === "spell") {
      result = result.replaceAll(
        searchForm,
        `<say-as interpret-as="spell-out">${escapeXml(entry.written)}</say-as>`,
      );
    }
  }

  return result;
}

function decodeXmlEntities(value: string, rejectUnknownEntityLikeText: boolean): string | null {
  let hasInvalidCodePoint = false;
  const hasUnknownEntity =
    rejectUnknownEntityLikeText && value.replace(XML_ENTITY_PATTERN, "").includes("&");
  const decoded = value.replace(
    XML_ENTITY_PATTERN,
    (_entity, hexadecimal: string | undefined, decimal: string | undefined, named: string | undefined) => {
      if (named) return XML_NAMED_ENTITIES[named.toLowerCase()] ?? "";

      const numericValue = Number.parseInt(
        hexadecimal ?? decimal ?? "",
        hexadecimal ? 16 : 10,
      );
      if (
        !Number.isInteger(numericValue) ||
        numericValue <= 0 ||
        numericValue > 0x10ffff ||
        (numericValue >= 0xd800 && numericValue <= 0xdfff)
      ) {
        hasInvalidCodePoint = true;
        return "";
      }
      return String.fromCodePoint(numericValue);
    },
  );

  return hasInvalidCodePoint ||
    hasUnknownEntity ||
    (rejectUnknownEntityLikeText && XML_ENTITY_LIKE_PATTERN.test(decoded))
    ? null
    : decoded;
}

/** 辞書展開済みSSMLから、Pollyが実際に読む本文を抽出する。 */
function extractAudibleTextFromSsmlContent(
  ssmlContent: string,
  rejectUnknownEntityLikeText: boolean,
): string | null {
  let hasInvalidSubElement = false;
  const textWithAliases = ssmlContent.replace(
    SSML_SUB_ELEMENT_PATTERN,
    (_element: string, attributes: string): string => {
      const aliasMatch = SSML_ALIAS_ATTRIBUTE_PATTERN.exec(attributes);
      const alias = aliasMatch?.[1] ?? aliasMatch?.[2];
      const decodedAlias = alias
        ? decodeXmlEntities(alias, rejectUnknownEntityLikeText)
        : null;
      if (!decodedAlias) {
        hasInvalidSubElement = true;
        return " ";
      }
      return ` ${decodedAlias} `;
    },
  );

  if (hasInvalidSubElement || /<\/?sub\b/iu.test(textWithAliases)) return null;

  return decodeXmlEntities(
    textWithAliases.replace(SSML_TAG_PATTERN, " "),
    rejectUnknownEntityLikeText,
  )?.replace(/\s+/gu, " ").trim() ?? null;
}

/**
 * 原稿と辞書から、実際にPollyが読む言語判定用テキストを返す。
 * subは表示本文でなくaliasを採用し、CDATA・DOCTYPE・ENTITYはnullで拒否する。
 */
export function extractAudibleNarrationText(
  script: NarrationScriptInput,
  lexicon: readonly NarrationLexiconEntry[] = [],
): string | null {
  if (hasUnsupportedNarrationSsmlDeclaration(script)) return null;

  return extractAudibleTextFromSsmlContent(
    prepareNarrationSsmlContent(script, lexicon),
    script.mode === "ssml",
  );
}

/**
 * 日本語文字とラテン文字の比率で本文の主言語を推定する。
 * 日本語・英語が拮抗するページ、記号だけのページ、短すぎるページは不確定として返す。
 */
export function detectNarrationLanguage(text: string): NarrationLanguageDetection {
  const readableText = text.replace(MARKUP_TAG_PATTERN, " ");
  const japaneseCharacterCount = countCharacters(readableText, JAPANESE_CHARACTER_PATTERN);
  const latinCharacterCount = countCharacters(readableText, LATIN_CHARACTER_PATTERN);
  const languageCharacterCount = japaneseCharacterCount + latinCharacterCount;

  // 漢字だけでは日本語と中国語を区別できないため、Autoで日本語へ決め打ちしない。
  if (
    containsLikelyChineseText(readableText) ||
    (HAN_CHARACTER_PATTERN.test(readableText) && !containsJapaneseSyllabary(readableText))
  ) {
    return { languageCode: null, japaneseCharacterCount, latinCharacterCount };
  }

  if (languageCharacterCount < MINIMUM_LANGUAGE_CHARACTERS) {
    return { languageCode: null, japaneseCharacterCount, latinCharacterCount };
  }

  const japaneseRatio = japaneseCharacterCount / languageCharacterCount;
  const languageCode =
    japaneseRatio >= REQUIRED_DOMINANCE_RATIO
      ? "ja-JP"
      : 1 - japaneseRatio >= REQUIRED_DOMINANCE_RATIO
        ? "en-US"
        : null;

  return { languageCode, japaneseCharacterCount, latinCharacterCount };
}

/**
 * ページ上書き、プロジェクト設定、Auto判定の順でナレーション言語を決定する。
 * Autoで判定できない場合はnullを返し、既定の日本語へフォールバックしない。
 */
export function resolveNarrationLanguage(
  narrationLanguage: NarrationLanguageSetting | undefined,
  pageText: string,
  languageOverride?: NarrationLanguageCode,
): NarrationLanguageCode | null {
  if (languageOverride) return languageOverride;
  if (narrationLanguage === "ja-JP" || narrationLanguage === "en-US") {
    return narrationLanguage;
  }

  return detectNarrationLanguage(pageText).languageCode;
}

/**
 * Bedrockが指定言語の原稿を返したかを検証する。
 * Auto候補の75%比率は混在ページを不確定にするための規則であり、生成結果の契約検証には使わない。
 */
export interface NarrationTextLanguageValidationOptions {
  /** SSMLを除去済みの可聴テキストに含まれる、plain由来のリテラル角括弧を許可する。 */
  allowLiteralMarkup?: boolean;
}

export function isNarrationTextInLanguage(
  text: string,
  expectedLanguageCode: NarrationLanguageCode,
  options: NarrationTextLanguageValidationOptions = {},
): boolean {
  // Bedrockの生原稿ではタグ内へ異言語を隠して検証を回避できるため拒否する。
  // SSMLを除去済みの可聴テキストだけは、plain原稿をXMLエスケープして得たリテラル角括弧を許可する。
  if (!options.allowLiteralMarkup && MARKUP_TAG_DETECTION_PATTERN.test(text)) {
    return false;
  }

  // かなを含まない漢字主体の文や中国語の表現を、指定日本語の原稿として扱わない。
  if (containsLikelyChineseText(text) || containsAmbiguousHanOnlySentence(text)) {
    return false;
  }

  const letterCharacters = Array.from(text).filter((character) => /\p{L}/u.test(character));
  let japaneseCharacterCount = 0;
  let japaneseSyllabaryCharacterCount = 0;
  let latinCharacterCount = 0;
  let otherLetterCharacterCount = 0;

  for (const character of letterCharacters) {
    if (
      /[\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u.test(
        character,
      )
    ) {
      japaneseCharacterCount += 1;
      if (containsJapaneseSyllabary(character)) {
        japaneseSyllabaryCharacterCount += 1;
      }
      continue;
    }
    if (/\p{Script=Latin}/u.test(character)) {
      latinCharacterCount += 1;
      continue;
    }
    otherLetterCharacterCount += 1;
  }

  if (expectedLanguageCode === "en-US") {
    // 英語原稿には日本語・第三言語を混在させず、最低限の英字量を要求する。
    return (
      latinCharacterCount >= MINIMUM_LANGUAGE_CHARACTERS &&
      japaneseCharacterCount === 0 &&
      otherLetterCharacterCount === 0
    );
  }

  // 日本語原稿ではAWS製品名などの英字識別子を許容するが、かなを含む日本語本文を過半として要求する。
  return (
    japaneseCharacterCount >= MINIMUM_LANGUAGE_CHARACTERS &&
    japaneseSyllabaryCharacterCount > 0 &&
    japaneseCharacterCount / letterCharacters.length > 0.5 &&
    otherLetterCharacterCount === 0
  );
}
