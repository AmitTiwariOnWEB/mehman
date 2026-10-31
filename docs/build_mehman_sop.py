from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend" / "src" / "assets"
OUT_DIR = ROOT / "docs" / "generated"
IMG_DIR = OUT_DIR / "sop_images"
DOCX_PATH = OUT_DIR / "Mehman_Visitor_Gatepass_SOP.docx"


COLORS = {
    "navy": "0B2545",
    "blue": "2E74B5",
    "dark_blue": "1F4D78",
    "teal": "0F766E",
    "gold": "B1790A",
    "light_blue": "E8EEF5",
    "light_gray": "F2F4F7",
    "border": "D9E2EC",
    "muted": "667085",
    "white": "FFFFFF",
}


def ensure_dirs():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)


def convert_asset(name):
    source = ASSETS / name
    target = IMG_DIR / f"{Path(name).stem}.png"
    if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
        with Image.open(source) as img:
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA")
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            bg.alpha_composite(img.convert("RGBA"))
            bg.convert("RGB").save(target, "PNG", optimize=True)
    return target


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color="D9E2EC"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top=80, bottom=80, start=120, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = tc_pr.first_child_found_in("w:tcMar")
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tc_pr.append(mar)
    for m, v in {"top": top, "bottom": bottom, "start": start, "end": end}.items():
        tag = f"w:{m}"
        element = mar.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            mar.append(element)
        element.set(qn("w:w"), str(v))
        element.set(qn("w:type"), "dxa")


def set_table_width(table, width_dxa=9360):
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(width_dxa))
    tbl_w.set(qn("w:type"), "dxa")
    table.autofit = False


def style_table(table, header=True, widths=None):
    set_table_width(table)
    table.style = "Table Grid"
    for r, row in enumerate(table.rows):
        for c, cell in enumerate(row.cells):
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell)
            set_cell_border(cell)
            if header and r == 0:
                set_cell_shading(cell, COLORS["light_blue"])
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        run.font.bold = True
                        run.font.color.rgb = RGBColor.from_string(COLORS["navy"])
            if widths and c < len(widths):
                cell.width = Inches(widths[c])


def add_run(paragraph, text, bold=False, color=None, size=None):
    run = paragraph.add_run(text)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if size:
        run.font.size = Pt(size)
    return run


def add_para(doc, text="", style=None, bold_prefix=None):
    p = doc.add_paragraph(style=style)
    if bold_prefix and text.startswith(bold_prefix):
        add_run(p, bold_prefix, bold=True)
        add_run(p, text[len(bold_prefix):])
    else:
        p.add_run(text)
    return p


def add_bullets(doc, items):
    for item in items:
        if isinstance(item, tuple):
            p = doc.add_paragraph(style="List Bullet")
            add_run(p, item[0], bold=True)
            add_run(p, item[1])
        else:
            doc.add_paragraph(item, style="List Bullet")


def add_numbered(doc, items):
    for item in items:
        doc.add_paragraph(item, style="List Number")


def add_figure(doc, path, caption, width=6.1):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path), width=Inches(width))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(8)
    add_run(cap, caption, bold=True, color=COLORS["muted"], size=9)


def add_mobile_gallery(doc, figures):
    table = doc.add_table(rows=1, cols=len(figures))
    table.autofit = False
    for idx, (title, img_path) in enumerate(figures):
        cell = table.cell(0, idx)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
        set_cell_shading(cell, COLORS["white"])
        set_cell_border(cell, "FFFFFF")
        set_cell_margins(cell, top=40, bottom=40, start=40, end=40)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(img_path), width=Inches(1.78))
        cap = cell.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_run(cap, title, bold=True, color=COLORS["dark_blue"], size=9)


def apply_styles(doc):
    section = doc.sections[0]
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.85)
    section.right_margin = Inches(0.85)
    section.header_distance = Inches(0.45)
    section.footer_distance = Inches(0.45)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string("111827")
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.18

    for name, size, color, before, after in [
        ("Heading 1", 16, COLORS["blue"], 16, 8),
        ("Heading 2", 13, COLORS["blue"], 12, 6),
        ("Heading 3", 12, COLORS["dark_blue"], 8, 4),
    ]:
        style = styles[name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)

    for list_style in ("List Bullet", "List Number"):
        style = styles[list_style]
        style.font.name = "Calibri"
        style.font.size = Pt(10.5)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.line_spacing = 1.18


