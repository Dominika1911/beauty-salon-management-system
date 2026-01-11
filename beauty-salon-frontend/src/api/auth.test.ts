import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { authApi } from "@/api/auth";

describe("api/auth – kontrakt endpointów (MSW)", () => {
  it("pobiera token CSRF", async () => {
    server.use(
      http.get("/api/auth/csrf/", () => {
        return HttpResponse.json({ detail: "CSRF ok" }, { status: 200 });
      })
    );

    const res = await authApi.getCsrf();
    expect(res.detail).toBe("CSRF ok");
  });

  it("loguje użytkownika i zwraca dane user", async () => {
    server.use(
      http.post("/api/auth/login/", async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({ username: "u1", password: "p1" });

        return HttpResponse.json(
          { detail: "ok", user: { id: 1, username: "u1", role: "CLIENT" } },
          { status: 200 }
        );
      })
    );

    const res = await authApi.login("u1", "p1");
    expect(res.user.username).toBe("u1");
  });

  it("sprawdza status zalogowania", async () => {
    server.use(
      http.get("/api/auth/status/", () => {
        return HttpResponse.json(
          { isAuthenticated: true, user: { id: 1, username: "u1", role: "CLIENT" } },
          { status: 200 }
        );
      })
    );

    const res = await authApi.getStatus();
    expect(res.isAuthenticated).toBe(true);
    expect(res.user?.username).toBe("u1");
  });

  it("wylogowuje użytkownika", async () => {
    server.use(
      http.post("/api/auth/logout/", () => {
        return HttpResponse.json({ detail: "Logged out" }, { status: 200 });
      })
    );

    const res = await authApi.logout();
    expect(res.detail).toBe("Logged out");
  });

  it("zmienia hasło", async () => {
    server.use(
      http.post("/api/auth/change-password/", async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({
          old_password: "old",
          new_password: "new",
          new_password2: "new",
        });

        return HttpResponse.json({ detail: "changed" }, { status: 200 });
      })
    );

    const res = await authApi.changePassword({
      old_password: "old",
      new_password: "new",
      new_password2: "new",
    });

    expect(res.detail).toBe("changed");
  });
});
