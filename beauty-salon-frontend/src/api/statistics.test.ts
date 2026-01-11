import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { statisticsApi } from "@/api/statistics";
import type { Statistics } from "@/types";

describe("api/statistics – kontrakt endpointu (MSW)", () => {
  it("get(): pobiera obiekt Statistics i zwraca response.data 1:1", async () => {
    const payload: Statistics = {
      appointments: {
        total_all_time: 100,
        last_30_days: 20,
        completed_last_30d: 15,
        cancelled_last_30d: 3,
        no_shows_last_30d: 2,
        upcoming: 5,
      },
      revenue: {
        total_all_time: 10000,
        last_30_days: 2000,
        avg_appointment_value: 120,
      },
      employees: {
        total: 5,
        active: 4,
        with_appointments_last_30d: 3,
      },
      clients: {
        total: 200,
        active: 150,
        with_appointments_last_30d: 40,
      },
      services: {
        total: 30,
        active: 25,
      },
      popular_services: [
        {
          id: 1,
          name: "Haircut",
          category: "Hair",
          booking_count: 10,
          total_revenue: 1000,
          price: 100,
        },
      ],
    };

    server.use(
      http.get("/api/statistics/", () => {
        return HttpResponse.json(payload, { status: 200 });
      })
    );

    const res = await statisticsApi.get();

    expect(res).toEqual(payload);
    expect(res.appointments.last_30_days).toBe(20);
    expect(res.popular_services[0].name).toBe("Haircut");
  });
});
