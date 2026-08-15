import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const i18nMocks = vi.hoisted(() => {
  const state = { language: "ja" };

  return {
    state,
    putVocabularies: vi.fn(),
    setLanguage: vi.fn((language: string) => {
      state.language = language;
    }),
  };
});

vi.mock("aws-amplify/utils", () => ({
  I18n: i18nMocks,
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: { ja: { signIn: "サインイン" }, en: { signIn: "Sign In" } },
  Authenticator: () => (
    <div data-testid="authenticator">
      {i18nMocks.state.language === "ja" ? "サインイン" : "Sign In"}
    </div>
  ),
}));

vi.mock("@aws-amplify/ui-react/styles.css", () => ({}));

import { initializeAuthenticatorI18n } from "../i18n/authenticator.js";
import { LanguageProvider } from "../i18n/LanguageContext.js";
import { LoginPage } from "./LoginPage.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("LoginPageの言語切替", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    i18nMocks.state.language = "ja";
    i18nMocks.putVocabularies.mockClear();
    i18nMocks.setLanguage.mockClear();
    window.localStorage.clear();
    initializeAuthenticatorI18n("ja");
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

  async function renderLoginPage(): Promise<void> {
    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <LoginPage />
        </LanguageProvider>,
      );
    });
  }

  it("言語切替に合わせてAuthenticatorの公式I18n言語も更新する", async () => {
    await renderLoginPage();

    expect(container.querySelector('[data-testid="authenticator"]')?.textContent).toBe(
      "サインイン",
    );
    expect(container.textContent).toContain("スライドから動画を自動生成");

    const englishButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "English",
    );
    if (!(englishButton instanceof HTMLButtonElement)) {
      throw new Error("Englishボタンが見つかりません。");
    }

    await act(async () => {
      englishButton.click();
    });

    expect(container.querySelector('[data-testid="authenticator"]')?.textContent).toBe(
      "Sign In",
    );
    expect(container.textContent).toContain(
      "Generate videos from slides automatically",
    );
    expect(i18nMocks.setLanguage).toHaveBeenLastCalledWith("en");
  });
});
