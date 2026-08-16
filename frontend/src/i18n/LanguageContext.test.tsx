import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("aws-amplify/utils", () => ({
  I18n: { putVocabularies: vi.fn(), setLanguage: vi.fn() },
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: { ja: {}, en: {} },
}));

import { LanguageProvider, useLanguage } from "./LanguageContext.js";
import { LOCALE_STORAGE_KEY } from "./locale.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function LanguageProbe() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div>
      <output data-testid="locale">{locale}</output>
      <p data-testid="heading">{t("home.heading")}</p>
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
      throw new Error(`Button "${label}" not found`);
    }

    return button;
  }

  it("defaults to Japanese when no stored value exists", async () => {
    await renderProvider();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("ja");
    expect(container.querySelector('[data-testid="heading"]')?.textContent).toBe("何をつくりますか");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
  });

  it("falls back to Japanese for invalid stored value", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "fr");

    await renderProvider();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("ja");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
  });

  it("switches to English and persists it", async () => {
    await renderProvider();

    await act(async () => {
      getButton("English").click();
    });

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("en");
    expect(container.querySelector('[data-testid="heading"]')?.textContent).toBe("What would you like to make");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("restores English after remount", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");

    await renderProvider();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe("en");
    expect(container.querySelector('[data-testid="heading"]')?.textContent).toBe("What would you like to make");
  });
});
