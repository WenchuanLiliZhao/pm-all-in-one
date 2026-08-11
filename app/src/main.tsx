import "@fontsource-variable/material-symbols-outlined/full.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./App";
import "@/global-styles/0-index.scss";

/* Theme: leave `data-theme` unset for OS auto (see color-use.scss).
 * Set `data-theme="light"|"dark"` at runtime to lock a mode. */

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
