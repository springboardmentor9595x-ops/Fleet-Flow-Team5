import io
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_pdf_report(report_data: dict) -> bytes:
    buffer = io.BytesIO()

    # Document setup: Letter size with 0.5 inch (36pt) margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=HexColor("#0B0E1A"),
        alignment=0,
        spaceAfter=6,
    )

    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=HexColor("#64748B"),
        spaceAfter=12,
    )

    section_heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=HexColor("#0F172A"),
        spaceBefore=10,
        spaceAfter=6,
    )

    summary_label_style = ParagraphStyle(
        "SummaryLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=HexColor("#334155"),
    )

    summary_val_style = ParagraphStyle(
        "SummaryVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=HexColor("#0F172A"),
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=0,
    )

    table_body_style = ParagraphStyle(
        "TableBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=HexColor("#1E293B"),
    )

    story = []

    # 1. Header & Metadata
    title = report_data.get("title", "FleetFlow Report")
    generated_at = report_data.get("generated_at", "")
    period = report_data.get("period", {})
    start_date = period.get("start_date", "All Time")
    end_date = period.get("end_date", "Present")

    story.append(Paragraph(title, title_style))
    story.append(
        Paragraph(
            f"Generated: {generated_at} &nbsp;|&nbsp; Period: {start_date} to {end_date}",
            subtitle_style,
        )
    )

    # 2. Key Metrics Summary Grid (2 columns of key-value pairs)
    summary_items = report_data.get("summary", [])
    if summary_items:
        story.append(Paragraph("Executive Summary", section_heading_style))
        summary_table_data = []
        
        # Group summary items into rows of 2 pairs
        for i in range(0, len(summary_items), 2):
            item1 = summary_items[i]
            item2 = summary_items[i + 1] if i + 1 < len(summary_items) else None
            
            cell1 = [
                Paragraph(item1["label"], summary_label_style),
                Paragraph(str(item1["value"]), summary_val_style),
            ]
            
            cell2 = [
                Paragraph(item2["label"], summary_label_style),
                Paragraph(str(item2["value"]), summary_val_style),
            ] if item2 else ["", ""]
            
            summary_table_data.append([cell1[0], cell1[1], cell2[0], cell2[1]])

        sum_table = Table(summary_table_data, colWidths=[130, 140, 130, 140])
        sum_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
                ("PADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
            ])
        )
        story.append(sum_table)
        story.append(Spacer(1, 14))

    # 3. Detailed Data Table
    columns = report_data.get("columns", [])
    rows = report_data.get("rows", [])

    if columns and rows:
        story.append(Paragraph("Detailed Records", section_heading_style))

        # Format header cells
        headers = [Paragraph(col, table_header_style) for col in columns]
        table_data = [headers]

        # Format row cells
        for row in rows:
            formatted_row = [Paragraph(str(cell), table_body_style) for cell in row]
            table_data.append(formatted_row)

        # Compute column widths dynamically to fit letter page printable width (540pt)
        num_cols = len(columns)
        col_width = 540.0 / num_cols if num_cols > 0 else 100

        data_table = Table(table_data, colWidths=[col_width] * num_cols, repeatRows=1)
        
        t_style = [
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1E293B")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ]

        # Alternating background colors
        for idx in range(1, len(table_data)):
            bg = HexColor("#F8FAFC") if idx % 2 == 1 else HexColor("#FFFFFF")
            t_style.append(("BACKGROUND", (0, idx), (-1, idx), bg))

        data_table.setStyle(TableStyle(t_style))
        story.append(data_table)
    elif columns and not rows:
        story.append(Paragraph("No records found for the selected filter period.", subtitle_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
