import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("aws-amplify/utils", () => ({
  I18n: { putVocabularies: vi.fn(), setLanguage: vi.fn() },
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: { ja: {}, en: {} },
}));

import { LanguageProvider } from "../i18n/LanguageContext.js";
import { SsmlToolbar, getUnsupportedTags } from "./SsmlToolbar.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("SsmlToolbar", () => {
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

  it("disables emphasis button when engine is neural", async () => {
    const onInsert = vi.fn();

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <SsmlToolbar
            engine="neural"
            ssmlMode={true}
            onInsert={onInsert}
            onCheatsheetToggle={vi.fn()}
            cheatsheetOpen={false}
          />
        </LanguageProvider>,
      );
    });

    const buttons = container.querySelectorAll("button");
    const emphasisButton = Array.from(buttons).find(
      (btn) => btn.getAttribute("data-ssml-tag") === "emphasis",
    );

    expect(emphasisButton).not.toBeNull();
    expect(emphasisButton!.disabled).toBe(true);
  });

  it("enables all buttons when engine is standard", async () => {
    const onInsert = vi.fn();

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <SsmlToolbar
            engine="standard"
            ssmlMode={true}
            onInsert={onInsert}
            onCheatsheetToggle={vi.fn()}
            cheatsheetOpen={false}
          />
        </LanguageProvider>,
      );
    });

    const buttons = container.querySelectorAll("button[data-ssml-tag]");
    const disabledButtons = Array.from(buttons).filter((btn) => btn.hasAttribute("disabled"));

    expect(disabledButtons.length).toBe(0);
  });

  it("hides toolbar when ssmlMode is false", async () => {
    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <SsmlToolbar
            engine="neural"
            ssmlMode={false}
            onInsert={vi.fn()}
            onCheatsheetToggle={vi.fn()}
            cheatsheetOpen={false}
          />
        </LanguageProvider>,
      );
    });

    const toolbar = container.querySelector('[role="group"]') as HTMLElement;
    expect(toolbar?.style.display).toBe("none");
  });

  it("calls onInsert when a button is clicked", async () => {
    const onInsert = vi.fn();

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <SsmlToolbar
            engine="standard"
            ssmlMode={true}
            onInsert={onInsert}
            onCheatsheetToggle={vi.fn()}
            cheatsheetOpen={false}
          />
        </LanguageProvider>,
      );
    });

    const breakButton = Array.from(container.querySelectorAll("button[data-ssml-tag]")).find(
      (btn) => btn.getAttribute("data-ssml-tag") === "break",
    ) as HTMLButtonElement;

    await act(async () => {
      breakButton.click();
    });

    expect(onInsert).toHaveBeenCalledWith('<break time="400ms"/>');
  });
});

describe("getUnsupportedTags", () => {
  it("returns emphasis as unsupported for neural engine", () => {
    const unsupported = getUnsupportedTags("neural");
    expect(unsupported.has("emphasis")).toBe(true);
  });

  it("returns empty set for standard engine", () => {
    const unsupported = getUnsupportedTags("standard");
    expect(unsupported.size).toBe(0);
  });
});
