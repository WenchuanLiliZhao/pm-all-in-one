import { Select } from "@/components/ui/select";
import { PageWidth } from "@/components/ui/page-width";
import styles from "./page.module.scss";

export function SelectPage() {
  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Select</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/select</code>.
      </p>
      <div className={styles.block}>
        <Select className={styles.field} defaultValue="a" aria-label="Sample select">
          <option value="a">Option A</option>
          <option value="b">Option B</option>
          <option value="c">Option C</option>
        </Select>
      </div>
      <div className={styles.block}>
        <Select
          className={styles.field}
          defaultValue="a"
          disabled
          aria-label="Disabled select"
        >
          <option value="a">Disabled</option>
        </Select>
      </div>
    </PageWidth>
  );
}
