import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import { getAmplifyConfig } from "./amplify-config.js";
import { App } from "./App.js";

// Configure Amplify
Amplify.configure(getAmplifyConfig());

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
