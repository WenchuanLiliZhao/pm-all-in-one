/**
 * Lab matrix for PageWidth — reading / full / narrow × padded.
 *
 * ↔ src/components/ui/page-width — real module under test
 * ↔ src/global-styles/layout.scss — content-max / content-narrow / page-pad
 * ↔ src/components/wiki-shell — product host (`contentWidth` → PageWidth)
 */
import { PageWidth, type PageWidthMode } from "@/components/ui/page-width";
import styles from "./page.module.scss";
import matrixStyles from "./page-width.module.scss";

const WIDTHS: PageWidthMode[] = ["reading", "full", "narrow"];

function SampleBlock({ label }: { label: string }) {
  return (
    <div className={matrixStyles.sample}>
      <strong>{label}</strong>
      <p>
        Column fills this dashed viewport mock. Resize the lab window to see
        the cap. WikiShell uses the same module for{" "}
        <code>contentWidth=&quot;reading&quot; | &quot;full&quot;</code> with{" "}
        <code>padded</code>.
      </p>
    </div>
  );
}

export function PageWidthPage() {
  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Page width</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/page-width</code>. Tokens:{" "}
        <code>--layout--content-max</code> (reading),{" "}
        <code>--layout--content-narrow</code> (narrow), page pad via{" "}
        <code>padded</code>. Product and lab share this module.
      </p>

      {WIDTHS.map((width) => (
        <div key={width} className={styles.block}>
          <p className={styles.blockLabel}>{width}</p>
          <div className={matrixStyles.viewport}>
            <PageWidth width={width}>
              <SampleBlock label={`${width} (unpadded)`} />
            </PageWidth>
          </div>
          <div className={matrixStyles.viewport}>
            <PageWidth width={width} padded>
              <SampleBlock label={`${width} + padded`} />
            </PageWidth>
          </div>
        </div>
      ))}
    </PageWidth>
  );
}
