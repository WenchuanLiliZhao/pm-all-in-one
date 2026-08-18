import { useState } from "react";
import {
  Button,
  ButtonGroup,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button";
import { PageWidth } from "@/components/ui/page-width";
import { Lucide } from "@/components/ui/lucide";
import styles from "./page.module.scss";

const VARIANTS: ButtonVariant[] = [
  "ghost",
  "outlined",
  "fill",
  "fill-inverse",
  "fill-danger",
];
const SIZES: ButtonSize[] = ["small", "medium", "large"];

const DANGER_COLORS = {
  fg: "var(--color-use--danger)",
  border: "var(--color-use--danger-border)",
  hoverBg: "var(--color-use--danger-soft)",
} as const;

const MODES = ["Source", "Live", "Preview"] as const;

function GroupDemo() {
  const [mode, setMode] = useState<(typeof MODES)[number]>("Preview");
  return (
    <ButtonGroup role="radiogroup" aria-label="Editor mode">
      {MODES.map((item) => (
        <Button
          key={item}
          type="button"
          variant="outlined"
          size="small"
          selected={mode === item}
          role="radio"
          aria-checked={mode === item}
          onClick={() => setMode(item)}
        >
          {item}
        </Button>
      ))}
    </ButtonGroup>
  );
}

function FlushGroupDemo() {
  const [mode, setMode] = useState<(typeof MODES)[number]>("Preview");
  return (
    <ButtonGroup
      appearance="flush"
      role="radiogroup"
      aria-label="Flush editor mode"
    >
      {MODES.map((item) => {
        const active = mode === item;
        return (
          <Button
            key={item}
            type="button"
            variant={active ? "fill-inverse" : "ghost"}
            size="small"
            selected={active}
            role="radio"
            aria-checked={active}
            onClick={() => setMode(item)}
          >
            {item}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

export function ButtonPage() {
  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Button</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/button</code>. Product and lab
        share this module. Default variant is <code>outlined</code>.{" "}
        <code>selected</code> raises label color to text-prime (orthogonal to
        variant; skipped on <code>fill-inverse</code> / <code>fill-danger</code>).{" "}
        <code>ButtonGroup</code> joins outlined buttons (UI-304 shared stroke);
        <code>appearance="flush"</code> embeds in existing chrome with no extra
        stroke.
        Tree outline rows and expanders are out of scope — use{" "}
        <code>TreeRow</code> with Lucide lead icons (see Lab → Tree row).
      </p>

      {VARIANTS.map((variant) => (
        <div key={variant} className={styles.block}>
          <p className={styles.blockLabel}>{variant}</p>
          <div className={styles.row}>
            {SIZES.map((size) => (
              <Button key={`${variant}-${size}`} variant={variant} size={size}>
                {size}
              </Button>
            ))}
            <Button variant={variant} disabled>
              disabled
            </Button>
            <Button variant={variant} startIcon={<Lucide.Plus />}>
              start
            </Button>
            <Button variant={variant} endIcon={<Lucide.ChevronRight />}>
              end
            </Button>
            <Button
              variant={variant}
              startIcon={<Lucide.Home />}
              endIcon={<Lucide.ChevronRight />}
            >
              both
            </Button>
            <Button variant={variant} loading>
              loading
            </Button>
          </div>
        </div>
      ))}

      <div className={styles.block}>
        <p className={styles.blockLabel}>selected (prime label)</p>
        <div className={styles.row}>
          {VARIANTS.map((variant) => (
            <Button key={`selected-${variant}`} variant={variant} selected>
              {variant}
            </Button>
          ))}
          <Button variant="fill" selected startIcon={<Lucide.Home />}>
            fill + icon
          </Button>
          <Button variant="ghost" selected disabled>
            ghost disabled
          </Button>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>danger (outlined + colors)</p>
        <div className={styles.row}>
          <Button variant="outlined" colors={DANGER_COLORS}>
            Delete
          </Button>
          <Button variant="outlined" colors={DANGER_COLORS} disabled>
            Delete
          </Button>
          <Button
            variant="outlined"
            colors={DANGER_COLORS}
            startIcon={<Lucide.Plus />}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>group (outlined, shared stroke)</p>
        <div className={styles.row}>
          <GroupDemo />
          <ButtonGroup aria-label="Sizes">
            <Button variant="outlined" size="small">
              small
            </Button>
            <Button variant="outlined" size="small">
              pair
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>
          group flush (ghost + fill-inverse, no own stroke)
        </p>
        <div className={styles.row}>
          <FlushGroupDemo />
        </div>
      </div>
    </PageWidth>
  );
}