def add_header_footer(doc):
    section = doc.sections[0]
    header = section.header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_run(hp, "Mehman Visitor Gatepass SOP", bold=True, color=COLORS["muted"], size=8)

    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(fp, "Confidential operating guide | Paymaster Management Solutions Ltd", color=COLORS["muted"], size=8)


def add_cover(doc, logo, hero):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(logo), width=Inches(2.6))
    p.paragraph_format.space_after = Pt(12)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(title, "Standard Operating Procedure", bold=True, color=COLORS["navy"], size=25)
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(subtitle, "Mehman Visitor, Gatepass, Dashboard, and Mobile App Operations", color=COLORS["dark_blue"], size=13)

    meta = doc.add_table(rows=5, cols=2)
    data = [
        ("Document owner", "Operations / Admin Team"),
        ("Prepared for", "Society, corporate, security, and resident operations"),
        ("Version", "1.0"),
        ("Effective date", "June 2026"),
        ("System", "Mehman Management System"),
    ]
    for row, (k, v) in zip(meta.rows, data):
        row.cells[0].text = k
        row.cells[1].text = v
    style_table(meta, header=False, widths=[2.0, 4.2])
    for row in meta.rows:
        set_cell_shading(row.cells[0], COLORS["light_gray"])
        for run in row.cells[0].paragraphs[0].runs:
            run.bold = True

    doc.add_paragraph()
    add_figure(doc, hero, "Figure 1: Mehman web dashboard view used for administrative monitoring.", width=6.2)

    note = doc.add_table(rows=1, cols=1)
    cell = note.cell(0, 0)
    set_cell_shading(cell, "FFF8E6")
    set_cell_border(cell, "E5C46B")
    set_cell_margins(cell, 120, 120, 160, 160)
    cell.text = (
        "Use this SOP as the standard reference for daily gate operations, visitor approvals, QR pass validation, "
        "record keeping, report export, and APK update communication."
    )
    doc.add_page_break()


def add_toc_like_index(doc):
    doc.add_heading("Quick Index", level=1)
    entries = [
        "1. Purpose and operating scope",
        "2. Roles and responsibilities",
        "3. System access and account control",
        "4. Web dashboard SOP",
        "5. Mobile app SOP",
        "6. Visitor gatepass workflow",
        "7. Security exceptions and emergency handling",
        "8. Records, reporting, and audit trail",
        "9. APK download and update procedure",
        "10. Daily checklists",
    ]
    add_bullets(doc, entries)


def add_scope(doc):
    doc.add_heading("1. Purpose and Operating Scope", level=1)
    add_para(
        doc,
        "This SOP defines the standard process for using Mehman to manage visitors, QR gatepasses, gate security, resident approvals, vehicles, staff entry, service requests, and administrative reporting.",
    )
    add_bullets(
        doc,
        [
            ("Applies to: ", "super admins, society/company admins, security guards, residents, office users, and support staff."),
            ("Main objective: ", "replace paper gate registers with a controlled digital workflow from visitor request to entry, exit, and reporting."),
            ("Primary systems: ", "Mehman web dashboard for administrators and Mehman Android app for guards and residents."),
            ("Record principle: ", "every approval, QR scan, gate action, rejection, check-in, and check-out must remain searchable in the system."),
        ],
    )


def add_roles(doc):
    doc.add_heading("2. Roles and Responsibilities", level=1)
    table = doc.add_table(rows=1, cols=4)
    headers = ["Role", "Main access", "Responsibilities", "Restrictions"]
    for i, text in enumerate(headers):
        table.cell(0, i).text = text
    rows = [
        (
            "Super Admin",
            "SaaS dashboard",
            "Onboard clients, manage subscriptions, provision client admin accounts, support operations.",
            "Should not perform routine gate entries unless supporting an incident.",
        ),
        (
            "Society / Company Admin",
            "Web dashboard",
            "Manage users, gates, guards, residents/offices, approvals, visitor records, QR passes, reports, and settings.",
            "Must keep user accounts and gate assignments current.",
        ),
        (
            "Security Guard",
            "Mobile app / guard portal",
            "Create visitor entries, scan QR passes, log vehicle/delivery/staff movements, raise SOS/facility reports.",
            "Guards must not approve or reject resident visitors; approval belongs to the resident/office owner.",
        ),
        (
            "Resident / Office User",
            "Mobile app / resident portal",
            "Approve or reject visitors, pre-create gatepasses, share QR passes, submit requests, view history.",
            "Must not share login credentials or approve unknown visitors.",
        ),
    ]
    for row_data in rows:
        row = table.add_row()
        for i, text in enumerate(row_data):
            row.cells[i].text = text
    style_table(table, widths=[1.35, 1.35, 3.1, 2.0])


