import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider, useAuth } from "./AuthContext";
import { authApi } from "@/api/auth";
import type { User } from "@/types";

vi.mock("@/api/auth", () => {
  return {
    authApi: {
      getCsrf: vi.fn(),
      getStatus: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    },
  };
});

function makeUser(role: "ADMIN" | "EMPLOYEE" | "CLIENT"): User {
  return {
    id: 1,
    username: "u",
    first_name: "Jan",
    last_name: "Kowalski",
    email: "u@example.com",
    role,
    role_display: role,
    is_active: true,
    employee_profile: null,
    client_profile: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

type CapturedAuth = ReturnType<typeof useAuth>;

function CaptureAuth(props: { onReady: (a: CapturedAuth) => void }) {
  const a = useAuth();
  React.useEffect(() => {
    props.onReady(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function StateView() {
  const { user, loading, isAdmin, isEmployee, isClient, logout } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? "true" : "false"}</div>
      <div data-testid="user">{user ? user.username : "brak"}</div>
      <div data-testid="roles">
        {isAdmin ? "admin" : ""} {isEmployee ? "employee" : ""}{" "}
        {isClient ? "client" : ""}
      </div>

      <button
        type="button"
        onClick={() => {
          void logout().catch(() => {});
        }}
      >
        LOGOUT
      </button>
    </div>
  );
}

function renderAuth(onReady?: (a: CapturedAuth) => void) {
  return render(
    <AuthProvider>
      {onReady ? <CaptureAuth onReady={onReady} /> : null}
      <StateView />
    </AuthProvider>
  );
}

describe("context/AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("init: woła getCsrf() i getStatus(); finalnie loading=false", async () => {
    vi.mocked(authApi.getCsrf).mockResolvedValue({ detail: "CSRF cookie set" } as any);
    vi.mocked(authApi.getStatus).mockResolvedValue({
      isAuthenticated: false,
      user: null,
    } as any);

    renderAuth();

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(authApi.getCsrf).toHaveBeenCalledTimes(1);
    expect(authApi.getStatus).toHaveBeenCalledTimes(1);
  });

  it("init: gdy zalogowany -> ustawia user i flagi roli", async () => {
    vi.mocked(authApi.getCsrf).mockResolvedValue({ detail: "CSRF cookie set" } as any);
    vi.mocked(authApi.getStatus).mockResolvedValue({
      isAuthenticated: true,
      user: makeUser("ADMIN"),
    } as any);

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getByTestId("user").textContent).toBe("u");
    expect(screen.getByTestId("roles").textContent).toContain("admin");
    expect(screen.getByTestId("roles").textContent).not.toContain("employee");
    expect(screen.getByTestId("roles").textContent).not.toContain("client");
  });

  it("refreshUser(): gdy getStatus rzuci -> czyści user (gałąź catch)", async () => {
    vi.mocked(authApi.getCsrf).mockResolvedValue({ detail: "CSRF cookie set" } as any);

    // init: start jako zalogowany
    vi.mocked(authApi.getStatus).mockResolvedValueOnce({
      isAuthenticated: true,
      user: makeUser("CLIENT"),
    } as any);

    let captured: CapturedAuth | null = null;
    renderAuth((a) => (captured = a));

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("u");

    // refresh: getStatus rzuca
    vi.mocked(authApi.getStatus).mockRejectedValueOnce(new Error("network"));

    await captured!.refreshUser();

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("brak");
    });
  });

  it("login(): robi getCsrf -> login -> refreshUser(getStatus) i zwraca user", async () => {
    vi.mocked(authApi.getCsrf).mockResolvedValue({ detail: "CSRF cookie set" } as any);

    // init: niezalogowany
    vi.mocked(authApi.getStatus).mockResolvedValueOnce({
      isAuthenticated: false,
      user: null,
    } as any);

    // po login: zalogowany
    vi.mocked(authApi.getStatus).mockResolvedValueOnce({
      isAuthenticated: true,
      user: makeUser("EMPLOYEE"),
    } as any);

    vi.mocked(authApi.login).mockResolvedValue({ detail: "Logged in" } as any);

    let captured: CapturedAuth | null = null;
    renderAuth((a) => (captured = a));

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("brak");

    const res = await captured!.login({ username: "test", password: "test" });

    expect(res.username).toBe("u");
    expect(authApi.getCsrf).toHaveBeenCalledTimes(2); // init + login
    expect(authApi.login).toHaveBeenCalledWith("test", "test");
    expect(authApi.getStatus).toHaveBeenCalledTimes(2); // init + refreshUser po login

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("u");
      expect(screen.getByTestId("roles").textContent).toContain("employee");
    });
  });

  it("login(): gdy po login() refreshUser zwróci null -> rejects z błędem (bez unhandled rejection)", async () => {
    vi.mocked(authApi.getCsrf).mockResolvedValue({ detail: "CSRF cookie set" } as any);

    // init: niezalogowany
    vi.mocked(authApi.getStatus).mockResolvedValueOnce({
      isAuthenticated: false,
      user: null,
    } as any);

    // po login: nadal brak sesji
    vi.mocked(authApi.getStatus).mockResolvedValueOnce({
      isAuthenticated: false,
      user: null,
    } as any);

    vi.mocked(authApi.login).mockResolvedValue({ detail: "Logged in" } as any);

    let captured: CapturedAuth | null = null;
    renderAuth((a) => (captured = a));

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    await expect(
      captured!.login({ username: "test", password: "test" })
    ).rejects.toThrow(/Logowanie nieudane - brak sesji/);

    // user nadal pusty
    expect(screen.getByTestId("user").textContent).toBe("brak");
  });

  it("logout(): czyści user lokalnie nawet jeśli authApi.logout rzuci", async () => {
    vi.mocked(authApi.getCsrf).mockResolvedValue({ detail: "CSRF cookie set" } as any);
    vi.mocked(authApi.getStatus).mockResolvedValue({
      isAuthenticated: true,
      user: makeUser("CLIENT"),
    } as any);

    vi.mocked(authApi.logout).mockRejectedValue(new Error("boom"));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("user").textContent).toBe("u");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "LOGOUT" }));

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("brak");
    });

    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });

  it("useAuth(): poza AuthProvider rzuca czytelny błąd (guard)", () => {
    function Outside() {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useAuth();
      return null;
    }

    expect(() => render(<Outside />)).toThrowError(/useAuth musi być używany wewnątrz AuthProvider/);
  });
});
