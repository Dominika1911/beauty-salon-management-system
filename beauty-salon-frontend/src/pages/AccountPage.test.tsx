import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AccountPage from "./AccountPage";
import { authApi } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";

vi.mock("@/api/auth", () => ({
  authApi: {
    changePassword: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

function mockUseAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: {
      id: 1,
      username: "test",
      first_name: "Jan",
      last_name: "Kowalski",
      email: "test@test.pl",
      role: "CLIENT",
      role_display: "Klient",
    },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    isAuthenticated: true,
    isAdmin: false,
    isEmployee: false,
    isClient: true,
    ...overrides,
  });
}

describe("AccountPage – change password (UI integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>
    );

  it("disables both submit buttons until all fields are filled", async () => {
    const user = userEvent.setup();
    renderPage();

    const topBtn = screen.getByRole("button", { name: "Zmień hasło" });
    const bottomBtn = screen.getByRole("button", { name: "Zaktualizuj hasło" });

    expect(topBtn).toBeDisabled();
    expect(bottomBtn).toBeDisabled();

    await user.type(screen.getByLabelText("Aktualne hasło"), "oldpassword");
    expect(topBtn).toBeDisabled();

    await user.type(screen.getByLabelText("Nowe hasło"), "newpassword");
    expect(topBtn).toBeDisabled();

    await user.type(screen.getByLabelText("Powtórz nowe hasło"), "newpassword");
    expect(topBtn).toBeEnabled();
    expect(bottomBtn).toBeEnabled();
  });

  it("blocks submit when passwords do not match and shows helperText under confirm field", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Aktualne hasło"), "oldpassword");
    await user.type(screen.getByLabelText("Nowe hasło"), "newpassword1");
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), "newpassword2");

    const topBtn = screen.getByRole("button", { name: "Zmień hasło" });
    const bottomBtn = screen.getByRole("button", { name: "Zaktualizuj hasło" });

    expect(topBtn).toBeDisabled();
    expect(bottomBtn).toBeDisabled();

    const confirmInput = screen.getByLabelText("Powtórz nowe hasło");
    expect(confirmInput).toHaveAccessibleDescription(expect.stringMatching(/identyczne/i));

    expect(vi.mocked(authApi.changePassword)).not.toHaveBeenCalled();
  });

  it("blocks submit when new password is shorter than 8 and shows helperText", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Aktualne hasło"), "oldpassword");
    await user.type(screen.getByLabelText("Nowe hasło"), "short");
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), "short");

    const topBtn = screen.getByRole("button", { name: "Zmień hasło" });
    expect(topBtn).toBeDisabled();

    const newPasswordInput = screen.getByLabelText("Nowe hasło");
    expect(newPasswordInput).toHaveAccessibleDescription(expect.stringMatching(/8/i));

    expect(vi.mocked(authApi.changePassword)).not.toHaveBeenCalled();
  });

  it("maps 400 field errors to helperText (e.g. new_password)", async () => {
    const user = userEvent.setup();

    vi.mocked(authApi.changePassword).mockRejectedValue({
      response: {
        status: 400,
        data: {
          new_password: ["Hasło jest za słabe"],
        },
      },
    });

    renderPage();

    await user.type(screen.getByLabelText("Aktualne hasło"), "oldpassword");
    await user.type(screen.getByLabelText("Nowe hasło"), "newpassword");
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), "newpassword");

    await user.click(screen.getByRole("button", { name: "Zaktualizuj hasło" }));

    const newPasswordInput = await screen.findByLabelText("Nowe hasło");
    expect(newPasswordInput).toHaveAccessibleDescription("Hasło jest za słabe");
  });

  it("prevents double submit while saving (only one API call, button becomes disabled)", async () => {
    const user = userEvent.setup();

    let resolve!: () => void;
    const pending = new Promise<void>((r) => {
      resolve = r;
    });

    const spy = vi.mocked(authApi.changePassword).mockReturnValue(pending);

    renderPage();

    await user.type(screen.getByLabelText("Aktualne hasło"), "oldpassword");
    await user.type(screen.getByLabelText("Nowe hasło"), "newpassword");
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), "newpassword");

    const bottomBtn = screen.getByRole("button", { name: "Zaktualizuj hasło" });

    await user.dblClick(bottomBtn);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(bottomBtn).toBeDisabled();

    resolve();
    await Promise.resolve();
  });

  it("shows success snackbar and calls refreshUser on success", async () => {
    const user = userEvent.setup();
    const refreshUser = vi.fn();

    mockUseAuth({ refreshUser });

    vi.mocked(authApi.changePassword).mockResolvedValue({});

    renderPage();

    await user.type(screen.getByLabelText("Aktualne hasło"), "oldpassword");
    await user.type(screen.getByLabelText("Nowe hasło"), "newpassword");
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), "newpassword");

    await user.click(screen.getByRole("button", { name: "Zmień hasło" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Hasło zostało zmienione.");

    expect(refreshUser).toHaveBeenCalled();
  });
});
