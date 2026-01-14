import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/auth/csrf/", async () => {
    return HttpResponse.json({ detail: "CSRF ok" }, { status: 200 });
  }),

  http.get("/api/auth/status/", async () => {
    return HttpResponse.json(
      { isAuthenticated: false, user: null },
      { status: 200 }
    );
  }),

  http.post("/api/auth/login/", async () => {
    return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
  }),

  http.post("/api/auth/logout/", async () => {
    return HttpResponse.json({ detail: "Logged out" }, { status: 200 });
  }),
];
