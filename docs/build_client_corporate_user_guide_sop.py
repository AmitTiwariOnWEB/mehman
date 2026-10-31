from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

from build_mehman_sop import (
    COLORS,
    OUT_DIR,
    add_bullets,
    add_figure,
    add_mobile_gallery,
    add_numbered,
    add_para,
    add_run,
    apply_styles,
    convert_asset,
    ensure_dirs,
    set_cell_shading,
    style_table,
)


DOCX_PATH = OUT_DIR / "Mehman_Client_Corporate_User_Guide_SOP.docx"


def add_cover(doc, logo, hero):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(logo), width=Inches(2.55))
    p.paragraph_format.space_after = Pt(10)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(title, "Mehman User Guide & SOP", bold=True, color=COLORS["navy"], size=24)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(
        subtitle,
        "Visitor management, guard operations, approvals, QR gatepasses, and admin dashboard use",
        color=COLORS["dark_blue"],
        size=12,
    )

    meta = doc.add_table(rows=4, cols=2)
    rows = [
        ("For", "Clients, corporate offices, admins, guards, and users"),
        ("Purpose", "Daily use and operating procedure"),
        ("System", "Mehman web dashboard and Android mobile app"),
        ("Version", "1.0"),
    ]
    for row, (label, value) in zip(meta.rows, rows):
        row.cells[0].text = label
        row.cells[1].text = value
    style_table(meta, header=False, widths=[1.75, 4.75])
    for row in meta.rows:
        set_cell_shading(row.cells[0], COLORS["light_gray"])
        for run in row.cells[0].paragraphs[0].runs:
            run.bold = True

    doc.add_paragraph()
    add_figure(doc, hero, "Figure 1: Mehman dashboard for live visitor and gate activity.", width=6.15)
    doc.add_page_break()


def add_quick_index(doc):
    doc.add_heading("Contents", level=1)
    add_bullets(
        doc,
        [
            "1. What Mehman is used for",
            "2. User roles in an organization",
            "3. First-time setup for client admins",
            "4. Admin dashboard usage guide",
            "5. Guard mobile app usage guide",
            "6. Corporate user / employee usage guide",
            "7. Standard visitor workflow",
            "8. QR gatepass and approval rules",
            "9. Reports, records, and audit usage",
            "10. APK download, installation, and updates",
            "11. Daily checklists and support process",
        ],
    )


def add_intro(doc):
    doc.add_heading("1. What Mehman Is Used For", level=1)
    add_para(
        doc,
        "Mehman is a digital visitor and gatepass management system for societies, corporate offices, commercial premises, and multi-branch organizations. It keeps visitor entry, approvals, QR passes, gate activity, and reports in one simple system.",
    )
    add_bullets(
        doc,
        [
            ("For organizations: ", "manage visitor entry, employee/office approvals, gate activity, staff movement, vehicles, and reporting."),
            ("For admins: ", "configure users, gates, offices/units, guards, approvals, security logs, and exports."),
            ("For guards: ", "create visitor entries, scan QR passes, verify approvals, log entry/exit, and report incidents."),
            ("For corporate users/employees: ", "approve visitors, create pre-approved QR passes, view visit history, and receive notifications."),
        ],
    )


