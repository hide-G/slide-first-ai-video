import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const i18nMocks = vi.hoisted(() => ({
  putVocabularies: vi.fn(),
  setLanguage: vi.fn(),
}));

const uiMocks = vi.hoisted(() => ({
  translations: { ja: { signIn: "サインイン" }, en: { signIn: "Sign In" } },
}));

vi.mock("aws-amplify/utils", () => ({
  I18n: i18nMocks,
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: uiMocks.translations,
}));

import { initializeAuthenticatorI18n } from "./authenticator.js";
import { LanguageProvider, useLanguage } from "./LanguageContext.js";
import { LOCALE_STORAGE_KEY } from "./locale.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function LanguageProbe() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div>
      <output data-testid="locale">{locale}</output>
      <p data-testid="projects-empty">{t("projects.empty")}</p>
      <button type="button" onClick={() => setLocale("ja")}>
        日本語
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
    </div>
  );
}

describe("LanguageContext", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    i18nMocks.putVocabularies.mockReset();
    i18nMocks.setLanguage.mockReset();
    window.localStorage.clear();
    document.documentElement.lang = "en";
    document.title = "before test";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderProvider(): Promise<void> {
    await act(async () => {
      root.render(
        <LanguageProvider>
          <LanguageProbe />
        </LanguageProvider>,
      );
    });
  }

  function getButton(label: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === label,
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`${label}ボタンが見つかりません。`);
    }

    return button;
  }

  it("保存値がない場合は日本語を既定にし、HTML言語属性とタイトルを同期する", async () => {
    await renderProvider();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe(
      "ja",
    );
    expect(container.querySelector('[data-testid="projects-empty"]')?.textContent).toBe(
      "プロジェクトがありません。上のフォームから作成してください。",
    );
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    expect(document.title).toBe("スライド動画生成 | Slide-First AI Video");
    expect(i18nMocks.setLanguage).toHaveBeenCalledWith("ja");
  });

  it("不正な保存値は日本語へ安全にフォールバックする", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

    await renderProvider();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe(
      "ja",
    );
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
  });

  it("英語への切替を保存し、再マウント後も英語を復元する", async () => {
    await renderProvider();

    await act(async () => {
      getButton("English").click();
    });

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe(
      "en",
    );
    expect(container.querySelector('[data-testid="projects-empty"]')?.textContent).toBe(
      "No projects yet. Create one using the form above.",
    );
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("Slide-First AI Video");
    expect(i18nMocks.setLanguage).toHaveBeenLastCalledWith("en");

    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);

    await renderProvider();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe(
      "en",
    );
  });

  it("Amplify UIの公式辞書を登録してAuthenticatorの言語を設定する", () => {
    initializeAuthenticatorI18n("ja");

    expect(i18nMocks.putVocabularies).toHaveBeenCalledWith(uiMocks.translations);
    expect(i18nMocks.setLanguage).toHaveBeenCalledWith("ja");
  });
});
