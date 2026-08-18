import { useEffect, useMemo, useRef, useState } from "react";
import { load as loadYaml } from "js-yaml";
import { buildFigureElement, knownPlotType, mountPlotFigure } from "./mount";
import { normalizePlotSpec } from "./normalize";
import type { CalcKitSpec } from "./vendor/calc-kit.js";
import styles from "./preview.module.scss";

type Parsed =
  | { ok: true; spec: CalcKitSpec }
  | { ok: false; error: string };

function parsePlotSource(source: string): Parsed {
  try {
    const loaded = loadYaml(source);
    if (loaded == null || typeof loaded !== "object" || Array.isArray(loaded)) {
      return { ok: false, error: "Plot fence body must be a YAML mapping." };
    }
    const spec = normalizePlotSpec(loaded as Record<string, unknown>);
    if (!knownPlotType(spec.type)) {
      return {
        ok: false,
        error: spec.type
          ? `Unknown figure type "${spec.type}".`
          : "Plot fence is missing type.",
      };
    }
    return { ok: true, spec };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function PlotFencePreview({
  source,
}: {
  lang: string;
  source: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parsePlotSource(source), [source]);
  const [mountError, setMountError] = useState<{
    source: string;
    message: string;
  } | null>(null);
  const error =
    !parsed.ok
      ? parsed.error
      : mountError?.source === source
        ? mountError.message
        : null;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !parsed.ok) {
      return;
    }
    const figure = buildFigureElement(parsed.spec);
    host.replaceChildren(figure);
    let destroy: (() => void) | undefined;
    try {
      destroy = mountPlotFigure(figure, parsed.spec);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMountError({ source, message });
      host.replaceChildren();
      return;
    }
    setMountError(null);
    return () => {
      destroy?.();
      host.replaceChildren();
    };
  }, [parsed, source]);

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }
  return <div ref={hostRef} className={styles.host} />;
}