def add_access_control(doc):
    doc.add_heading("3. System Access and Account Control", level=1)
    doc.add_heading("3.1 Login Rules", level=2)
    add_numbered(
        doc,
        [
            "Open the Mehman dashboard or app using the official link shared by the admin team.",
            "Enter the assigned username and password only on the official Mehman login screen.",
            "After first login, verify that the correct role, company/society, and gate or unit details are visible.",
            "If access is incorrect, stop usage and report it to the society/company admin before processing visitors.",
        ],
    )
    doc.add_heading("3.2 Account Hygiene", level=2)
    add_bullets(
        doc,
        [
            "Create separate accounts for each admin, guard, and resident user.",
            "Deactivate users immediately when staff leave or residents move out.",
            "Assign guards only to their active gate or branch.",
            "Do not reuse shared passwords across shifts.",
        ],
    )


def add_dashboard_sop(doc, dashboard_img, admin_img):
    doc.add_heading("4. Web Dashboard SOP", level=1)
    add_figure(doc, dashboard_img, "Figure 2: Administrative web dashboard with live gatepass and visitor monitoring.", width=6.25)
    doc.add_heading("4.1 Daily Admin Dashboard Review", level=2)
    add_numbered(
        doc,
        [
            "Log in as Society Admin, Company Admin, or Super Admin based on assigned role.",
            "Review dashboard cards for total visitors, active inside, entries, exits, and live trends.",
            "Open Inbox & Approvals and clear pending visitor, operation, and emergency notifications.",
            "Check Visitor Monitoring for visitors awaiting approval, active entries, and overdue exits.",
            "Review Security Logs for recent gate actions and unusual activity.",
            "Export reports if daily, weekly, or monthly records are required.",
        ],
    )
    doc.add_heading("4.2 Admin Feature Map", level=2)
    table = doc.add_table(rows=1, cols=3)
    for i, text in enumerate(["Area", "Feature", "Standard use"]):
        table.cell(0, i).text = text
    rows = [
        ("Overview", "Dashboard", "Monitor live visitor, entry, exit, and gate activity."),
        ("Overview", "Inbox & Approvals", "Review pending approvals, notifications, and operational requests."),
        ("People", "People Management", "Create resident or office users and maintain units."),
        ("People", "Guard Management", "Create guard users and assign gates."),
        ("Security", "Visitor Monitoring", "Track visitor details, pass status, and host details."),
        ("Security", "QR Pass Management", "Review gatepasses, QR status, validity, and pass codes."),
        ("Security", "Gate Management", "Maintain gate/branch setup and assignments."),
        ("Security", "Search Records", "Find historical visitor, vehicle, and entry records."),
        ("Security", "Security Logs", "Audit check-in/check-out events and guard activity."),
        ("Reports", "Export Reports", "Download visitor records in CSV format for management review."),
    ]
    for data in rows:
        row = table.add_row()
        for i, text in enumerate(data):
            row.cells[i].text = text
    style_table(table, widths=[1.35, 2.0, 4.25])

    add_figure(doc, admin_img, "Figure 3: Mobile admin dashboard view for operational awareness.", width=2.05)


