import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth.ts";
import styles from "./LoginPage.module.css";

type LoginResult = { success: boolean; error?: string };

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const mapLoginError = (code?: string) => {
    if (code === "superuser_login_not_allowed") return "Konta administracyjne logują się przez /admin/";
    if (code === "Invalid credentials.") return "Nieprawidłowy email lub hasło";
    if (code === "User account is disabled.") return "Konto zostało dezaktywowane";
    if (code?.includes("locked")) return "Konto tymczasowo zablokowane";
    return code || "Błąd logowania";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result: LoginResult = await login({ email, password });

      if (result.success) {
        navigate("/dashboard");
        return;
      }

      setError(mapLoginError(result.error));
    } catch {
      setError("Błąd logowania");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginPageDecoration} />

      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.loginLogo} />
            <h1>Beauty Salon Management System</h1>
            <p>System Zarządzania Salonem Kosmetycznym</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email:</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="klient@beauty-salon.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Hasło:</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className={styles.loginBtn}>
              {loading ? (
                <>
                  <span className={styles.spinnerSmall} />
                  Logowanie...
                </>
              ) : (
                "Zaloguj się"
              )}
            </button>
          </form>

          <div className={styles.loginFooter}>{/* reset hasła usunięty */}</div>
        </div>
      </div>
    </div>
  );
}
