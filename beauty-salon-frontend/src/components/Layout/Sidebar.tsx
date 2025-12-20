import { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.ts";
import type { UserRole } from "@/types";
import styles from "./Sidebar.module.css";

type NavItem = {
  label: string;
  path?: string;
  roles: UserRole[];
  type?: "link" | "header";
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems: NavItem[] = useMemo(() => {
    if (!user) return [];

    return [
      { label: "Dashboard", path: "/dashboard", roles: ["manager", "employee", "client"], type: "link" },

      // EMPLOYEE
      { label: "Pracownik", roles: ["employee"], type: "header" },
      { label: "Mój profil", path: "/my-profile", roles: ["employee"], type: "link" },
      { label: "Moja dostępność", path: "/my-availability", roles: ["employee"], type: "link" },
      { label: "Mój grafik", path: "/my-schedule", roles: ["employee"], type: "link" },
      { label: "Moje urlopy", path: "/my-time-off", roles: ["employee"], type: "link" },

      // SERVICES
      {
        label: user.role === "manager" ? "Usługi (zarządzanie)" : "Usługi",
        path: "/services",
        roles: ["manager", "employee", "client"],
        type: "link",
      },

      // SHARED
      { label: "Moje wizyty", path: "/my-appointments", roles: ["employee", "client"], type: "link" },

      // CLIENT
      { label: "Klient", roles: ["client"], type: "header" },
      { label: "Mój profil (RODO)", path: "/my-client-profile", roles: ["client"], type: "link" },
      { label: "Umów wizytę", path: "/book", roles: ["client"], type: "link" },

      // MANAGER
      { label: "Manager", roles: ["manager"], type: "header" },
      { label: "Profil", path: "/profile", roles: ["manager"], type: "link" },
      { label: "Wizyty (kalendarz)", path: "/appointments", roles: ["manager"], type: "link" },
      { label: "Wizyty (lista)", path: "/appointments-management", roles: ["manager"], type: "link" },
      { label: "Grafik (zarządzanie)", path: "/schedule", roles: ["manager"], type: "link" },
      { label: "Klienci", path: "/clients", roles: ["manager"], type: "link" },
      { label: "Pracownicy", path: "/employees", roles: ["manager"], type: "link" },
      { label: "Płatności", path: "/payments", roles: ["manager"], type: "link" },
      { label: "Faktury", path: "/invoices", roles: ["manager"], type: "link" },
      { label: "Powiadomienia", path: "/notifications", roles: ["manager"], type: "link" },
      { label: "Raporty", path: "/reports", roles: ["manager"], type: "link" },
      { label: "Logi systemowe", path: "/audit-logs", roles: ["manager"], type: "link" },
      { label: "Statystyki", path: "/statistics", roles: ["manager"], type: "link" },
      { label: "Ustawienia", path: "/settings", roles: ["manager"], type: "link" },
    ];
  }, [user]);

  if (!user) return null;

  const visibleItems = navItems.filter((it) => it.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav}>
        {visibleItems.map((item) => {
          if (item.type === "header") {
            return (
              <div key={`h-${item.label}`} className={styles.sectionHeader}>
                {item.label}
              </div>
            );
          }

          if (!item.path) return null;

          return (
            <NavLink
              key={`${item.path}-${item.label}`}
              to={item.path}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ""].filter(Boolean).join(" ")
              }
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <button
        type="button"
        className={styles.logoutBtn}
        onClick={() => {
          const confirmed = window.confirm("Czy na pewno chcesz się wylogować?");
          if (confirmed) void handleLogout();
        }}
      >
        Wyloguj
      </button>
    </aside>
  );
}
