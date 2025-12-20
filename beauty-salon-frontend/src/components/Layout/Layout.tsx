import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.ts";
import { Sidebar } from "./Sidebar.tsx";
import styles from "./Layout.module.css";

export function Layout() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className={styles.layoutLoading}>
        <span className={styles.spinnerLarge} />
        Ładowanie aplikacji i sprawdzanie sesji...
      </div>
    );
  }

  const hasSidebar = user !== null;

  return (
    <div className={[styles.appLayout, !hasSidebar ? styles.appLayoutNoSidebar : ""].filter(Boolean).join(" ")}>
      <Sidebar />

      <main className={styles.layoutContent}>
        <Outlet />
      </main>
    </div>
  );
}
