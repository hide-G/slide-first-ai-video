import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const i18nMocks = vi.hoisted(() => ({
  setLanguage: vi.fn(),
}));

vi.mock("aws-amplify/utils", () => ({
  I18n: i18nMocks,
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: { ja: {}, en: {} },
}));

import { Layout } from "./Layout.js";
import { LanguageProvider } from "../i18n/LanguageContext.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function LocationDisplay() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

describe("Layoutのログアウト", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    i18nMocks.setLanguage.mockReset();
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

  async function renderLayout(onSignOut: () => Promise<void>): Promise<void> {
    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <MemoryRouter initialEntries={["/projects"]}>
            <Layout onSignOut={onSignOut} />
            <LocationDisplay />
          </MemoryRouter>
        </LanguageProvider>,
      );
    });
  }

  function getLogoutButton(): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("ログアウト"),
    );

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("ログアウトボタンが見つかりません。");
    }

    return button;
  }

  it("ログアウト成功後に/loginへreplace遷移する", async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    await renderLayout(onSignOut);

    await act(async () => {
      getLogoutButton().click();
      await Promise.resolve();
    });

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/login",
    );
  });

  it("ログアウト中は二重操作を防止する", async () => {
    let resolveSignOut: (() => void) | undefined;
    const onSignOut = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    await renderLayout(onSignOut);

    act(() => {
      getLogoutButton().click();
      getLogoutButton().click();
    });

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(getLogoutButton().disabled).toBe(true);
    expect(getLogoutButton().textContent).toBe("ログアウト中...");

    await act(async () => {
      resolveSignOut?.();
      await Promise.resolve();
    });
  });

  it("ログアウト失敗時は日本語のエラーを表示し、保護画面に留まる", async () => {
    const onSignOut = vi.fn().mockRejectedValue(new Error("network error"));
    await renderLayout(onSignOut);

    await act(async () => {
      getLogoutButton().click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "ログアウトに失敗しました。時間をおいて再度お試しください。",
    );
    expect(getLogoutButton().disabled).toBe(false);
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(
      "/projects",
    );
  });
});
