import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("aws-amplify/utils", () => ({
  I18n: { putVocabularies: vi.fn(), setLanguage: vi.fn() },
}));

vi.mock("@aws-amplify/ui-react", () => ({
  translations: { ja: {}, en: {} },
}));

vi.mock("./hooks/useAuth.js", () => ({
  useAuth: authMocks.useAuth,
}));

vi.mock("./pages/LoginPage.js", () => ({
  LoginPage: () => <div data-testid="login">Login Page</div>,
}));

vi.mock("./pages/HomePage.js", () => ({
  HomePage: () => <div data-testid="home">Home Page</div>,
}));

vi.mock("./pages/SlideStudioPage.js", () => ({
  SlideStudioPage: () => <div data-testid="slide-studio">Slide Studio</div>,
}));

vi.mock("./pages/VideoStudioPage.js", () => ({
  VideoStudioPage: () => <div data-testid="video-studio">Video Studio</div>,
}));

import { App } from "./App.js";
import { LanguageProvider } from "./i18n/LanguageContext.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("App routing", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authMocks.useAuth.mockReset();
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

  async function renderApp(): Promise<void> {
    await act(async () => {
      root.render(
        <LanguageProvider initialLocale="ja">
          <App />
        </LanguageProvider>,
      );
    });
  }

  it("shows loading state during auth check", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      signOut: vi.fn(),
      username: null,
    });

    window.history.replaceState({}, "", "/home");
    await renderApp();

    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it("redirects unauthenticated user to /login", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signOut: vi.fn(),
      username: null,
    });

    window.history.replaceState({}, "", "/home");
    await renderApp();

    expect(window.location.pathname).toBe("/login");
    expect(container.querySelector('[data-testid="login"]')).not.toBeNull();
  });

  it("shows Home page for authenticated user at /home", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signOut: vi.fn(),
      username: "test-user",
    });

    window.history.replaceState({}, "", "/home");
    await renderApp();

    expect(container.querySelector('[data-testid="home"]')).not.toBeNull();
  });

  it("shows Slide Studio for authenticated user at /slide-studio", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signOut: vi.fn(),
      username: "test-user",
    });

    window.history.replaceState({}, "", "/slide-studio");
    await renderApp();

    expect(container.querySelector('[data-testid="slide-studio"]')).not.toBeNull();
  });

  it("shows Video Studio for authenticated user at /video-studio", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signOut: vi.fn(),
      username: "test-user",
    });

    window.history.replaceState({}, "", "/video-studio");
    await renderApp();

    expect(container.querySelector('[data-testid="video-studio"]')).not.toBeNull();
  });

  it("redirects / to /home for authenticated user", async () => {
    authMocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signOut: vi.fn(),
      username: "test-user",
    });

    window.history.replaceState({}, "", "/");
    await renderApp();

    expect(window.location.pathname).toBe("/home");
  });
});
