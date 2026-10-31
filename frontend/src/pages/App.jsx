import { useEffect, useState } from "react";
import { SESSION_STORAGE_KEY, societyApi } from "../lib/api";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { lazy, Suspense, useRef } from "react";
import { Sidebar, defaultFeatureView, defaultSuperAdminView, getMenuLabelByKey } from "../components/Sidebar";
import { SubscriptionNotice } from "../components/SubscriptionNotice";
import { Topbar } from "../components/Topbar";
import { featureGroups, superAdminGroups } from "../lib/featureCatalog";
import { getClientTerms } from "../lib/clientTerminology";

const CORPORATE_HIDDEN_FEATURES = new Set(["Amenities Booking", "Voting System"]);

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const AdminFeaturePage = lazyNamed(() => import("../components/AdminFeaturePage"), "AdminFeaturePage");
const GuardWebPortal = lazyNamed(() => import("../components/GuardWebPortal"), "GuardWebPortal");
const LandingPage = lazyNamed(() => import("../components/LandingPage"), "LandingPage");
const Login = lazyNamed(() => import("../components/Login"), "Login");
const ResidentWebPortal = lazyNamed(() => import("../components/ResidentWebPortal"), "ResidentWebPortal");
const SuperAdminFeaturePage = lazyNamed(() => import("../components/SuperAdminPages"), "SuperAdminFeaturePage");

function AppLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-sm font-semibold text-slate-500">
      Loading...
    </div>
  );
}

function FeatureOnlyContent({ activeView, session }) {
  const [, encodedFeature = ""] = activeView.split("::");
  const exactFeature = decodeURIComponent(encodedFeature);
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && getClientTerms(session).isCorporate && CORPORATE_HIDDEN_FEATURES.has(exactFeature)) {
    return <AdminFeaturePage feature="Dashboard" session={session} />;
  }
  if (role === "SUPER_ADMIN") return <SuperAdminFeaturePage feature={exactFeature} session={session} />;
  return <AdminFeaturePage feature={exactFeature} session={session} />;
}

const toFeatureKey = (groupKey, feature) => `${groupKey}::${encodeURIComponent(feature)}`;

const resolveFeatureKey = (role, featureLabel) => {
  const groups = role === "SUPER_ADMIN" ? superAdminGroups : featureGroups;
  for (const [groupKey, group] of Object.entries(groups)) {
    if ((group?.features || []).includes(featureLabel)) {
      return toFeatureKey(groupKey, featureLabel);
    }
  }
  return role === "SUPER_ADMIN" ? defaultSuperAdminView : defaultFeatureView;
};

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const getSeenNotificationStorageKey = (userId) => `mehman-seen-admin-notifications:${userId || "anonymous"}`;

