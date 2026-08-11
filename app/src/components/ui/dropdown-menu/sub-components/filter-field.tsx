/**
 * Top-of-panel filter — uses local ui/Input (ui-system uses Search.Input).
 */
import { useCallback, type FC, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import styles from "../styles.module.scss";
import { useDropdownMenuContext } from "./context";

export const DropdownMenuFilterField: FC = () => {
  const { filterQuery, setFilterQuery, filterPlaceholder, contentRef } =
    useDropdownMenuContext();

  const focusFirstMenuItem = useCallback(() => {
    const root = contentRef?.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>(
      '[role="menuitem"]:not([data-disabled="true"]):not([hidden])',
    );
    first?.focus();
  }, [contentRef]);

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusFirstMenuItem();
    }
  };

  return (
    <div
      className={styles["dropdown-menu-filter"]}
      data-dropdown-menu-filter
      onClick={(event) => event.stopPropagation()}
      onKeyDownCapture={handleKeyDownCapture}
    >
      <Input
        className={styles["dropdown-menu-filter__input"]}
        value={filterQuery}
        onChange={(e) => setFilterQuery(e.target.value)}
        placeholder={filterPlaceholder}
        aria-label={filterPlaceholder}
      />
    </div>
  );
};

DropdownMenuFilterField.displayName = "DropdownMenuFilterField";
