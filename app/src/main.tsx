import "@fontsource-variable/material-symbols-outlined/full.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./App";
import "@/global-styles/0-index.scss";

/* Theme: leave `data-theme` unset for OS auto (see color-use.scss).
 * Set `data-theme="light"|"dark"` at runtime to lock a mode.
 * vscode / Cursor webview: `data-pm-host="vscode"` remaps `--color-use--*`
 * via color-use-vscode.scss; vscode-pm.js locks `data-theme` from the IDE
 * kind. Electron still uses this auto / data-theme contract only. */

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
