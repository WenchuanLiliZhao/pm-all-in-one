/**
 * Member identity chip — two display appearances, plus a select wrapper.
 *
 * Appearances (MemberPerson):
 * - `link` — text-like avatar+name; underline on hover; navigates when linkable
 * - `card` — outlined Button chrome (height / padding / hover). Created-by fields use this.
 *
 * Select (MemberPersonSelect): same `card` chrome as Trigger asChild + chevron + menu.
 *
 * ↔ components/ui/button/styles.module.scss — card chrome reuses outlined medium tokens
 * ↔ components/ui/dropdown-menu — Select uses Trigger asChild + Item rows
 */
import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import buttonStyles from "@/components/ui/button/styles.module.scss";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import { getPm } from "@/lib/bridge";
import type { MemberMeta, Membership } from "@/lib/types";
import { useMember } from "@/lib/workspace/member-context";
import styles from "./styles.module.scss";

export type MemberPersonSize = "sm" | "md" | "lg";

/** How the identity chip is presented. */
export type MemberPersonAppearance = "link" | "card";

export type MemberPersonProps = {
  memberId: string | null | undefined;
  title?: string;
  membership?: Membership | "missing";
  size?: MemberPersonSize;
  showName?: boolean;
  /**
   * `link` (default): text chip; navigates when linkable.
   * `card`: Button-styled shell (same chrome as select trigger, no chevron).
   */
  appearance?: MemberPersonAppearance;
  /**
   * When true (default) and member is linkable, click navigates to `/w/members/:id`.
   * Forced off for menu rows and non-navigable contexts.
   */
  link?: boolean;
  emptyLabel?: string;
  className?: string;
};

export type MemberPersonSelectProps = {
  value: string | null;
  onChange: (memberId: string | null) => void;
  /** Involved members for the menu (caller filters). */
  options: MemberMeta[];
  /** Keep a left/missing current value visible in the menu. */
  extraOption?:
    | MemberMeta
    | { id: string; title: string; membership: "left" | "missing" }
    | null;
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  /** aria-label on the trigger */
  "aria-label"?: string;
};

const avatarCache = new Map<string, string | null>();
const avatarInflight = new Map<string, Promise<string | null>>();

function loadAvatarDataUrl(memberId: string): Promise<string | null> {
  if (avatarCache.has(memberId)) {
    return Promise.resolve(avatarCache.get(memberId)!);
  }
  const pending = avatarInflight.get(memberId);
  if (pending) {
    return pending;
  }
  const req = getPm()
    .getMemberAvatarDataUrl(memberId)
    .then((url) => {
      avatarCache.set(memberId, url);
      avatarInflight.delete(memberId);
      return url;
    })
    .catch(() => {
      avatarCache.set(memberId, null);
      avatarInflight.delete(memberId);
      return null;
    });
  avatarInflight.set(memberId, req);
  return req;
}

export function invalidateMemberAvatarCache(memberId?: string): void {
  if (memberId) {
    avatarCache.delete(memberId);
    avatarInflight.delete(memberId);
    return;
  }
  avatarCache.clear();
  avatarInflight.clear();
}

