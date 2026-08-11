import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router-dom";

/** Persists stack length across refresh (idx lives in history.state). */
const LENGTH_KEY = "pm.shell.routerHistoryLength";

function readHistoryIdx(): number {
  const state = window.history.state as { idx?: unknown } | null;
  return typeof state?.idx === "number" ? state.idx : 0;
}

function readStoredLength(): number {
  try {
    const n = Number(sessionStorage.getItem(LENGTH_KEY));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  } catch {
    return 1;
  }
}

function writeStoredLength(length: number): void {
  try {
    sessionStorage.setItem(LENGTH_KEY, String(length));
  } catch {
    /* private mode / quota — enable state still works for this session */
  }
}

/**
 * Session history for darwin titlebar back/forward.
 * Index comes from React Router's `history.state.idx` (survives refresh);
 * forward-stack length is mirrored in sessionStorage.
 */
export function useRouterHistoryControls() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const lengthRef = useRef(1);
  const [canBack, setCanBack] = useState(() => readHistoryIdx() > 0);
  const [canForward, setCanForward] = useState(false);

  useEffect(() => {
    const idx = readHistoryIdx();
    let length = Math.max(readStoredLength(), idx + 1);

    if (navigationType === "PUSH") {
      length = idx + 1;
    } else if (navigationType === "REPLACE") {
      length = Math.max(length, idx + 1);
    }
    // POP: keep length (forward entries still in the browser stack)

    lengthRef.current = length;
    writeStoredLength(length);
    setCanBack(idx > 0);
    setCanForward(idx < length - 1);
  }, [location.key, navigationType]);

  const goBack = useCallback(() => {
    if (readHistoryIdx() > 0) navigate(-1);
  }, [navigate]);

  const goForward = useCallback(() => {
    if (readHistoryIdx() < lengthRef.current - 1) navigate(1);
  }, [navigate]);

  return { canBack, canForward, goBack, goForward };
}