def add_roles(doc):
    doc.add_heading("2. User Roles in an Organization", level=1)
    table = doc.add_table(rows=1, cols=4)
    for i, heading in enumerate(["Role", "Who uses it", "Main tasks", "Key responsibility"]):
        table.cell(0, i).text = heading
    rows = [
        (
            "Client / Corporate Admin",
            "Facility, HR, security head, operations manager",
            "Set up offices/units, users, guards, gates, reports, announcements, and approvals.",
            "Keep user and gate assignments updated.",
        ),
        (
            "Branch / Gate Admin",
            "Site security supervisor or branch manager",
            "Monitor gate activity, pending approvals, visitor logs, vehicle logs, and guard performance.",
            "Escalate unresolved approvals and incidents.",
        ),
        (
            "Security Guard",
            "Gate staff and security team",
            "Create visitor entries, scan QR passes, verify visitor identity, log check-in/check-out.",
            "Verify details at the gate and record every entry and exit.",
        ),
        (
            "Corporate User / Employee",
            "Employee, office owner, host, resident-equivalent user",
            "Approve/reject visitors, create QR passes, share pass with guest, view history.",
            "Approve only known visitors.",
        ),
        (
            "Super Admin",
            "Mehman / SaaS owner team",
            "Create client accounts, subscriptions, and top-level admin access.",
            "Used for platform administration, not daily gate work.",
        ),
    ]
    for row_data in rows:
        row = table.add_row()
        for i, value in enumerate(row_data):
            row.cells[i].text = value
    style_table(table, widths=[1.35, 1.75, 3.0, 2.05])


def add_client_setup(doc):
    doc.add_heading("3. First-Time Setup for Client Admins", level=1)
    add_para(
        doc,
        "Client admins complete the setup before daily use begins. This ensures every visitor request reaches the correct host and every gate action is recorded under the correct location.",
    )
    doc.add_heading("3.1 Organization Setup Steps", level=2)
    add_numbered(
        doc,
        [
            "Log in to the Mehman web dashboard with the admin account provided during onboarding.",
            "Open Society / Company Settings and confirm the organization name, admin name, email, and client type.",
            "Create or review branch and gate records under Gate Management.",
            "Create offices, units, flats, towers, blocks, or departments under People Management according to the organization structure.",
            "Create corporate user or resident-equivalent accounts for employees/hosts who will approve visitors.",
            "Create security guard accounts and assign each guard to the correct gate/branch.",
            "Share the app download link and login credentials only through approved organization communication channels.",
        ],
    )
    doc.add_heading("3.2 Setup Order", level=2)
    table = doc.add_table(rows=1, cols=3)
    for i, heading in enumerate(["Step", "Setup item", "Why it matters"]):
        table.cell(0, i).text = heading
    rows = [
        ("1", "Company / society profile", "Creates the correct client context for all users."),
        ("2", "Gates / branches", "Allows visitor records and guard actions to be tied to the right entry point."),
        ("3", "Offices / units / flats", "Allows guards to route visitor requests to the correct host."),
        ("4", "Corporate users / residents", "Gives hosts the ability to approve or reject visitors."),
        ("5", "Guard accounts", "Allows gate staff to create entries and scan QR passes."),
        ("6", "App rollout", "Ensures all users can log in and follow the same process."),
    ]
    for data in rows:
        row = table.add_row()
        for i, value in enumerate(data):
            row.cells[i].text = value
    style_table(table, widths=[0.7, 2.3, 4.3])


def add_admin_guide(doc, dashboard_img, admin_img):
    doc.add_heading("4. Admin Dashboard Usage Guide", level=1)
    add_figure(doc, dashboard_img, "Figure 2: Admin dashboard overview for monitoring visitor and gate activity.", width=6.2)
    doc.add_heading("4.1 How Admins Use the Dashboard", level=2)
    add_numbered(
        doc,
        [
            "Open the official Mehman dashboard link in a browser.",
            "Log in with the admin username and password.",
            "Review dashboard cards for total visitors, active inside, entries, exits, and trend data.",
            "Open Inbox & Approvals to review pending visitor approvals or operational alerts.",
            "Use Visitor Monitoring to check current visitor status, host, gate, and pass details.",
            "Use QR Pass Management to review pass codes, QR validity, and pass state.",
            "Use Search Records to find historical visitor, vehicle, and gate records.",
            "Use Export Reports to download visitor reports for management or audit records.",
        ],
    )
    doc.add_heading("4.2 Admin Menu Guide", level=2)
    table = doc.add_table(rows=1, cols=3)
    for i, heading in enumerate(["Menu", "Use this for", "Example"]):
        table.cell(0, i).text = heading
    rows = [
        ("Dashboard", "Live organization overview", "Check active visitors inside premises."),
        ("Inbox & Approvals", "Pending approvals and notifications", "Open visitor approval pending from an employee host."),
        ("People Management", "Employees, residents, offices, units", "Create a new office user account."),
        ("Guard Management", "Guard users and gate assignments", "Assign Guard A to Main Gate."),
        ("Visitor Monitoring", "Current and past visitor status", "Check whether a contractor has exited."),
        ("QR Pass Management", "QR pass details and validity", "Confirm pass code and active status."),
        ("Gate Management", "Branches and gates", "Add Service Gate or Tower B Gate."),
        ("Security Logs", "Entry/exit audit", "Review scan activity by guard and time."),
        ("Export Reports", "CSV reports", "Download monthly visitor report."),
    ]
    for data in rows:
        row = table.add_row()
        for i, value in enumerate(data):
            row.cells[i].text = value
    style_table(table, widths=[1.75, 2.8, 3.0])
    add_figure(doc, admin_img, "Figure 3: Admin mobile dashboard for quick operational overview.", width=2.05)


