/**
 * Lab matrix for ToggleSwitch — real module `@/components/ui/toggle-switch`.
 *
 * ↔ components/ui/toggle-switch — component under test
 * ↔ lab/pages/dropdown-menu.tsx — also exercised inside ItemWithSwitch
 */
import { useState } from "react";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { PageWidth } from "@/components/ui/page-width";
import styles from "./page.module.scss";

export function ToggleSwitchPage() {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);

  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Toggle switch</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/toggle-switch</code>. Also used by{" "}
        <code>DropdownMenu.ItemWithSwitch</code> (see Lab → Dropdown menu).
      </p>

      <div className={styles.block}>
        <p className={styles.blockLabel}>labeled</p>
        <div className={styles.row} style={{ maxWidth: 280 }}>
          <ToggleSwitch
            label="Notifications"
            checked={on}
            onCheckedChange={setOn}
          />
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>unlabeled</p>
        <div className={styles.row}>
          <ToggleSwitch checked={off} onCheckedChange={setOff} />
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>disabled</p>
        <div className={styles.row} style={{ maxWidth: 280 }}>
          <ToggleSwitch
            label="Locked on"
            checked
            onCheckedChange={() => {}}
            disabled
          />
          <ToggleSwitch
            label="Locked off"
            checked={false}
            onCheckedChange={() => {}}
            disabled
          />
        </div>
      </div>
    </PageWidth>
  );
}
