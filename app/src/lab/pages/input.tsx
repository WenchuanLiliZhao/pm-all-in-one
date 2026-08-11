import { Input } from "@/components/ui/input";
import { PageWidth } from "@/components/ui/page-width";
import styles from "./page.module.scss";

export function InputPage() {
  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Input</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/input</code>.
      </p>
      <div className={styles.block}>
        <p className={styles.blockLabel}>Default</p>
        <Input className={styles.field} defaultValue="Sample input" aria-label="Sample input" />
      </div>
      <div className={styles.block}>
        <p className={styles.blockLabel}>Disabled</p>
        <Input
          className={styles.field}
          defaultValue="Disabled"
          disabled
          aria-label="Disabled input"
        />
      </div>
    </PageWidth>
  );
}