const readSeenNotificationKeys = (userId) => {
  if (!userId) return new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(getSeenNotificationStorageKey(userId)) || "[]");
    return new Set(Array.isArray(saved) ? saved.filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

const resolveTargetView = (role, text, session, metadata = {}) => {
  const content = String(text || "").toLowerCase();
  const metaCategory = String(metadata.category || "").toLowerCase();
  const metaEvent = String(metadata.event || "").toLowerCase();
  const metaStatus = String(metadata.status || "").toLowerCase();
  const metaFeature = String(metadata.feature || "").toLowerCase();
  const metaType = String(metadata.type || "").toLowerCase();
  const fullContent = `${content} ${metaCategory} ${metaEvent} ${metaStatus} ${metaFeature} ${metaType}`;
  const isCorporate = role !== "SUPER_ADMIN" && getClientTerms(session).isCorporate;
  const hasOperationalContext = Boolean(metadata.operationId || metadata.gatepassId || metadata.visitorId);
  if (role === "SUPER_ADMIN") {
    if (fullContent.includes("subscription") || fullContent.includes("renewal") || fullContent.includes("plan")) {
      return resolveFeatureKey(role, "Subscriptions");
    }
    if (fullContent.includes("client") || fullContent.includes("society") || fullContent.includes("corporate")) {
      return resolveFeatureKey(role, "Client Accounts");
    }
    return resolveFeatureKey(role, "SaaS Dashboard");
  }

  if (metadata.gatepassId || metadata.visitorId || fullContent.includes("visitor") || fullContent.includes("gatepass") || fullContent.includes("inbox")) {
    return resolveFeatureKey(role, "Inbox & Approvals");
  }
  if (fullContent.includes("maintenance billing") || fullContent.includes("bill") || fullContent.includes("billing") || fullContent.includes("payment")) {
    return resolveFeatureKey(role, "Maintenance Billing");
  }
  if (!isCorporate && (fullContent.includes("amenit") || metaCategory.includes("amenity"))) {
    return resolveFeatureKey(role, "Amenities Booking");
  }
  if (!isCorporate && (fullContent.includes("vot") || fullContent.includes("poll"))) {
    return resolveFeatureKey(role, "Voting System");
  }
  if (fullContent.includes("announcement") || fullContent.includes("announce")) {
    return resolveFeatureKey(role, "Announcements");
  }
  if (fullContent.includes("directory") || fullContent.includes("contact")) {
    return resolveFeatureKey(role, "Society Directory");
  }
  if (fullContent.includes("complaint") || fullContent.includes("feedback")) {
    return resolveFeatureKey(role, "Complaints & Feedback");
  }
  if (fullContent.includes("sos") || fullContent.includes("emergency")) {
    return resolveFeatureKey(role, "Inbox & Approvals");
  }
  if (fullContent.includes("maintenance")) {
    return resolveFeatureKey(role, "Maintenance Requests");
  }
  if (fullContent.includes("vehicle")) {
    return resolveFeatureKey(role, "Vehicle Monitoring");
  }
  if (fullContent.includes("resident suite") || fullContent.includes("resident staff") || fullContent.includes("household") || fullContent.includes("family") || fullContent.includes("staff id")) {
    return resolveFeatureKey(role, "Household Records");
  }
  if (fullContent.includes("guard") || fullContent.includes("security")) {
    return resolveFeatureKey(role, "Security Logs");
  }
  if (fullContent.includes("approval") || ["open", "working", "in_progress", "pending_approval"].some((state) => fullContent.includes(state))) {
    return resolveFeatureKey(role, "Inbox & Approvals");
  }
  if (hasOperationalContext) {
    return resolveFeatureKey(role, "Inbox & Approvals");
  }
  return resolveFeatureKey(role, "Dashboard");
};

const getInitialAuthStep = () => {
  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path === "/login") return "login";
  return "landing";
};

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY));
      if (!saved?.accessToken || !saved?.user?.role) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      return saved;
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  });

  const [activeView, setActiveView] = useState(defaultFeatureView);
  const [authStep, setAuthStep] = useState(getInitialAuthStep);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState(() => readSeenNotificationKeys(session?.user?.id));
  const [toast, setToast] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const notificationKeysRef = useRef(new Set());
  const notificationsHydratedRef = useRef(false);

  const user = session?.user;
  const role = user?.role;
  const hasValidSession = Boolean(session?.accessToken && role);

  useEffect(() => {
    setSeenNotificationKeys(readSeenNotificationKeys(user?.id));
    notificationKeysRef.current = new Set();
    notificationsHydratedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    const onToast = (event) => {
      const detail = event.detail || {};
      const message = String(detail.message || "").trim();
      if (!message) return;
      setToast({ message, type: detail.type || "success", id: Date.now() });
    };
    const onSession = (event) => {
      const nextSession = event.detail?.session || null;
      setSession(nextSession);
      if (!nextSession) {
        setAuthStep("landing");
      }
    };
    window.addEventListener("mehman:toast", onToast);
    window.addEventListener("mehman:session", onSession);
    return () => {
      window.removeEventListener("mehman:toast", onToast);
      window.removeEventListener("mehman:session", onSession);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const goToStep = (step) => {
    setAuthStep(step);
    const url = step === "login" ? "/login" : "/";
    window.history.pushState(null, "", url);
  };

  // Keep URL in sync when browser back/forward is used
  useEffect(() => {
    const onPop = () => {
      setAuthStep(getInitialAuthStep());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const handleLogin = (nextSession) => {
    setSession(nextSession);
    const nextRole = nextSession.user?.role;
    setActiveView(nextRole === "SUPER_ADMIN" ? defaultSuperAdminView : defaultFeatureView);
    window.history.replaceState(null, "", "/");
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    goToStep("landing");
    setNotificationsOpen(false);
    setNotifications([]);
    setInboxCount(0);
    setSeenNotificationKeys(new Set());
  };

  /* Notifications for admin web app */
  useEffect(() => {
    if (!session?.accessToken) return;
    if (!["SUPER_ADMIN", "SOCIETY_ADMIN", "COMPANY_ADMIN"].includes(role)) return;

    let mounted = true;
    const mapNotification = (item, fallbackTitle = "Update", synthetic = false) => {
      const data = parseJsonObject(item?.data);
      const operation = item?.operation || {};
      const operationPayload = parseJsonObject(operation?.payload);
      const title = item?.title || fallbackTitle;
      const body = item?.body || item?.description || operation?.description || "";
      const createdAt = item?.createdAt || item?.occurredAt || item?.updatedAt || operation?.createdAt || null;
      const metadata = {
        operationId: data.operationId || operation?.id || "",
        gatepassId: data.gatepassId || operationPayload.gatepassId || "",
        visitorId: data.visitorId || operationPayload.visitorId || "",
        category: item?.category || operation?.category || data.category || operationPayload.category || operationPayload.feature || "",
        event: data.event || operationPayload.event || "",
        status: operation?.status || item?.status || data.status || "",
        feature: operationPayload.feature || "",
        type: operationPayload.type || operationPayload.topic || operationPayload.amenity || ""
      };
      const id = item?.id || `${fallbackTitle}-${Math.random().toString(36).slice(2)}`;
      const notificationKey =
        metadata.gatepassId
          ? `gatepass-${metadata.gatepassId}`
          : metadata.visitorId
            ? `visitor-${metadata.visitorId}`
            : metadata.operationId
              ? `operation-${metadata.operationId}`
              : id;
      const locallySeen = seenNotificationKeys.has(notificationKey);
      const isUnread = synthetic ? !locallySeen : !item?.readAt && !locallySeen;
      const routingText = [
        title,
        body,
        operation?.title,
        operation?.description,
        operation?.category,
        operationPayload.feature,
        operationPayload.type,
        operationPayload.topic,
        operationPayload.amenity,
        operationPayload.month
      ].filter(Boolean).join(" ");
      return {
        id,
        notificationKey,
        title,
        body,
        createdAt,
        timeLabel: createdAt ? new Date(createdAt).toLocaleString() : "Just now",
        isUnread,
        synthetic,
        targetView: resolveTargetView(role, routingText, session, metadata)
      };
    };

    const fetchNotifications = async () => {
      setNotificationsLoading(true);
      try {
        const list = [];
        try {
          const notificationsData = await societyApi.notifications(session.accessToken, "?limit=20");
          (notificationsData.notifications || []).forEach((item) => {
            list.push(mapNotification(item));
          });
        } catch {
          /* notifications endpoint may be unavailable for some roles */
        }

        if (["SOCIETY_ADMIN", "COMPANY_ADMIN"].includes(role)) {
          const [visitorsData, opsData] = await Promise.all([
            societyApi.visitors(session.accessToken, "?status=DRAFT"),
            societyApi.operations(session.accessToken, "?limit=80")
          ]);

          const pendingVisitors = (visitorsData.visitors || []).filter((visitor) =>
            visitor.gatepasses?.some((gp) => gp.status === "PENDING" || gp.status === "DRAFT")
          );
          pendingVisitors.slice(0, 12).forEach((visitor) => {
            list.push(
              mapNotification(
                {
                  id: `visitor-${visitor.id}`,
                  title: `Visitor approval pending: ${visitor.fullName}`,
                  body: `${visitor.purpose || "Visitor"}${visitor.phone ? ` • ${visitor.phone}` : ""}`,
                  createdAt: visitor.createdAt
                },
                "Visitor approval pending",
                true
              )
            );
          });

          (opsData.operations || [])
            .filter((operation) => ["OPEN", "WORKING", "IN_PROGRESS", "PENDING_APPROVAL"].includes(operation.status))
            .slice(0, 12)
            .forEach((operation) => {
            list.push(
              mapNotification(
                {
                  id: `operation-${operation.id}`,
                  title: operation.title || `${operation.category || "Operation"} request`,
                  body: `${operation.description || "Pending review"}${operation.category ? ` (${operation.category})` : ""}`,
                  category: operation.category,
                  status: operation.status,
                  createdAt: operation.createdAt
                },
                "Open operation request",
                true
              )
            );
          });
        }

        const unique = [];
        const byNotificationKey = new Map();
        list.forEach((item) => {
          const key = item.notificationKey || item.id;
          const existingIndex = byNotificationKey.get(key);
          if (existingIndex === undefined) {
            byNotificationKey.set(key, unique.length);
            unique.push(item);
            return;
          }

          const existing = unique[existingIndex];
          const keepIncoming = existing.synthetic && !item.synthetic;
          unique[existingIndex] = {
            ...(keepIncoming ? item : existing),
            isUnread: Boolean(existing.isUnread || item.isUnread)
          };
        });

        unique.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const sliced = unique.slice(0, 30);
        if (mounted) {
          const nextKeys = new Set(sliced.map((item) => item.notificationKey || item.id).filter(Boolean));
          const newUnread = sliced.find((item) => {
            const key = item.notificationKey || item.id;
            return item.isUnread && key && !notificationKeysRef.current.has(key);
          });
          if (notificationsHydratedRef.current && newUnread) {
            setToast({
              message: newUnread.title || "New admin notification",
              type: "success",
              id: Date.now()
            });
          }
          notificationKeysRef.current = nextKeys;
          notificationsHydratedRef.current = true;
          setNotifications(sliced);
          setInboxCount(sliced.filter((item) => item.isUnread).length);
        }
      } catch {
        if (mounted) {
          setNotifications([]);
          setInboxCount(0);
        }
      } finally {
        if (mounted) setNotificationsLoading(false);
      }
    };

    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [session?.accessToken, role, seenNotificationKeys]);

  const rememberNotificationSeen = (notificationKey) => {
    if (!notificationKey || !user?.id) return;
    setSeenNotificationKeys((current) => {
      if (current.has(notificationKey)) return current;
      const next = new Set(current);
      next.add(notificationKey);
      localStorage.setItem(getSeenNotificationStorageKey(user.id), JSON.stringify(Array.from(next).slice(-300)));
      return next;
    });
  };

  const handleNotificationClick = async (item) => {
    if (!item) return;

    rememberNotificationSeen(item.notificationKey || item.id);
    setNotifications((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, isUnread: false } : entry
      )
    );
    setInboxCount((count) => (item.isUnread ? Math.max(0, count - 1) : count));

    if (item.id && !item.synthetic && session?.accessToken) {
      try {
        await societyApi.markNotificationRead(session.accessToken, item.id);
      } catch {
        /* silent */
      }
    }

    if (item.targetView) {
      setActiveView(item.targetView);
      setSidebarOpen(false);
    }

    setNotificationsOpen(false);
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!session?.accessToken) return;
    const unreadKeys = notifications.filter((item) => item.isUnread).map((item) => item.notificationKey || item.id).filter(Boolean);
    unreadKeys.forEach(rememberNotificationSeen);
    setNotifications((current) => current.map((item) => ({ ...item, isUnread: false })));
    setInboxCount(0);
    try {
      await societyApi.markAllRead(session.accessToken);
    } catch {
      /* keep the optimistic UI; the next poll will reconcile */
    }
  };

  const toastOverlay = toast ? (
    <div className={`fixed right-4 top-4 z-[80] max-w-sm rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl ${
      toast.type === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-white text-blue-800"
    }`}>
      {toast.message}
    </div>
  ) : null;

  if (!hasValidSession) {
    if (authStep === "landing") {
      return <><Suspense fallback={<AppLoading />}><LandingPage onContinue={() => goToStep("login")} /></Suspense>{toastOverlay}</>;
    }
    return <><Suspense fallback={<AppLoading />}><Login onLogin={handleLogin} onBack={() => goToStep("landing")} /></Suspense>{toastOverlay}</>;
  }

  if (role === "FLAT_OWNER") {
    return <><Suspense fallback={<AppLoading />}><ResidentWebPortal session={session} onLogout={handleLogout} /></Suspense>{toastOverlay}</>;
  }

  if (role === "SECURITY_GUARD") {
    return <><Suspense fallback={<AppLoading />}><GuardWebPortal session={session} onLogout={handleLogout} /></Suspense>{toastOverlay}</>;
  }

  const activeTitle = getMenuLabelByKey(activeView);
  const searchItems = Object.entries(role === "SUPER_ADMIN" ? superAdminGroups : featureGroups).flatMap(([groupKey, group]) =>
    (group.features || [])
      .filter((label) => !(role !== "SUPER_ADMIN" && getClientTerms(session).isCorporate && CORPORATE_HIDDEN_FEATURES.has(label)))
      .map((label) => ({
        key: toFeatureKey(groupKey, label),
        label,
        group: group.title
      }))
  );

  return (
    <div className="app-shell flex h-screen overflow-hidden text-slate-700">
      {toastOverlay}
      {showChangePw && (
        <ChangePasswordModal
          token={session?.accessToken}
          forced={false}
          onSuccess={() => setShowChangePw(false)}
          onClose={() => setShowChangePw(false)}
        />
      )}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        activeView={activeView}
        onNavigate={(key) => {
          setActiveView(key);
          setSidebarOpen(false);
        }}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePw(true)}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="app-content flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          activeTitle={activeTitle}
          onOpenMenu={() => setSidebarOpen(true)}
          user={user}
          inboxCount={inboxCount}
          notifications={notifications}
          notificationsOpen={notificationsOpen}
          notificationsLoading={notificationsLoading}
          onToggleNotifications={() => setNotificationsOpen((open) => !open)}
          onNotificationClick={handleNotificationClick}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          subscriptionNotice={<SubscriptionNotice session={session} />}
          searchItems={searchItems}
          onSearchSelect={(item) => {
            if (item?.key) {
              setActiveView(item.key);
              setSidebarOpen(false);
            }
          }}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1480px]">
            <Suspense fallback={<AppLoading />}>
              <FeatureOnlyContent activeView={activeView} session={session} />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
