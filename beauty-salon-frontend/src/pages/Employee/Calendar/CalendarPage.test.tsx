import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EmployeeCalendarPage from "./CalendarPage";
import type { Appointment } from "@/types";
import { appointmentsApi } from "@/api/appointments";

const getMyMock = vi.mocked(appointmentsApi.getMy);
const confirmMock = vi.mocked(appointmentsApi.confirm);

// Mock FullCalendar wrapper: renderujemy eventy jako przyciski z tytułem
vi.mock("./components/CalendarView", () => {
  return {
    CalendarView: ({
      events,
      onEventClick,
    }: {
      events: any[];
      onEventClick: (info: any) => void;
    }) => {
      return (
        <div>
          <div>__CALENDAR_VIEW__</div>
          {events.map((ev) => (
            <button
              key={String(ev.id)}
              type="button"
              onClick={() =>
                onEventClick({
                  event: { extendedProps: ev.extendedProps },
                })
              }
            >
              {String(ev.title)}
            </button>
          ))}
        </div>
      );
    },
  };
});

vi.mock("@/api/appointments", () => {
  return {
    appointmentsApi: {
      getMy: vi.fn(),
      confirm: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn(),
      noShow: vi.fn(),
    },
  };
});

function apptBase(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    client: 10,
    client_name: "Anna Kowalska",
    employee: 20,
    employee_name: "Jan Nowak",
    service: 30,
    service_name: "Manicure",
    service_price: "100.00",
    start: "2026-01-10T10:00:00",
    end: "2026-01-10T11:00:00",
    status: "PENDING",
    status_display: "",
    can_confirm: true,
    can_cancel: true,
    can_complete: true,
    can_no_show: true,
    internal_notes: "",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function withFrozenTime<T>(iso: string, fn: () => Promise<T> | T): Promise<T> | T {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  try {
    return fn();
  } finally {
    vi.useRealTimers();
  }
}

describe("pages/Employee/Calendar/CalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "ładuje terminarz przez paginację getMy({page}) i mapuje event title (client fallback: 'Klient')",
    () =>
      withFrozenTime("2026-01-11T12:00:00", async () => {
        getMyMock
          .mockResolvedValueOnce({
            count: 2,
            next: "next",
            previous: null,
            results: [apptBase({ id: 1, client_name: null, service_name: "Strzyżenie" })],
          })
          .mockResolvedValueOnce({
            count: 2,
            next: null,
            previous: "prev",
            results: [apptBase({ id: 2, client_name: "Ewa", service_name: "Koloryzacja" })],
          });

        render(<EmployeeCalendarPage />);

        expect(await screen.findByText("__CALENDAR_VIEW__")).toBeInTheDocument();

        expect(appointmentsApi.getMy).toHaveBeenCalledWith({ page: 1 });
        expect(appointmentsApi.getMy).toHaveBeenCalledWith({ page: 2 });

        expect(screen.getByRole("button", { name: "Strzyżenie • Klient" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Koloryzacja • Ewa" })).toBeInTheDocument();

        expect(screen.getByText("Mój terminarz")).toBeInTheDocument();

        expect(screen.getByText("Legenda statusów")).toBeInTheDocument();
        expect(screen.getByText("Potwierdzona")).toBeInTheDocument();
        expect(screen.getByText("Oczekująca")).toBeInTheDocument();
        expect(screen.getByText("Zakończona")).toBeInTheDocument();
        expect(screen.getByText("Anulowana")).toBeInTheDocument();
        expect(screen.getByText("No-show")).toBeInTheDocument();
      }),
  );

  it(
    "klik eventu otwiera dialog 'Szczegóły wizyty' i pokazuje przyciski akcji wg flag can_*",
    () =>
      withFrozenTime("2026-01-11T12:00:00", async () => {
        getMyMock.mockResolvedValueOnce({
          count: 1,
          next: null,
          previous: null,
          results: [
            apptBase({
              id: 1,
              service_name: "Manicure",
              client_name: null, // fallback w dialogu: 'Klient'
              can_confirm: true,
              can_complete: false,
              can_cancel: true,
              can_no_show: false,
            }),
          ],
        });

        render(<EmployeeCalendarPage />);

        const eventBtn = await screen.findByRole("button", { name: "Manicure • Klient" });
        await userEvent.setup().click(eventBtn);

        expect(await screen.findByText("Szczegóły wizyty")).toBeInTheDocument();

        // zawężamy asercje do samego dialogu, żeby uniknąć konfliktów z innymi elementami
        const dialog = screen.getByRole("dialog");
        const d = within(dialog);

        expect(d.getByText("Usługa")).toBeInTheDocument();
        expect(d.getByText("Manicure")).toBeInTheDocument();

        // "Klient" występuje jako label i jako fallback value -> co najmniej 2 wystąpienia
        const klientOccurrences = d.getAllByText("Klient");
        expect(klientOccurrences.length).toBeGreaterThanOrEqual(2);

        // akcje zależne od can_*
        expect(d.getByRole("button", { name: "Potwierdź" })).toBeEnabled();
        expect(d.queryByRole("button", { name: "Zakończ" })).toBeNull();
        expect(d.getByRole("button", { name: "Anuluj" })).toBeEnabled();
        expect(d.queryByRole("button", { name: "No-show" })).toBeNull();

        expect(d.getByRole("button", { name: "Zamknij" })).toBeEnabled();
      }),
  );

  it(
    "akcja 'Potwierdź' woła appointmentsApi.confirm(id), zamyka dialog i pokazuje snackbar sukcesu",
    () =>
      withFrozenTime("2026-01-11T12:00:00", async () => {
        getMyMock.mockResolvedValueOnce({
          count: 1,
          next: null,
          previous: null,
          results: [apptBase({ id: 7, service_name: "Manicure", client_name: "Ewa" })],
        });

        confirmMock.mockResolvedValueOnce(
          apptBase({
            id: 7,
            status: "CONFIRMED",
            service_name: "Manicure (potwierdzone)",
            client_name: "Ewa",
            can_confirm: false,
          }),
        );

        render(<EmployeeCalendarPage />);
        const user = userEvent.setup();

        await user.click(await screen.findByRole("button", { name: "Manicure • Ewa" }));
        expect(await screen.findByText("Szczegóły wizyty")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Potwierdź" }));

        expect(appointmentsApi.confirm).toHaveBeenCalledTimes(1);
        expect(appointmentsApi.confirm).toHaveBeenCalledWith(7);

        expect(await screen.findByText("Wizyta potwierdzona.")).toBeInTheDocument();

        await waitFor(() => {
          expect(screen.queryByText("Szczegóły wizyty")).toBeNull();
        });

        expect(
          await screen.findByRole("button", { name: "Manicure (potwierdzone) • Ewa" }),
        ).toBeInTheDocument();
      }),
  );

  it(
    "gdy akcja zwróci błąd (detail) -> pokazuje pageError w dialogu i NIE zamyka modala",
    () =>
      withFrozenTime("2026-01-11T12:00:00", async () => {
        getMyMock.mockResolvedValueOnce({
          count: 1,
          next: null,
          previous: null,
          results: [apptBase({ id: 5, service_name: "Koloryzacja", client_name: "Anna" })],
        });

        confirmMock.mockRejectedValueOnce({
          response: { data: { detail: "Błąd akcji." } },
        });

        render(<EmployeeCalendarPage />);
        const user = userEvent.setup();

        await user.click(await screen.findByRole("button", { name: "Koloryzacja • Anna" }));
        expect(await screen.findByText("Szczegóły wizyty")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Potwierdź" }));

        expect(await screen.findByText("Błąd akcji.")).toBeInTheDocument();
        expect(screen.getByText("Szczegóły wizyty")).toBeInTheDocument();
      }),
  );

  it(
    "gdy pobieranie terminarza się nie uda -> pokazuje Alert z pageError i czyści eventy",
    () =>
      withFrozenTime("2026-01-11T12:00:00", async () => {
        getMyMock.mockRejectedValueOnce({
          response: { data: { detail: "Nie działa API." } },
        });

        render(<EmployeeCalendarPage />);

        expect(await screen.findByText("Nie działa API.")).toBeInTheDocument();

        expect(await screen.findByText("__CALENDAR_VIEW__")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /•/ })).toBeNull();
      }),
  );
});
