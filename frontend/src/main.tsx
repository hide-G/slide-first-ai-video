import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import { getAmplifyConfig } from "./amplify-config.js";
import { configureApiClient } from "./api/client.js";
import { App } from "./App.js";
import { getErrorDescriptor } from "./i18n/errors.js";
import { initializeAuthenticatorI18n } from "./i18n/authenticator.js";
import { LanguageProvider } from "./i18n/LanguageContext.js";
import { getInitialLocale, updateDocumentLocale } from "./i18n/locale.js";
import { formatMessage, message } from "./i18n/messages.js";
import { loadRuntimeConfig } from "./runtime-config.js";

const initialLocale = getInitialLocale();
updateDocumentLocale(initialLocale);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(formatMessage(initialLocale, message("errors.rootNotFound")));
}

const root = ReactDOM.createRoot(rootElement);

function getInitializationErrorMessage(error: unknown): string {
  return formatMessage(
    initialLocale,
    getErrorDescriptor(error, message("errors.runtimeConfigUnknown")),
  );
}

async function bootstrap(): Promise<void> {
  try {
    const runtimeConfig = await loadRuntimeConfig();
    configureApiClient(runtimeConfig.apiEndpoint);
    Amplify.configure(getAmplifyConfig(runtimeConfig));
    initializeAuthenticatorI18n(initialLocale);

    root.render(
      <React.StrictMode>
        <LanguageProvider initialLocale={initialLocale}>
          <App />
        </LanguageProvider>
      </React.StrictMode>,
    );
  } catch (error) {
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
        <h1>{formatMessage(initialLocale, message("errors.applicationStartFailed"))}</h1>
        <p>{getInitializationErrorMessage(error)}</p>
        <p>{formatMessage(initialLocale, message("errors.applicationRetryGuidance"))}</p>
      </main>,
    );
  }
}

void bootstrap();
