import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { auditLogsApi } from "@/api/auditLogs";

describe("api/auditLogs – kontrakt (MSW)", () => {
  it("list(): przekazuje params jako query string", async () => {
    server.use(
      http.get("/api/audit-logs/", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("action")).toBe("LOGIN");
        expect(url.searchParams.get("performed_by")).toBe("1");
        expect(url.searchParams.get("page")).toBe("2");

        return HttpResponse.json(
          { count: 0, next: null, previous: null, results: [] },
          { status: 200 }
        );
      })
    );

    const res = await auditLogsApi.list({ action: "LOGIN", performed_by: 1, page: 2 });
    expect(res.results).toEqual([]);
  });
});