def add_mobile_sop(doc, resident_img, guard_img, inbox_img, qr_img):
    doc.add_heading("5. Mobile App SOP", level=1)
    add_mobile_gallery(
        doc,
        [
            ("Resident dashboard", resident_img),
            ("Guard dashboard", guard_img),
            ("Approval inbox", inbox_img),
        ],
    )
    doc.add_heading("5.1 Guard App Procedure", level=2)
    add_numbered(
        doc,
        [
            "Start each shift by logging in and confirming the assigned gate/branch.",
            "Use Visitor entry for new walk-in visitors and enter name, 10-digit mobile number, purpose, host/unit, validity, ID details, photo, and vehicle number if applicable.",
            "Use QR scan & check-in/out when a visitor presents a QR gatepass.",
            "Verify the visitor identity, host/unit, pass validity, and current approval status before allowing entry.",
            "For delivery, staff, temporary pass, and vehicle flows, use the matching feature instead of a generic visitor record.",
            "For emergencies, use Emergency SOS or Facility report and inform the supervisor immediately.",
            "At exit, scan or update the pass so the record is closed.",
        ],
    )
    doc.add_heading("5.2 Resident / Office User Procedure", level=2)
    add_numbered(
        doc,
        [
            "Open Visitor & delivery inbox to review pending visitor requests from the gate.",
            "Approve only known visitors and reject unknown or suspicious requests.",
            "Use Create gate pass to pre-create guest, visitor, delivery, or parcel passes.",
            "Share the QR pass only with the intended visitor and only for the required visit window.",
            "Review visitor history and entry/exit history to confirm completed visits.",
            "Use maintenance, complaint, announcements, directory, vehicle, and staff ID features as required by the society/company.",
        ],
    )
    add_figure(doc, qr_img, "Figure 4: QR scan and validation screen used by guards at the gate.", width=2.0)


def add_workflow(doc):
    doc.add_heading("6. Visitor Gatepass Workflow", level=1)
    doc.add_heading("6.1 Standard Visitor Entry", level=2)
    add_numbered(
        doc,
        [
            "Visitor arrives at the gate or resident pre-creates a pass.",
            "Guard enters visitor information or scans the visitor QR pass.",
            "System sends the request to the resident/office owner if approval is required.",
            "Resident/office owner approves or rejects the visitor from the mobile inbox.",
            "Guard verifies approval, identity, pass validity, and gate assignment.",
            "Guard checks visitor in; system records entry time, gate, guard, and pass status.",
            "On exit, guard scans or updates the pass; system records exit time and closes the visit.",
        ],
    )
    doc.add_heading("6.2 Validation Rules", level=2)
    add_bullets(
        doc,
        [
            "Mobile number must be exactly 10 digits.",
            "Vehicle number should follow the expected format, for example MH03AL5423.",
            "Visitor photo or ID proof should be captured where required by local policy.",
            "Expired, rejected, invalid, or mismatched QR passes must not be accepted.",
            "Every manual override must be escalated to the admin or supervisor.",
        ],
    )
    doc.add_heading("6.3 Do Not Allow Entry When", level=2)
    add_bullets(
        doc,
        [
            "The resident/office owner rejects the visitor.",
            "The QR pass is expired, unreadable, duplicated, or does not match the visitor.",
            "The visitor refuses required identity checks.",
            "The visitor vehicle number does not match the pass or declared information.",
            "The guard is unsure about approval status or host identity.",
        ],
    )


def add_exceptions(doc):
    doc.add_heading("7. Security Exceptions and Emergency Handling", level=1)
    table = doc.add_table(rows=1, cols=3)
    for i, text in enumerate(["Situation", "Immediate action", "Record required"]):
        table.cell(0, i).text = text
    rows = [
        ("Unknown visitor", "Hold at gate and contact host/admin.", "Visitor request marked pending or rejected."),
        ("Invalid QR", "Do not allow entry. Ask resident/admin to generate a fresh pass.", "Security log or supervisor note."),
        ("Emergency/SOS", "Use SOS flow, call supervisor, and follow site emergency protocol.", "Emergency operation record."),
        ("System unavailable", "Use approved manual fallback register, then upload/update records after service returns.", "Manual entry with time, guard, visitor, host, and reason."),
        ("Overdue exit", "Contact guard/admin and verify visitor location.", "Exit update or incident note."),
    ]
    for data in rows:
        row = table.add_row()
        for i, text in enumerate(data):
            row.cells[i].text = text
    style_table(table, widths=[1.65, 3.1, 2.3])