def add_guard_guide(doc, guard_img, qr_img):
    doc.add_heading("5. Guard Mobile App Usage Guide", level=1)
    add_mobile_gallery(doc, [("Guard dashboard", guard_img), ("QR scan screen", qr_img)])
    doc.add_heading("5.1 Guard Shift Start", level=2)
    add_numbered(
        doc,
        [
            "Open the Mehman app and log in with the guard account.",
            "Confirm the assigned gate or branch shown in the app.",
            "Check notifications and pending requests before starting visitor processing.",
            "Test that the phone camera is available for QR scanning and visitor photo capture.",
        ],
    )
    doc.add_heading("5.2 Creating a Visitor Entry", level=2)
    add_numbered(
        doc,
        [
            "Tap Visitor entry.",
            "Select the correct gate/branch if required.",
            "Select the office/unit/flat/host based on the visitor's destination.",
            "Enter visitor name, 10-digit mobile number, purpose, and validity time.",
            "Capture visitor photo or ID details if the organization requires it.",
            "Enter vehicle number if the visitor has a vehicle.",
            "Submit the entry so the host receives the approval request.",
            "Wait for approval before allowing entry unless the organization has a written exception process.",
        ],
    )
    doc.add_heading("5.3 Scanning a QR Gatepass", level=2)
    add_numbered(
        doc,
        [
            "Tap QR scan & check-in/out.",
            "Scan the QR shown by the visitor.",
            "Verify visitor name, host, pass status, validity, and gate details.",
            "If valid and approved, complete check-in.",
            "At exit, scan or update the same pass to complete check-out.",
        ],
    )
    doc.add_heading("5.4 Guard Rules", level=2)
    add_bullets(
        doc,
        [
            "Do not approve or reject visitors on behalf of corporate users or residents.",
            "Do not allow entry for expired, rejected, unknown, or mismatched passes.",
            "Do not share guard login credentials.",
            "Report suspicious visitors, invalid QR passes, and emergencies immediately.",
        ],
    )


def add_corporate_user_guide(doc, resident_img, inbox_img):
    doc.add_heading("6. Corporate User / Employee Usage Guide", level=1)
    add_mobile_gallery(doc, [("Corporate user dashboard", resident_img), ("Approval inbox", inbox_img)])
    add_para(
        doc,
        "Corporate users are visitor hosts. They approve or reject visitor requests and can create QR passes for expected guests.",
    )
    doc.add_heading("6.1 Approving a Visitor", level=2)
    add_numbered(
        doc,
        [
            "Open the Mehman app.",
            "Tap Visitor & delivery inbox or open the notification.",
            "Review visitor name, phone, purpose, gate, and any photo/ID details.",
            "Approve only if the visitor is expected and details are correct.",
            "Reject if the visitor is unknown, unexpected, or suspicious.",
            "Call the gate or admin if extra verification is needed.",
        ],
    )
    doc.add_heading("6.2 Creating a Pre-Approved QR Pass", level=2)
    add_numbered(
        doc,
        [
            "Tap Create gate pass.",
            "Choose pass type such as guest, visitor, delivery, or parcel.",
            "Enter visitor name, mobile number, purpose, and valid-until date/time.",
            "Generate the pass.",
            "Share the QR pass only with the intended visitor.",
            "Ask the visitor to show the QR at the gate for scanning.",
        ],
    )
    doc.add_heading("6.3 Corporate User Responsibilities", level=2)
    add_bullets(
        doc,
        [
            "Create passes only for expected visitors.",
            "Use short validity windows where possible.",
            "Do not forward QR passes to unrelated people.",
            "Reject unknown visitor requests immediately.",
            "Review visitor history if there is a dispute or missed notification.",
        ],
    )


