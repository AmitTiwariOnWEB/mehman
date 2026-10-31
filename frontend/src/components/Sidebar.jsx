import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  Car,
  Download,
  FileText,
  Gauge,
  Inbox,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  MessageSquare,
  QrCode,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Wallet,
  Truck,
  Users,
  Warehouse,
  Wrench,
  X
} from "lucide-react";
import { featureGroups, superAdminGroups } from "../lib/featureCatalog";
import { getClientTerms, getRoleLabel } from "../lib/clientTerminology";
import mehmanMark from "../assets/mehman-mark.webp";

const FEATURE_ICONS = {
  "Dashboard": Gauge,
  "Inbox & Approvals": Inbox,
  "People Management": Users,
  "Guard Management": Shield,
  "Household Records": Users,
  "Visitor Monitoring": Activity,
  "QR Pass Management": QrCode,
  "Gate Management": Warehouse,
  "Search Records": Search,
  "Security Logs": ShieldCheck,
  "Vehicle Monitoring": Truck,
  "Vehicle Database": Car,
  "Complaints & Feedback": MessageSquare,
  "Announcements": Bell,
  "Society Directory": Users,
  "Amenities Booking": CalendarCheck,
  "Maintenance Requests": Wrench,
  "Export Reports": Download,
  "Operations Console": Layers,
  "Society Settings": Settings,
  "SaaS Dashboard": BarChart3,
  "Onboard Client": KeyRound,
  "Subscriptions": Wallet,
  "Client Accounts": Building2,
  "Client Admins": Users
};

const getIcon = (label) => FEATURE_ICONS[label] || FileText;
const toKey = (groupKey, feature) => `${groupKey}::${encodeURIComponent(feature)}`;
const makeItems = (groups, groupKey) =>
  (groups[groupKey]?.features || []).map((f) => ({
    label: f,
    key: toKey(groupKey, f),
    Icon: getIcon(f)
  }));

const societyMenuSections = [
  { groupKey: "overview", title: featureGroups.overview.title, items: makeItems(featureGroups, "overview") },
  { groupKey: "security", title: featureGroups.security.title, items: makeItems(featureGroups, "security") },
  { groupKey: "people", title: featureGroups.people.title, items: makeItems(featureGroups, "people") },
  { groupKey: "services", title: featureGroups.services.title, items: makeItems(featureGroups, "services") },
  { groupKey: "reports", title: featureGroups.reports.title, items: makeItems(featureGroups, "reports") }
];

const superAdminMenuSections = [
  { groupKey: "saas", title: superAdminGroups.saas.title, items: makeItems(superAdminGroups, "saas") },
  { groupKey: "clients", title: superAdminGroups.clients.title, items: makeItems(superAdminGroups, "clients") }
];

const CORPORATE_HIDDEN_FEATURES = new Set(["Amenities Booking", "Voting System"]);

const societyAllItems = societyMenuSections.flatMap((s) => s.items);
const superAllItems = superAdminMenuSections.flatMap((s) => s.items);

export const defaultFeatureView = societyAllItems[0]?.key ?? "";
export const defaultSuperAdminView = superAllItems[0]?.key ?? "";

export const getMenuLabelByKey = (key) =>
  [...societyAllItems, ...superAllItems].find((i) => i.key === key)?.label ?? "Dashboard";

export function Sidebar({ activeView, onNavigate, onLogout, onChangePassword, user, isOpen, onClose }) {
  const role = user?.role;
  const sections = role === "SUPER_ADMIN" ? superAdminMenuSections : societyMenuSections;

  return (
    <>
      <aside className="glass hidden h-screen w-[17rem] shrink-0 flex-col overflow-y-auto lg:flex">
        <SidebarInner activeView={activeView} onNavigate={onNavigate} onLogout={onLogout} onChangePassword={onChangePassword} user={user} sections={sections} />
      </aside>

      <aside
        className={`glass fixed inset-y-0 left-0 z-30 flex w-[17rem] flex-col transition-transform duration-200 ease-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5">
          <Brand />
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>
        <SidebarInner activeView={activeView} onNavigate={onNavigate} onLogout={onLogout} onChangePassword={onChangePassword} user={user} sections={sections} hideBrand />
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-blue-500/10">
        <img src={mehmanMark} alt="Mehman logo" className="h-full w-full object-contain p-1" />
      </div>
      <div>
        <p className="text-[15px] font-bold leading-tight text-slate-900">Mehman</p>
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-600">Apka Swagat Hai</p>
      </div>
    </div>
  );
}

function SidebarInner({ activeView, onNavigate, onLogout, onChangePassword, user, sections, hideBrand = false }) {
  const terms = getClientTerms(user);
  const roleLabel = getRoleLabel(user?.role, user);
  const displayMenuLabel = (label) => {
    if (!terms.isCorporate) return label;
    return {
      "Household Records": terms.householdRecords,
      "Society Directory": "Corporate Directory",
      "Society Settings": "Corporate Settings"
    }[label] || label;
  };

  const initials = (user?.name || "A")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {!hideBrand && (
        <div className="border-b border-slate-200/80 px-4 py-4">
          <Brand />
          <p className="mt-1 pl-[50px] text-[11px] font-medium text-slate-500">{roleLabel}</p>
        </div>
      )}

      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {sections.map((section) => {
          const visibleItems = terms.isCorporate
            ? section.items.filter((item) => !CORPORATE_HIDDEN_FEATURES.has(item.label))
            : section.items;
          if (visibleItems.length === 0) return null;
          return (
          <div key={section.groupKey} className="mb-3.5">
            <p className="mb-1.5 px-3 text-[9.5px] font-black uppercase tracking-[0.14em] text-slate-400">
              {section.title}
            </p>
            {visibleItems.map(({ label, key, Icon }) => {
              const isActive = activeView === key;
              return (
                <button
                  key={key}
                  onClick={() => onNavigate(key)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] transition-all ${
                    isActive ? "nav-active" : "nav-inactive"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-blue-600" : "text-slate-400"} />
                  <span className="truncate font-semibold">{displayMenuLabel(label)}</span>
                </button>
              );
            })}
          </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/80 px-3 py-3 space-y-1.5">
        {onChangePassword && (
          <button
            onClick={onChangePassword}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <Lock size={14} className="text-slate-400" />
            Change Password
          </button>
        )}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <LogOut size={14} className="text-slate-400" />
          Sign out
        </button>
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-slate-900">{user?.name || "Admin"}</p>
            <p className="truncate text-[10.5px] text-slate-500">{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

