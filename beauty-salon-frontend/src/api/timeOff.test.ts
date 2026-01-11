import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { timeOffApi } from "@/api/timeOff";
import type { DRFPaginated, TimeOff, TimeOffStatus } from "@/types";

const makeTimeOff = (overrides?: Partial<TimeOff>): TimeOff => ({
  id: 1,
  employee: 7,
  employee_name: "Jan Kowalski",
  date_from: "2026-01-01",
  date_to: "2026-01-05",
  reason: "choroba",
  status: "PENDING",
  status_display: "Pending",
  can_cancel: true,
  can_approve: true,
  can_reject: true,
  requested_by: 1,
  decided_by: null,
  decided_at: null,
  created_at: "2026-01-01T10:00:00Z",
  ...overrides,
});

describe("api/timeOff – kontrakt endpointów (MSW)", () => {
  it("list(): przekazuje params jako query string", async () => {
    const payload: DRFPaginated<TimeOff> = {
      count: 1,
      next: null,
      previous: null,
      results: [makeTimeOff()],
    };

    server.use(
      http.get("/api/time-offs/", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("status")).toBe("PENDING");
        expect(url.searchParams.get("employee")).toBe("7");
        expect(url.searchParams.get("page")).toBe("2");

        return HttpResponse.json(payload, { status: 200 });
      })
    );

    const res = await timeOffApi.list({
      status: "PENDING" as TimeOffStatus,
      employee: 7,
      page: 2,
    });

    expect(res.count).toBe(1);
    expect(res.results[0].status).toBe("PENDING");
  });

  it("get(): pobiera wniosek urlopowy po id", async () => {
    const payload = makeTimeOff({ id: 7 });

    server.use(
      http.get("/api/time-offs/7/", () => {
        return HttpResponse.json(payload, { status: 200 });
      })
    );

    const res = await timeOffApi.get(7);
    expect(res.id).toBe(7);
    expect(res.employee).toBe(7);
  });

  it("create(): wysyła payload i zwraca TimeOff", async () => {
    const created = makeTimeOff({ id: 99 });

    server.use(
      http.post("/api/time-offs/", async ({ request }) => {
        const body: any = await request.json();

        expect(body).toEqual({
          date_from: "2026-01-01",
          date_to: "2026-01-05",
          reason: "choroba",
        });

        return HttpResponse.json(created, { status: 201 });
      })
    );

    const res = await timeOffApi.create({
      date_from: "2026-01-01",
      date_to: "2026-01-05",
      reason: "choroba",
    });

    expect(res.id).toBe(99);
    expect(res.status).toBe("PENDING");
  });

  it("approve(): POST /time-offs/:id/approve/", async () => {
    const approved = makeTimeOff({
      id: 9,
      status: "APPROVED",
      status_display: "Approved",
    });

    server.use(
      http.post("/api/time-offs/9/approve/", () => {
        return HttpResponse.json(approved, { status: 200 });
      })
    );

    const res = await timeOffApi.approve(9);
    expect(res.id).toBe(9);
    expect(res.status).toBe("APPROVED");
  });

  it("reject(): POST /time-offs/:id/reject/", async () => {
    const rejected = makeTimeOff({
      id: 10,
      status: "REJECTED",
      status_display: "Rejected",
    });

    server.use(
      http.post("/api/time-offs/10/reject/", () => {
        return HttpResponse.json(rejected, { status: 200 });
      })
    );

    const res = await timeOffApi.reject(10);
    expect(res.id).toBe(10);
    expect(res.status).toBe("REJECTED");
  });

  it("cancel(): POST /time-offs/:id/cancel/", async () => {
    const cancelled = makeTimeOff({
      id: 11,
      status: "CANCELLED",
      status_display: "Cancelled",
    });

    server.use(
      http.post("/api/time-offs/11/cancel/", () => {
        return HttpResponse.json(cancelled, { status: 200 });
      })
    );

    const res = await timeOffApi.cancel(11);
    expect(res.id).toBe(11);
    expect(res.status).toBe("CANCELLED");
  });
});
