import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("aws-amplify/utils", () => ({
  I18n: { putVocabularies: vi.fn(), setLanguage: vi.fn() },
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: { ja: {}, en: {} },
}));

vi.mock("aws-amplify/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn().mockRejectedValue(new Error("Not authenticated")),
  fetchAuthSession: vi.fn().mockResolvedValue({ tokens: {} }),
}));

import { LanguageProvider } from "../i18n/LanguageContext.js";
import { LoginPage } from "./LoginPage.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("LoginPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
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

  async function renderLogin(): Promise<void> {
    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </LanguageProvider>,
      );
    });
  }

  it("renders login form with email and password fields", async () => {
    await renderLogin();

    expect(container.querySelector('input[type="email"]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(container.textContent).toContain("ログイン");
  });

  it("has show password toggle", async () => {
    await renderLogin();

    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(container.textContent).toContain("パスワードを表示する");
  });

  it("switches to English when language button clicked", async () => {
    await renderLogin();

    const englishButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "English",
    );
    expect(englishButton).not.toBeNull();

    await act(async () => {
      englishButton!.click();
    });

    expect(container.textContent).toContain("Sign in");
    expect(container.textContent).toContain("Show password");
  });

  it("has SSO button", async () => {
    await renderLogin();

    expect(container.textContent).toContain("シングルサインオンでログイン");
  });

  it("has forgot password and signup links", async () => {
    await renderLogin();

    expect(container.textContent).toContain("パスワードを忘れた場合");
    expect(container.textContent).toContain("アカウントを新規作成");
  });
});
