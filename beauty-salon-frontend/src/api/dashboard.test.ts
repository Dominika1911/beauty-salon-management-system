import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { dashboardApi } from "@/api/dashboard";

describe("api/dashboard – pobieranie danych panelu (MSW)", () => {
  it("pobiera dane z endpointu /api/dashboard/", async () => {
    server.use(
      http.get("/api/dashboard/", () => {
        return HttpResponse.json({ role: "CLIENT" }, { status: 200 });
      })
    );

    const res = await dashboardApi.get();
    expect((res as any).role).toBe("CLIENT");
  });
});
