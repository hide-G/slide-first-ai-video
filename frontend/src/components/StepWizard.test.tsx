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
import { StepWizard } from "./StepWizard.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("StepWizard", () => {
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

  it("renders steps with correct labels", async () => {
    const steps = [
      { labelKey: "slide.stepA" as const },
      { labelKey: "slide.stepB" as const },
      { labelKey: "slide.stepC" as const },
    ];

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <StepWizard steps={steps} currentStep={0} onStepClick={vi.fn()} />
        </LanguageProvider>,
      );
    });

    expect(container.textContent).toContain("入力と条件");
    expect(container.textContent).toContain("骨子のレビューと編集");
    expect(container.textContent).toContain("スライド生成と書き出し");
  });

  it("marks current step with aria-current", async () => {
    const steps = [
      { labelKey: "video.stepA" as const },
      { labelKey: "video.stepB" as const },
    ];

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <StepWizard steps={steps} currentStep={1} onStepClick={vi.fn()} />
        </LanguageProvider>,
      );
    });

    const items = container.querySelectorAll("li");
    expect(items[0].getAttribute("aria-current")).toBeNull();
    expect(items[1].getAttribute("aria-current")).toBe("step");
  });

  it("calls onStepClick when step button is clicked", async () => {
    const onStepClick = vi.fn();
    const steps = [
      { labelKey: "slide.stepA" as const },
      { labelKey: "slide.stepB" as const },
    ];

    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <StepWizard steps={steps} currentStep={0} onStepClick={onStepClick} />
        </LanguageProvider>,
      );
    });

    const buttons = container.querySelectorAll("button");

    await act(async () => {
      buttons[1].click();
    });

    expect(onStepClick).toHaveBeenCalledWith(1);
  });
});
