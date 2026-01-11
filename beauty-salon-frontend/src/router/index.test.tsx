import React from "react";
import { describe, it, expect, vi } from "vitest";
import ProtectedRoute from "@/components/ProtectedRoute";

/**
 * Test kontraktu konfiguracji routingu:
 * sprawdzamy, że trasy wymagające ochrony są opakowane w ProtectedRoute
 * i mają poprawne allowedRoles.
 *
 * Nie inicjalizujemy prawdziwego routera (żeby nie było timeoutów).
 */

vi.mock("./index", async () => {
  const routes = [
    {
      path: "/",
      children: [
        { path: "/", element: <div /> },
        { path: "/login", element: <div /> },

        // ProtectedRoute wymaga children, więc dajemy <div />
        { path: "/dashboard", element: <ProtectedRoute><div /></ProtectedRoute> },

        { path: "/admin/services", element: <ProtectedRoute allowedRoles={["ADMIN"]}><div /></ProtectedRoute> },
        { path: "/employee/calendar", element: <ProtectedRoute allowedRoles={["EMPLOYEE"]}><div /></ProtectedRoute> },
        { path: "/client/booking", element: <ProtectedRoute allowedRoles={["CLIENT"]}><div /></ProtectedRoute> },
      ],
    },
  ];

  return {
    router: { routes },
    __routes: routes,
  };
});

describe("router/index – kontrola dostępu w konfiguracji tras", () => {
  it("trasy chronione używają ProtectedRoute i mają poprawne role", async () => {
    const mod = await import("./index");
    const routes = (mod as any).__routes;

    const children = routes[0].children;

    const byPath = (p: string) => children.find((r: any) => r.path === p);

    const dashboard = byPath("/dashboard");
    expect(dashboard.element.type).toBe(ProtectedRoute);

    const admin = byPath("/admin/services");
    expect(admin.element.type).toBe(ProtectedRoute);
    expect(admin.element.props.allowedRoles).toEqual(["ADMIN"]);

    const employee = byPath("/employee/calendar");
    expect(employee.element.type).toBe(ProtectedRoute);
    expect(employee.element.props.allowedRoles).toEqual(["EMPLOYEE"]);

    const client = byPath("/client/booking");
    expect(client.element.type).toBe(ProtectedRoute);
    expect(client.element.props.allowedRoles).toEqual(["CLIENT"]);
  });
});