def add_records(doc):
    doc.add_heading("8. Records, Reporting, and Audit Trail", level=1)
    add_bullets(
        doc,
        [
            "Visitor records must include name, phone, purpose, host/unit, gate, pass status, and timestamps.",
            "Vehicle records must include vehicle number, visitor, gate, pass code/status, and date.",
            "Security logs should show action, visitor, gate, guard, and time.",
            "CSV exports should be generated from Export Reports when management requests a record copy.",
            "Admins should review pending approvals and overdue exits at least once per shift.",
        ],
    )
    doc.add_heading("8.1 Minimum Daily Audit", level=2)
    add_numbered(
        doc,
        [
            "Check active inside count against gate supervisor feedback.",
            "Clear or escalate all pending approvals older than the local SLA.",
            "Review rejected and invalid QR events.",
            "Export visitor report if required by society/company policy.",
            "Confirm all shift guards are assigned to the correct gate.",
        ],
    )


def add_apk(doc):
    doc.add_heading("9. APK Download and Update Procedure", level=1)
    add_para(
        doc,
        "The Android APK should be hosted in the public website file manager so guards, residents, or staff can download the latest approved build from a direct link.",
    )
    doc.add_heading("9.1 Hosting Path", level=2)
    add_bullets(
        doc,
        [
            "Upload the APK inside public_html/apk in Hostinger File Manager.",
            "Current filename shown in the deployment screenshot: Mehman-v0.1.16.apk.",
            "Direct link format: https://yourdomain.com/apk/Mehman-v0.1.16.apk",
            "When releasing a new APK, update the filename in all user-facing messages and keep only approved builds public.",
        ],
    )
    doc.add_heading("9.2 User Update Steps", level=2)
    add_numbered(
        doc,
        [
            "Open the APK download link from the official society/company communication channel.",
            "Download the APK on the Android phone.",
            "If Android asks for permission, allow installation from the trusted browser/file manager only for this install.",
            "Install or update Mehman.",
            "Open the app and verify login, role, gate/unit assignment, and live notifications.",
            "After installation, avoid downloading APKs from unofficial links.",
        ],
    )


def add_checklists(doc):
    doc.add_heading("10. Daily Checklists", level=1)
    doc.add_heading("10.1 Guard Shift Start", level=2)
    add_bullets(
        doc,
        [
            "Login successful.",
            "Correct gate/branch visible.",
            "QR scanner/camera working.",
            "Pending approval queue checked.",
            "Supervisor contact available.",
        ],
    )
    doc.add_heading("10.2 Guard Shift End", level=2)
    add_bullets(
        doc,
        [
            "All exit records updated.",
            "Pending visitors handed over to next shift.",
            "Invalid QR or incidents reported.",
            "Manual fallback entries reconciled.",
        ],
    )
    doc.add_heading("10.3 Admin Daily Review", level=2)
    add_bullets(
        doc,
        [
            "Dashboard metrics reviewed.",
            "Inbox and overdue approvals cleared.",
            "Security logs checked.",
            "New residents/guards/gates updated.",
            "Reports exported if required.",
        ],
    )


def build():
    ensure_dirs()
    images = {
        "logo": convert_asset("mehman-logo.webp"),
        "hero": convert_asset("dashboard-hero.webp"),
        "admin": convert_asset("mobile-admin-dashboard.webp"),
        "resident": convert_asset("mobile-resident-dashboard.webp"),
        "guard": convert_asset("mobile-guard-dashboard.webp"),
        "inbox": convert_asset("mobile-feature-approval-inbox.webp"),
        "qr": convert_asset("mobile-feature-qr-scan.webp"),
    }

    doc = Document()
    apply_styles(doc)
    add_header_footer(doc)
    add_cover(doc, images["logo"], images["hero"])
    add_toc_like_index(doc)
    add_scope(doc)
    add_roles(doc)
    add_access_control(doc)
    add_dashboard_sop(doc, images["hero"], images["admin"])
    add_mobile_sop(doc, images["resident"], images["guard"], images["inbox"], images["qr"])
    add_workflow(doc)
    add_exceptions(doc)
    add_records(doc)
    add_apk(doc)
    add_checklists(doc)

    doc.save(DOCX_PATH)
    print(DOCX_PATH)


if __name__ == "__main__":
    build()
