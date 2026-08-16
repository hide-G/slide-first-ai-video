import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import { getAmplifyConfig } from "./amplify-config.js";
import { configureApiClient } from "./api/client.js";
import { App } from "./App.js";
import { LanguageProvider } from "./i18n/LanguageContext.js";
import { getInitialLocale, updateDocumentLocale } from "./i18n/locale.js";
import { createTranslate } from "./i18n/messages.js";
import { loadRuntimeConfig } from "./runtime-config.js";

const initialLocale = getInitialLocale();
updateDocumentLocale(initialLocale);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Application root element not found");
}

const root = ReactDOM.createRoot(rootElement);

async function bootstrap(): Promise<void> {
  try {
    const runtimeConfig = await loadRuntimeConfig();
    configureApiClient(runtimeConfig.apiEndpoint);
    Amplify.configure(getAmplifyConfig(runtimeConfig));

    root.render(
      <React.StrictMode>
        <LanguageProvider initialLocale={initialLocale}>
          <App />
        </LanguageProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    const t = createTranslate(initialLocale);
    root.render(
      <main
        role="alert"
        style={{
          color: "#b91c1c",
          fontFamily: "sans-serif",
          margin: "2rem auto",
          maxWidth: "42rem",
          padding: "1rem",
        }}
      >
        <h1>{t("common.error")}</h1>
        <p>{error instanceof Error ? error.message : String(error)}</p>
      </main>,
    );
  }
}

void bootstrap();
