import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { appointmentsApi } from "@/api/appointments";

describe("api/appointments – kontrakty i normalizacja payloadów (MSW)", () => {
  it("list(): pobiera listę wizyt z parametrami zapytania", async () => {
    server.use(
      http.get("/api/appointments/", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("status")).toBe("PENDING");
        expect(url.searchParams.get("page")).toBe("2");

        return HttpResponse.json(
          { count: 0, next: null, previous: null, results: [] },
          { status: 200 }
        );
      })
    );

    const res = await appointmentsApi.list({ status: "PENDING", page: 2 });
    expect(res.results).toEqual([]);
  });

  it("getMy(): pobiera moje wizyty (appointments/my) z parametrami", async () => {
    server.use(
      http.get("/api/appointments/my/", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("page")).toBe("3");
        expect(url.searchParams.get("ordering")).toBe("-start");

        return HttpResponse.json(
          { count: 0, next: null, previous: null, results: [] },
          { status: 200 }
        );
      })
    );

    const res = await appointmentsApi.getMy({ page: 3, ordering: "-start" });
    expect(res.results).toEqual([]);
  });

  it("get(): pobiera szczegóły wizyty po id", async () => {
    server.use(
      http.get("/api/appointments/123/", () => {
        return HttpResponse.json(
          { id: 123, status: "CONFIRMED" },
          { status: 200 }
        );
      })
    );

    const res = await appointmentsApi.get(123);
    expect((res as any).id).toBe(123);
    expect((res as any).status).toBe("CONFIRMED");
  });

  it("create(): tworzy wizytę i normalizuje internal_notes do pustego stringa", async () => {
    server.use(
      http.post("/api/appointments/", async ({ request }) => {
        const body: any = await request.json();
        // kontrakt z Twojego kodu: internal_notes: data.internal_notes ?? ''
        expect(body.internal_notes).toBe("");

        return HttpResponse.json({ id: 1 }, { status: 201 });
      })
    );

    const res = await appointmentsApi.create({
      client: null,
      employee: 10,
      service: 20,
      start: "2026-01-11T10:00:00Z",
      end: "2026-01-11T10:30:00Z",
      internal_notes: undefined,
    } as any);

    expect((res as any).id).toBe(1);
  });

  it("update(): nie wysyła internal_notes, jeśli jest undefined (kontrakt: tylko gdy podane)", async () => {
    server.use(
      http.patch("/api/appointments/123/", async ({ request }) => {
        const body: any = await request.json();
        expect("internal_notes" in body).toBe(false);

        return HttpResponse.json(
          { id: 123, status: "CONFIRMED" },
          { status: 200 }
        );
      })
    );

    const res = await appointmentsApi.update(123, { status: "CONFIRMED" } as any);
    expect((res as any).status).toBe("CONFIRMED");
  });

  it("update(): normalizuje internal_notes gdy podane jako null => ''", async () => {
    server.use(
      http.patch("/api/appointments/124/", async ({ request }) => {
        const body: any = await request.json();
        // kontrakt z Twojego kodu: internal_notes: data.internal_notes ?? ''
        expect(body.internal_notes).toBe("");

        return HttpResponse.json(
          { id: 124, internal_notes: "" },
          { status: 200 }
        );
      })
    );

    const res = await appointmentsApi.update(124, { internal_notes: null } as any);
    expect((res as any).id).toBe(124);
  });

  it("book(): POST /appointments/book/ z payloadem BookingCreate", async () => {
    server.use(
      http.post("/api/appointments/book/", async ({ request }) => {
        const body: any = await request.json();
        expect(body).toEqual({
          employee_id: 1,
          service_id: 2,
          start: "2026-01-11T10:00:00Z",
        });

        return HttpResponse.json({ id: 77 }, { status: 201 });
      })
    );

    const res = await appointmentsApi.book({
      employee_id: 1,
      service_id: 2,
      start: "2026-01-11T10:00:00Z",
    } as any);

    expect((res as any).id).toBe(77);
  });

  it("confirm(): POST /appointments/:id/confirm/", async () => {
    server.use(
      http.post("/api/appointments/5/confirm/", () => {
        return HttpResponse.json({ id: 5 }, { status: 200 });
      })
    );

    const res = await appointmentsApi.confirm(5);
    expect((res as any).id).toBe(5);
  });

  it("cancel(): POST /appointments/:id/cancel/", async () => {
    server.use(
      http.post("/api/appointments/5/cancel/", () => {
        return HttpResponse.json({ id: 5 }, { status: 200 });
      })
    );

    const res = await appointmentsApi.cancel(5);
    expect((res as any).id).toBe(5);
  });

  it("complete(): POST /appointments/:id/complete/", async () => {
    server.use(
      http.post("/api/appointments/5/complete/", () => {
        return HttpResponse.json({ id: 5 }, { status: 200 });
      })
    );

    const res = await appointmentsApi.complete(5);
    expect((res as any).id).toBe(5);
  });

  it("noShow(): POST /appointments/:id/no-show/", async () => {
    server.use(
      http.post("/api/appointments/5/no-show/", () => {
        return HttpResponse.json({ id: 5 }, { status: 200 });
      })
    );

    const res = await appointmentsApi.noShow(5);
    expect((res as any).id).toBe(5);
  });

  it("updateNotes(): PATCH /appointments/:id/notes/ wysyła internal_notes", async () => {
    server.use(
      http.patch("/api/appointments/7/notes/", async ({ request }) => {
        const body: any = await request.json();
        expect(body).toEqual({ internal_notes: "abc" });

        return HttpResponse.json(
          { id: 7, internal_notes: "abc" },
          { status: 200 }
        );
      })
    );

    const res = await appointmentsApi.updateNotes(7, "abc");
    expect((res as any).id).toBe(7);
    expect((res as any).internal_notes).toBe("abc");
  });

  it("remove(): DELETE /appointments/:id/ zwraca void", async () => {
    server.use(
      http.delete("/api/appointments/42/", () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(appointmentsApi.remove(42)).resolves.toBeUndefined();
  });

  it("getAvailableSlots(): GET /availability/slots/ z params", async () => {
    server.use(
      http.get("/api/availability/slots/", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("employee_id")).toBe("1");
        expect(url.searchParams.get("service_id")).toBe("2");
        expect(url.searchParams.get("date")).toBe("2026-01-11");

        return HttpResponse.json(
          { date: "2026-01-11", slots: [{ start: "10:00", end: "10:30" }] },
          { status: 200 }
        );
      })
    );

    const res = await appointmentsApi.getAvailableSlots(1, 2, "2026-01-11");
    expect(res.date).toBe("2026-01-11");
    expect(res.slots).toHaveLength(1);
  });

  it("checkAvailability(): POST /appointments/check-availability/ z payloadem", async () => {
    server.use(
      http.post("/api/appointments/check-availability/", async ({ request }) => {
        const body: any = await request.json();
        expect(body).toEqual({
          employee_id: 5,
          service_id: 9,
          start: "2026-01-11T10:00:00Z",
        });

        return HttpResponse.json({ available: true }, { status: 200 });
      })
    );

    const res = await appointmentsApi.checkAvailability(
      5,
      9,
      "2026-01-11T10:00:00Z"
    );

    expect(res.available).toBe(true);
  });
});
