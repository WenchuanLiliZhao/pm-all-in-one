import { NavLink, Outlet } from "react-router-dom";
import { LAB_NAV } from "./nav";
import styles from "./layout.module.scss";

export function LabLayout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>UI Lab</div>
        <p className={styles.tagline}>Dev-only · real components</p>
        <nav className={styles.nav} aria-label="Lab components">
          {LAB_NAV.map((category) => (
            <div key={category.id} className={styles.category}>
              <div className={styles.categoryLabel}>{category.label}</div>
              <ul className={styles.list}>
                {category.items.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        [styles.link, isActive ? styles.linkActive : null]
                          .filter(Boolean)
                          .join(" ")
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
