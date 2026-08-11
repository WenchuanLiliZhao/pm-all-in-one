import { Banner } from "@/components/ui/banner";
import { PageWidth } from "@/components/ui/page-width";
import styles from "./page.module.scss";

export function BannerPage() {
  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Banner</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/banner</code>.
      </p>
      <div className={styles.block}>
        <Banner tone="error">Something went wrong while opening the workspace.</Banner>
      </div>
      <div className={styles.block}>
        <Banner tone="warn">Writer handle is not set; writes are blocked.</Banner>
      </div>
      <div className={styles.block}>
        <Banner tone="error" onDismiss={() => undefined}>
          Dismissible error banner
        </Banner>
      </div>
    </PageWidth>
  );
}
