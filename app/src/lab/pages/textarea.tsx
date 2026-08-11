import { Textarea } from "@/components/ui/textarea";
import { PageWidth } from "@/components/ui/page-width";
import styles from "./page.module.scss";

export function TextareaPage() {
  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Textarea</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/textarea</code>.
      </p>
      <div className={styles.block}>
        <Textarea
          className={styles.field}
          rows={4}
          defaultValue="Sample textarea"
          aria-label="Sample textarea"
        />
      </div>
      <div className={styles.block}>
        <Textarea
          className={styles.field}
          rows={3}
          defaultValue="Disabled"
          disabled
          aria-label="Disabled textarea"
        />
      </div>
    </PageWidth>
  );
}