def add_standard_workflow(doc):
    doc.add_heading("7. Standard Visitor Workflow", level=1)
    table = doc.add_table(rows=1, cols=4)
    for i, heading in enumerate(["Stage", "User", "Action", "System result"]):
        table.cell(0, i).text = heading
    rows = [
        ("1. Visitor arrives", "Guard", "Creates visitor entry or scans QR.", "Request or pass is opened in system."),
        ("2. Approval request", "Corporate user / employee", "Approves or rejects visitor.", "Approval state updates instantly."),
        ("3. Verification", "Guard", "Checks visitor details, ID/photo, host, validity, and gate.", "Only valid approved visitor proceeds."),
        ("4. Check-in", "Guard", "Records entry through scan or pass action.", "Entry time, gate, and guard are logged."),
        ("5. Visit monitoring", "Admin", "Monitors active inside visitors.", "Dashboard and logs remain updated."),
        ("6. Check-out", "Guard", "Records exit at the gate.", "Exit time is logged and pass is closed."),
    ]
    for data in rows:
        row = table.add_row()
        for i, value in enumerate(data):
            row.cells[i].text = value
    style_table(table, widths=[1.25, 1.55, 2.9, 2.1])


def add_rules(doc):
    doc.add_heading("8. QR Gatepass and Approval Rules", level=1)
    doc.add_heading("8.1 Allow Entry Only When", level=2)
    add_bullets(
        doc,
        [
            "Visitor details match the person at the gate.",
            "QR pass is valid and not expired.",
            "Host/employee approval is complete where required.",
            "Gate or branch details are correct.",
            "Vehicle details match when vehicle entry is included.",
        ],
    )
    doc.add_heading("8.2 Do Not Allow Entry When", level=2)
    add_bullets(
        doc,
        [
            "The pass is rejected, expired, invalid, or already used incorrectly.",
            "The visitor is unknown to the host.",
            "The visitor refuses identity verification.",
            "The visitor attempts to use someone else's QR pass.",
            "There is any safety concern or instruction from admin to hold the visitor.",
        ],
    )


def add_reporting(doc):
    doc.add_heading("9. Reports, Records, and Audit Usage", level=1)
    add_para(
        doc,
        "Mehman keeps searchable records for visitor activity, gatepass status, entry/exit logs, vehicle movement, and guard actions. These records help organizations review security activity and respond to audits or incidents.",
    )
    add_numbered(
        doc,
        [
            "Admins should review Dashboard and Security Logs daily.",
            "Use Search Records for visitor, phone, vehicle, host, gate, or date-based lookup.",
            "Use Export Reports to download CSV records for management review.",
            "Investigate active visitors who have not checked out by the end of the day or shift.",
            "Keep exported reports confidential and share only with authorized organization teams.",
        ],
    )