export function memberInitials(title: string): string {
  const parts = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function useMemberAvatar(memberId: string | null | undefined): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    memberId && avatarCache.has(memberId)
      ? avatarCache.get(memberId)!
      : null,
  );

  useEffect(() => {
    if (!memberId) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    void loadAvatarDataUrl(memberId).then((url) => {
      if (!cancelled) {
        setAvatarUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  return avatarUrl;
}

function useResolvedMember(
  memberId: string | null | undefined,
  titleProp?: string,
  membershipProp?: Membership | "missing",
): {
  title: string;
  membership: Membership | "missing" | undefined;
  muted: boolean;
  nameSuffix: string;
} {
  const { members } = useMember();
  const meta = memberId
    ? members?.nodes.find((m) => m.id === memberId)
    : undefined;
  const title =
    titleProp?.trim() ||
    meta?.title ||
    (memberId ? memberId.slice(0, 8) : "");
  const membership: Membership | "missing" | undefined =
    membershipProp ??
    meta?.membership ??
    (memberId && members && !meta ? "missing" : undefined);
  const muted = membership === "left" || membership === "missing";
  const nameSuffix =
    membership === "left"
      ? " (left)"
      : membership === "missing"
        ? " (missing)"
        : "";
  return { title, membership, muted, nameSuffix };
}

function MemberAvatarFace({
  memberId,
  title,
  size,
  muted,
}: {
  memberId: string | null | undefined;
  title: string;
  size: MemberPersonSize;
  muted?: boolean;
}): ReactNode {
  const avatarUrl = useMemberAvatar(memberId);
  const sizeClass =
    size === "lg" ? styles.sizeLg : size === "md" ? styles.sizeMd : styles.sizeSm;
  const faceClass = [
    avatarUrl ? styles.avatar : styles.initials,
    sizeClass,
    muted ? styles.faceMuted : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!memberId && !title) {
    return (
      <span className={`${styles.initials} ${sizeClass}`} aria-hidden>
        —
      </span>
    );
  }

  if (avatarUrl) {
    return <img className={faceClass} src={avatarUrl} alt="" />;
  }
  return (
    <span className={faceClass} aria-hidden>
      {memberInitials(title || "?")}
    </span>
  );
}

type CardChromeProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: ReactNode;
  endIcon?: ReactNode;
  /** Stretch to parent width (select trigger). */
  fullWidth?: boolean;
  muted?: boolean;
};

/**
 * Shared outlined-medium Button shell for `appearance="card"` and select trigger.
 * forwardRef required for DropdownMenu.Trigger asChild.
 */
const MemberPersonCardChrome = forwardRef<HTMLButtonElement, CardChromeProps>(
  function MemberPersonCardChrome(
    {
      children,
      endIcon,
      fullWidth = false,
      muted = false,
      disabled,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={[
          buttonStyles.button,
          styles.card,
          fullWidth ? styles.cardFullWidth : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-variant="outlined"
        data-size="medium"
        disabled={disabled}
        {...rest}
      >
        {!disabled ? (
          <span
            className={buttonStyles["button__hover-overlay"]}
            aria-hidden
          />
        ) : null}
        <span
          className={`${buttonStyles["button__text-container"]} ${styles.cardText}`}
        >
          <span
            className={`${buttonStyles["button__label"]} ${styles.cardLabel}${
              muted ? ` ${styles.muted}` : ""
            }`}
          >
            {children}
          </span>
        </span>
        {endIcon ? (
          <span className={buttonStyles["button__icon-container"]}>
            {endIcon}
          </span>
        ) : null}
        <span
          className={buttonStyles["button__outline-border"]}
          aria-hidden
        />
      </button>
    );
  },
);

function PersonLabel({
  memberId,
  title,
  nameSuffix,
  size,
  showName,
  muted,
  empty,
  emptyLabel,
}: {
  memberId: string | null | undefined;
  title: string;
  nameSuffix: string;
  size: MemberPersonSize;
  showName: boolean;
  muted: boolean;
  empty?: boolean;
  emptyLabel?: string;
}): ReactNode {
  if (empty) {
    return (
      <span className={styles.triggerEmpty}>{emptyLabel ?? "—"}</span>
    );
  }
  return (
    <>
      <MemberAvatarFace
        memberId={memberId}
        title={title}
        size={size}
        muted={muted}
      />
      {showName ? (
        <span className={styles.name}>
          {title}
          {nameSuffix}
        </span>
      ) : null}
    </>
  );
}

/** Readonly identity chip — `link` or `card` appearance. */
export function MemberPerson({
  memberId,
  title: titleProp,
  membership: membershipProp,
  size = "sm",
  showName = true,
  appearance = "link",
  link,
  emptyLabel,
  className,
}: MemberPersonProps) {
  const navigate = useNavigate();
  const { title, membership, muted, nameSuffix } = useResolvedMember(
    memberId,
    titleProp,
    membershipProp,
  );
  const canNavigate =
    link !== false && Boolean(memberId) && membership !== "missing";
  const tooltip = memberId ? title + nameSuffix : emptyLabel ?? "—";

  if (!memberId) {
    if (!emptyLabel && appearance === "link") {
      return null;
    }
    if (appearance === "card") {
      return (
        <MemberPersonCardChrome
          className={className}
          muted
          disabled
          aria-label={emptyLabel ?? "—"}
          title={tooltip}
        >
          <PersonLabel
            memberId={null}
            title=""
            nameSuffix=""
            size={size}
            showName={false}
            muted
            empty
            emptyLabel={emptyLabel ?? "—"}
          />
        </MemberPersonCardChrome>
      );
    }
    // Avatar-only empty: circular placeholder (topbar “me” unset).
    if (!showName) {
      const sizeClass =
        size === "lg"
          ? styles.sizeLg
          : size === "md"
            ? styles.sizeMd
            : styles.sizeSm;
      return (
        <span
          className={`${styles.root} ${sizeClass} ${styles.muted} ${className ?? ""}`.trim()}
          title={tooltip}
          aria-label={emptyLabel ?? "—"}
        >
          <MemberAvatarFace memberId={null} title="" size={size} muted />
        </span>
      );
    }
    return (
      <span className={`${styles.root} ${styles.empty} ${className ?? ""}`}>
        {emptyLabel}
      </span>
    );
  }

  const label = (
    <PersonLabel
      memberId={memberId}
      title={title}
      nameSuffix={nameSuffix}
      size={size}
      showName={showName}
      muted={muted}
    />
  );

  if (appearance === "card") {
    return (
      <MemberPersonCardChrome
        className={className}
        muted={muted}
        title={tooltip}
        aria-label={tooltip}
        onClick={
          canNavigate
            ? (e) => {
                e.stopPropagation();
                navigate(`/w/members/${memberId}`);
              }
            : undefined
        }
      >
        {label}
      </MemberPersonCardChrome>
    );
  }

  const sizeClass =
    size === "lg" ? styles.sizeLg : size === "md" ? styles.sizeMd : styles.sizeSm;
  const mutedClass = muted ? styles.muted : "";
  const rootClass =
    `${styles.root} ${sizeClass} ${mutedClass} ${className ?? ""}`.trim();

  if (canNavigate) {
    return (
      <button
        type="button"
        className={`${rootClass} ${styles.clickable}`}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/w/members/${memberId}`);
        }}
        title={tooltip}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={rootClass} title={tooltip}>
      {label}
    </span>
  );
}

/**
 * Dropdown member picker. Trigger = card chrome + chevron (DropdownMenu asChild).
 */
export function MemberPersonSelect({
  value,
  onChange,
  options,
  extraOption = null,
  allowClear = true,
  clearLabel = "—",
  disabled = false,
  className,
  "aria-label": ariaLabel = "Select member",
}: MemberPersonSelectProps) {
  const { members } = useMember();
  const [open, setOpen] = useState(false);

  const selectedMeta = value
    ? members?.nodes.find((m) => m.id === value) ??
      (extraOption && extraOption.id === value ? extraOption : null)
    : null;
  const selectedTitle = selectedMeta
    ? "title" in selectedMeta
      ? selectedMeta.title
      : value!.slice(0, 8)
    : "";
  const selectedMembership: Membership | "missing" | undefined =
    selectedMeta && "membership" in selectedMeta
      ? selectedMeta.membership
      : value
        ? "missing"
        : undefined;

  const muted =
    selectedMembership === "left" || selectedMembership === "missing";
  const nameSuffix =
    selectedMembership === "left"
      ? " (left)"
      : selectedMembership === "missing"
        ? " (missing)"
        : "";

  const menuExtra =
    extraOption &&
    !options.some((o) => o.id === extraOption.id) &&
    value === extraOption.id
      ? extraOption
      : null;

  return (
    <div className={`${styles.selectWrap} ${className ?? ""}`.trim()}>
      <DropdownMenu open={open} onOpenChange={setOpen} disabled={disabled}>
        <DropdownMenu.Trigger asChild>
          <MemberPersonCardChrome
            fullWidth
            disabled={disabled}
            muted={muted}
            aria-label={ariaLabel}
            endIcon={
              <Lucide.ChevronDown
                className={open ? styles.chevronOpen : undefined}
                aria-hidden
              />
            }
          >
            {value ? (
              <PersonLabel
                memberId={value}
                title={selectedTitle}
                nameSuffix={nameSuffix}
                size="sm"
                showName
                muted={muted}
              />
            ) : (
              <PersonLabel
                memberId={null}
                title=""
                nameSuffix=""
                size="sm"
                showName={false}
                muted
                empty
                emptyLabel={clearLabel}
              />
            )}
          </MemberPersonCardChrome>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="start"
          side="bottom"
          className={styles.selectMenu}
        >
          {allowClear ? (
            <DropdownMenu.Item
              onSelect={() => onChange(null)}
              className={
                value === null ? styles.selectMenuItemActive : undefined
              }
            >
              <span className={styles.triggerEmpty}>{clearLabel}</span>
            </DropdownMenu.Item>
          ) : null}
          {options.map((m) => (
            <DropdownMenu.Item
              key={m.id}
              onSelect={() => onChange(m.id)}
              className={
                value === m.id ? styles.selectMenuItemActive : undefined
              }
            >
              <MemberPerson
                memberId={m.id}
                title={m.title}
                membership={m.membership}
                size="sm"
                showName
                appearance="link"
                link={false}
              />
            </DropdownMenu.Item>
          ))}
          {menuExtra ? (
            <DropdownMenu.Item
              onSelect={() => onChange(menuExtra.id)}
              className={styles.selectMenuItemActive}
            >
              <MemberPerson
                memberId={menuExtra.id}
                title={menuExtra.title}
                membership={
                  "membership" in menuExtra
                    ? menuExtra.membership
                    : "missing"
                }
                size="sm"
                showName
                appearance="link"
                link={false}
              />
            </DropdownMenu.Item>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
