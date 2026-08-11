import { Link } from "react-router-dom";
import styles from "./styles.module.scss";

export function Content() {
  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <h1>Not found</h1>
        <p className={styles.lead}>This route does not exist.</p>
        <Link to="/">Back to welcome</Link>
      </div>
    </main>
  );
}