def add_apk(doc):
    doc.add_heading("10. APK Download, Installation, and Updates", level=1)
    add_para(
        doc,
        "Android users install Mehman from the official APK link shared by the organization.",
    )
    doc.add_heading("10.1 Official Download Link Format", level=2)
    add_bullets(
        doc,
        [
            "Hostinger path: public_html/apk/Mehman-v0.1.16.apk",
            "Public URL format: https://yourdomain.com/apk/Mehman-v0.1.16.apk",
            "Share only the official domain link with guards, admins, and corporate users.",
            "When a new version is released, update the link and communicate the version number.",
        ],
    )
    doc.add_heading("10.2 Installation Steps for Users", level=2)
    add_numbered(
        doc,
        [
            "Open the official APK link on the Android phone.",
            "Download the APK.",
            "Allow installation from the trusted browser/file manager if Android asks.",
            "Install the app.",
            "Open Mehman and log in.",
            "Confirm the correct role, organization, gate, branch, office, or unit is visible.",
        ],
    )


def add_checklists(doc):
    doc.add_heading("11. Daily Checklists and Support Process", level=1)
    doc.add_heading("11.1 Admin Daily Checklist", level=2)
    add_bullets(
        doc,
        [
            "Dashboard reviewed.",
            "Pending approvals checked.",
            "Active inside visitors reviewed.",
            "Security logs checked.",
            "Guard assignments verified.",
            "Reports exported if required.",
        ],
    )
    doc.add_heading("11.2 Guard Daily Checklist", level=2)
    add_bullets(
        doc,
        [
            "Logged in with own account.",
            "Correct gate selected.",
            "Camera and QR scanner working.",
            "Visitor entries completed with accurate details.",
            "All exits recorded before shift handover.",
            "Incidents or invalid passes reported.",
        ],
    )
    doc.add_heading("11.3 Corporate User Checklist", level=2)
    add_bullets(
        doc,
        [
            "Visitor requests reviewed promptly.",
            "Unknown visitors rejected.",
            "QR passes shared only with intended visitors.",
            "Visit history checked when needed.",
        ],
    )
    doc.add_heading("11.4 Support Escalation", level=2)
    table = doc.add_table(rows=1, cols=3)
    for i, heading in enumerate(["Issue", "First action", "Escalate to"]):
        table.cell(0, i).text = heading
    rows = [
        ("Cannot log in", "Check username/password and internet.", "Organization admin"),
        ("Wrong gate or office shown", "Stop processing and report mismatch.", "Admin / supervisor"),
        ("QR not scanning", "Check camera, lighting, and QR image.", "Supervisor / admin"),
        ("Unknown visitor", "Hold at gate and contact host.", "Admin / security head"),
        ("Emergency", "Use emergency process and call supervisor.", "Security head / management"),
    ]
    for data in rows:
        row = table.add_row()
        for i, value in enumerate(data):
            row.cells[i].text = value
    style_table(table, widths=[1.8, 3.0, 2.25])


def add_header_footer(doc):
    section = doc.sections[0]
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    add_run(header, "Mehman User Guide & SOP", bold=True, color=COLORS["muted"], size=8)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(footer, "Mehman Management System", color=COLORS["muted"], size=8)


def build():
    ensure_dirs()
    images = {
        "logo": convert_asset("mehman-logo.webp"),
        "dashboard": convert_asset("dashboard-hero.webp"),
        "admin": convert_asset("mobile-admin-dashboard.webp"),
        "resident": convert_asset("mobile-resident-dashboard.webp"),
        "guard": convert_asset("mobile-guard-dashboard.webp"),
        "inbox": convert_asset("mobile-feature-approval-inbox.webp"),
        "qr": convert_asset("mobile-feature-qr-scan.webp"),
    }

    doc = Document()
    apply_styles(doc)
    add_header_footer(doc)
    add_cover(doc, images["logo"], images["dashboard"])
    add_quick_index(doc)
    add_intro(doc)
    add_roles(doc)
    add_client_setup(doc)
    add_admin_guide(doc, images["dashboard"], images["admin"])
    add_guard_guide(doc, images["guard"], images["qr"])
    add_corporate_user_guide(doc, images["resident"], images["inbox"])
    add_standard_workflow(doc)
    add_rules(doc)
    add_reporting(doc)
    add_apk(doc)
    add_checklists(doc)

    doc.save(DOCX_PATH)
    print(DOCX_PATH)


if __name__ == "__main__":
    build()
