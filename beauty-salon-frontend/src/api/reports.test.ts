import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { reportsApi } from "@/api/reports";
import type { ReportType } from "@/types";

describe("api/reports – kontrakt i download PDF (MSW)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list(): zwraca listę dostępnych raportów (AvailableReport)", async () => {
    server.use(
      http.get("/api/reports/", () => {
        return HttpResponse.json(
          {
            available_reports: [
              { type: "operations", description: "Operations report" },
              { type: "revenue-analysis", description: "Revenue report" },
            ],
          },
          { status: 200 }
        );
      })
    );

    const res = await reportsApi.list();

    expect(res.available_reports).toHaveLength(2);
    expect(res.available_reports[0]).toEqual({
      type: "operations",
      description: "Operations report",
    });
  });

  it("downloadPdf(): pobiera blob, tworzy link do pobrania i sprząta URL", async () => {
    const type: ReportType = "operations";

    server.use(
      http.get(`/api/reports/${type}/pdf/`, () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        return HttpResponse.arrayBuffer(bytes.buffer, {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      })
    );

    if (!(window.URL as any).createObjectURL) {
      (window.URL as any).createObjectURL = () => "blob:mock-url";
    }
    if (!(window.URL as any).revokeObjectURL) {
      (window.URL as any).revokeObjectURL = () => undefined;
    }

    const createObjectURLSpy = vi
      .spyOn(window.URL as any, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeObjectURLSpy = vi
      .spyOn(window.URL as any, "revokeObjectURL")
      .mockImplementation(() => {});

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const removeSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "remove")
      .mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, "appendChild");

    const originalCreateElement = document.createElement.bind(document);
    let createdAnchor: HTMLAnchorElement | null = null;

    vi.spyOn(document, "createElement").mockImplementation((tagName: any) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") createdAnchor = el as HTMLAnchorElement;
      return el;
    });

    await reportsApi.downloadPdf(type);

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");

    expect(createdAnchor).not.toBeNull();
    expect(createdAnchor!.href).toBe("blob:mock-url");
    expect(createdAnchor!.download).toBe(`report-${type}.pdf`);
  });
});
