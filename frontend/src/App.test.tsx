import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const i18nMocks = vi.hoisted(() => ({
  setLanguage: vi.fn(),
}));

vi.mock("aws-amplify/utils", () => ({
  I18n: i18nMocks,
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: { ja: {}, en: {} },
}));

vi.mock("./hooks/useAuth.js", () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock("./pages/LoginPage.js", () => ({
  LoginPage: () => <div>ログイン画面</div>,
}));

vi.mock("./pages/ProjectsPage.js", () => ({
  ProjectsPage: () => <div>保護されたプロジェクト画面</div>,
}));

vi.mock("./pages/ProjectDetailPage.js", () => ({
  ProjectDetailPage: () => <div>プロジェクト詳細画面</div>,
}));

vi.mock("./pages/VersionPage.js", () => ({
  VersionPage: () => <div>バージョン画面</div>,
}));

vi.mock("./pages/VideosPage.js", () => ({
  VideosPage: () => <div>動画画面</div>,
}));

import { App } from "./App.js";
import { LanguageProvider } from "./i18n/LanguageContext.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Appの認証ガード", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authMocks.useAuth.mockReset();
    i18nMocks.setLanguage.mockReset();
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.history.replaceState({}, "", "/projects");
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderApp(): Promise<void> {
    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <App />
        </LanguageProvider>,
      );
    });
  }

  it("認証確認中は保護画面ではなくローディングを表示する", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      signOut: vi.fn(),
    });

    await renderApp();

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "認証状態を確認しています...",
    );
    expect(container.textContent).not.toContain("保護されたプロジェクト画面");
  });

  it("未認証で/projectsを直接開くと/loginへ置換遷移する", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signOut: vi.fn(),
    });

    await renderApp();

    expect(window.location.pathname).toBe("/login");
    expect(container.textContent).toContain("ログイン画面");
    expect(container.textContent).not.toContain("保護されたプロジェクト画面");
  });

  it("認証済みの場合だけ保護画面を表示する", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signOut: vi.fn(),
    });

    await renderApp();

    expect(container.textContent).toContain("保護されたプロジェクト画面");
  });
});
