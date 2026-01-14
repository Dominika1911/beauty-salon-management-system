import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { MemoryRouter } from "react-router-dom";

import DashboardPage from "@/pages/DashboardPage";

describe("pages/DashboardPage – integracja UI z API (MSW)", () => {
  it("pokazuje widok klienta i pozwala odświeżyć dane", async () => {
    let call = 0;

    server.use(
      http.get("/api/dashboard/", () => {
        call += 1;
        return HttpResponse.json(
          {
            role: "CLIENT",
            upcoming_appointments: { count: call === 1 ? 0 : 1, appointments: [] },
            history: { total_completed: 2, recent: [] },
          },
          { status: 200 }
        );
      })
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Nadchodzące wizyty")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Odśwież" }));

    await waitFor(() => expect(call).toBe(2));
    expect(await screen.findByText("Dane odświeżone.")).toBeInTheDocument();
  });

  it("gdy API zwraca błąd, pokazuje komunikat", async () => {
    server.use(
      http.get("/api/dashboard/", () => {
        return HttpResponse.json({ detail: "Backend padł" }, { status: 500 });
      })
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Backend padł");
  });
});
