from __future__ import annotations

import os
from datetime import date
from io import BytesIO
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _register_pl_font() -> str:
    """
    Register a TTF font with Polish characters.
    Returns the font name to use in styles.

    Requires system font package (e.g., Debian/Ubuntu: fonts-dejavu-core).
    """
    font_name = "DejaVuSans"
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Debian/Ubuntu
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",           # alt
    ]

    for path in candidates:
        if os.path.exists(path):
            try:
                # Register only once (ReportLab will throw if you re-register sometimes)
                if font_name not in pdfmetrics.getRegisteredFontNames():
                    pdfmetrics.registerFont(TTFont(font_name, path))
                return font_name
            except Exception:
                # If registration fails for some reason, continue to fallback
                break

    # Fallback (may not render Polish diacritics)
    return "Helvetica"


def _safe_str(v: Any) -> str:
    return "-" if v is None else str(v)


def _safe_money_pln(v: Any) -> str:
    """Minimal, stable PLN formatting on backend."""
    if v is None:
        return "0.00 PLN"
    try:
        from decimal import Decimal

        d = Decimal(str(v)).quantize(Decimal("0.01"))
        return f"{d} PLN"
    except Exception:
        return f"{v} PLN"


def _take(items: Any, limit: int = 10) -> List[dict]:
    if isinstance(items, list):
        return items[:limit]
    return []


def _service_name(service_obj: Any) -> str:
    if isinstance(service_obj, dict):
        return _safe_str(service_obj.get("name") or service_obj.get("title") or service_obj.get("service_name"))
    return _safe_str(service_obj)


def _employee_name(emp_obj: Any) -> str:
    if isinstance(emp_obj, dict):
        full = emp_obj.get("full_name")
        if full:
            return _safe_str(full)
        fn = emp_obj.get("first_name") or ""
        ln = emp_obj.get("last_name") or ""
        name = (str(fn) + " " + str(ln)).strip()
        return name or _safe_str(emp_obj.get("email") or emp_obj.get("id"))
    return _safe_str(emp_obj)


def render_statistics_pdf(
    *,
    stats: Dict[str, Any],
    date_from: date,
    date_to: date,
    generated_by: str,
    days: int,
    salon_name: str = "Beauty Salon Management System",
) -> bytes:
    """Generate statistics PDF bytes using ReportLab (with PL characters support)."""
    base_font = _register_pl_font()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Raport statystyk ({days} dni)",
    )

    styles = getSampleStyleSheet()
    h1 = styles["Heading1"]
    h2 = styles["Heading2"]
    normal = styles["BodyText"]

    # Ensure paragraphs also use the unicode-capable font
    for st in (h1, h2, normal):
        st.fontName = base_font

    elements: List[Any] = []

    elements.append(Paragraph(salon_name, h1))
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph(f"Raport statystyk (ostatnie {days} dni)", h2))
    elements.append(Paragraph(f"Okres: {_safe_str(date_from)} – {_safe_str(date_to)}", normal))
    elements.append(Paragraph(f"Wygenerował: {_safe_str(generated_by)}", normal))
    elements.append(Spacer(1, 8 * mm))

    summary = stats.get("summary") or {}
    elements.append(Paragraph("Podsumowanie", h2))

    summary_rows = [
        ["Klienci (łącznie)", _safe_str(summary.get("total_clients"))],
        ["Nowi klienci", _safe_str(summary.get("new_clients"))],
        ["Wizyty (łącznie)", _safe_str(summary.get("total_appointments"))],
        ["Zakończone", _safe_str(summary.get("completed_appointments"))],
        ["Anulowane", _safe_str(summary.get("cancelled_appointments"))],
        ["Nieobecności", _safe_str(summary.get("no_show_appointments"))],
        ["Przychód", _safe_money_pln(summary.get("total_revenue"))],
    ]

    t = Table(summary_rows, colWidths=[75 * mm, 85 * mm])
    t.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("FONTNAME", (0, 0), (-1, -1), base_font),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ]
        )
    )
    elements.append(t)
    elements.append(Spacer(1, 10 * mm))

    services = _take(stats.get("services"), 10)
    elements.append(Paragraph("Top usługi", h2))

    if services:
        rows = [["Usługa", "Wizyty", "Przychód"]]
        for it in services:
            rows.append(
                [
                    _service_name(it.get("service")),
                    _safe_str(it.get("total_appointments")),
                    _safe_money_pln(it.get("total_revenue")),
                ]
            )
        tbl = Table(rows, colWidths=[90 * mm, 30 * mm, 40 * mm])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("FONTNAME", (0, 0), (-1, -1), base_font),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(tbl)
    else:
        elements.append(Paragraph("Brak danych.", normal))

    elements.append(Spacer(1, 10 * mm))

    employees = _take(stats.get("employees"), 10)
    elements.append(Paragraph("Pracownicy", h2))

    if employees:
        rows = [["Pracownik", "Wizyty", "Przychód", "Obłożenie"]]
        for it in employees:
            rows.append(
                [
                    _employee_name(it.get("employee")),
                    _safe_str(it.get("total_appointments")),
                    _safe_money_pln(it.get("total_revenue")),
                    _safe_str(it.get("occupancy_percent")),
                ]
            )
        tbl = Table(rows, colWidths=[70 * mm, 25 * mm, 35 * mm, 30 * mm])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("FONTNAME", (0, 0), (-1, -1), base_font),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(tbl)
    else:
        elements.append(Paragraph("Brak danych.", normal))

    doc.build(elements)
    return buffer.getvalue()
