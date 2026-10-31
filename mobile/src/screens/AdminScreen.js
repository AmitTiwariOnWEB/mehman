import Feather from "@expo/vector-icons/Feather";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from "react-native";
import { branchApi, flatApi, gatepassApi, notificationApi, operationApi, visitorApi } from "../lib/api";
import { colors, shadow } from "../styles/theme";

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

const normalizeOperation = (record) => record?.id ? { ...record, payload: parseJsonObject(record.payload) } : null;
const normalizeNotification = (item) => ({ ...item, data: parseJsonObject(item?.data), operation: normalizeOperation(item?.operation) });

const isOpenState = (status) => ["OPEN", "WORKING", "IN_PROGRESS", "PENDING_APPROVAL"].includes(String(status || "").toUpperCase());
const isBillingRecord = (record) => String(record?.category || "").toLowerCase().includes("maintenance billing");
const isComplaintRecord = (record) => /complaint|feedback/i.test(record?.category || "");
const isAnnouncementRecord = (record) => /announcement/i.test(record?.category || "");
const isDirectoryRecord = (record) => /directory/i.test(record?.category || "");
const isEmergencyRecord = (record) => /emergency|sos/i.test(`${record?.category || ""} ${record?.title || ""}`);
const showToast = (message) => {
  if (!message) return;
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
};
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(",")).join("\n");
const formatDate = (value) => new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
const formatTime = (value) => new Date(value).toLocaleTimeString("en-IN", { timeStyle: "short" });
const getReportPeriodRange = (period) => {
  const now = new Date();
  const from = period === "daily"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : period === "weekly"
    ? new Date(Date.now() - 6 * 86400000)
    : period === "monthly"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: now.toISOString().slice(0, 10)
  };
};
const isStaffCardRecord = (record) => (
  record?.title === "Staff ID Card" ||
  record?.title === "Maid & Driver ID Card" ||
  record?.payload?.feature === "Staff ID Cards" ||
  record?.payload?.feature === "Maid & Driver IDs" ||
  /resident staff/i.test(record?.category || "")
);
const isWithinReportRange = (value, fromDate, toDate) => {
  if (!value) return false;
  const date = new Date(value);
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T23:59:59.999`);
  return !Number.isNaN(date.getTime()) && date >= start && date <= end;
};
const getStaffAttendanceRows = (records, fromDate, toDate) => records.filter(isStaffCardRecord).flatMap((record) => {
  const payload = record.payload || {};
  const base = [
    payload.staffName || payload.fullName || payload.name || record.createdBy?.name || "",
    payload.designation || payload.staffDesignation || payload.staffRole || "",
    payload.staffIdNumber || payload.idNumber || "",
    payload.flatNumber || payload.flat || payload.unitNumber || ""
  ];
  const currentState = payload.entryState || (record.status === "IN_PROGRESS" ? "CHECKED_IN" : record.status === "CANCELLED" ? "DENIED" : "PENDING");
  const eventRows = Array.isArray(payload.attendanceLogs)
    ? payload.attendanceLogs
        .filter((event) => isWithinReportRange(event?.occurredAt, fromDate, toDate))
        .map((event) => [
          ...base,
          event.action === "CHECKED_IN" ? "Check-In" : event.action === "CHECKED_OUT" ? "Check-Out" : event.action === "DENIED" ? "Denied" : event.action || "",
          formatDate(event.occurredAt),
          formatTime(event.occurredAt),
          event.actionBy || event.guardName || payload.lastActionBy || "",
          currentState,
          payload.cardNumber || "",
          formatDate(record.createdAt)
        ])
    : [];
  if (eventRows.length) return eventRows;
  return [payload.checkedInAt, payload.checkedOutAt, currentState === "DENIED" ? payload.lastActionAt : null]
    .filter((value) => isWithinReportRange(value, fromDate, toDate))
    .map((value) => [
      ...base,
      value === payload.checkedInAt ? "Check-In" : value === payload.checkedOutAt ? "Check-Out" : "Denied",
      formatDate(value),
      formatTime(value),
      payload.lastActionBy || "",
      currentState,
      payload.cardNumber || "",
      formatDate(record.createdAt)
    ]);
});

export function AdminScreen({ session, onBellCountChange, triggerInbox = 0, navIntent, appPrefs }) {
  const isCorporate = session?.user?.company?.clientType === "CORPORATE";
  const clientLabel = isCorporate ? "Corporate" : "Society";
  const unitLabel = isCorporate ? "Office" : "Flat";
  const [activeFeature, setActiveFeature] = useState(null);
  const [visitors, setVisitors] = useState([]);
  const [operations, setOperations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [branches, setBranches] = useState([]);
  const [flats, setFlats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [reportPeriod, setReportPeriod] = useState("daily");
  const [form, setForm] = useState({ title: "", description: "", contact: "", note: "" });

  const openFeature = (feature) => {
    setActiveFeature(feature);
    setError("");
    setStatus("");
  };

  const load = async () => {
    try {
      setError("");
      const [visitorData, operationData, notificationData, branchData, flatData] = await Promise.all([
        visitorApi.list(session.accessToken),
        operationApi.list(session.accessToken, "?limit=200"),
        notificationApi.list(session.accessToken, "?limit=20"),
        branchApi.list(session.accessToken),
        flatApi.list(session.accessToken)
      ]);
      setVisitors(visitorData.visitors || []);
      setOperations((operationData.operations || operationData.records || []).map(normalizeOperation).filter(Boolean));
      setNotifications((notificationData.notifications || []).map(normalizeNotification));
      setBranches(branchData.branches || []);
      setFlats(flatData.flats || flatData.offices || flatData.units || []);
    } catch (err) {
      setError(err.message || "Unable to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unread = notifications.filter((item) => !item.readAt).length;
    const pending = visitors.filter((visitor) => visitor.gatepasses?.some((pass) => ["DRAFT", "PENDING"].includes(pass.status))).length;
    onBellCountChange?.(unread + pending);
  }, [notifications, visitors]);

  useEffect(() => {
    if (triggerInbox > 0) openFeature("Inbox & Approvals");
  }, [triggerInbox]);

  useEffect(() => {
    if (!navIntent?.nonce) return;
    const target = navIntent.target;
    if (target === "HOME") setActiveFeature(null);
    if (target === "APPROVALS" || target === "INBOX") openFeature("Inbox & Approvals");
    if (target === "SERVICES") openFeature("Service Desk");
    if (target === "CREATE") openFeature("Announcements");
    if (target === "MORE" || target === "PROFILE") openFeature("Admin Tools");
  }, [navIntent?.nonce]);

  const pendingVisitors = useMemo(
    () => visitors.filter((visitor) => visitor.gatepasses?.some((pass) => ["DRAFT", "PENDING"].includes(pass.status))),
    [visitors]
  );
  const activePasses = visitors.filter((visitor) => visitor.gatepasses?.some((pass) => ["ACTIVE", "CHECKED_IN"].includes(pass.status))).length;
  const openOperations = operations.filter((record) => isOpenState(record.status));
  const paymentReviews = operations.filter((record) => isBillingRecord(record) && (record.status === "PENDING_APPROVAL" || record.payload?.billState === "PAYMENT_REPORTED"));
  const emergencies = operations.filter((record) => isEmergencyRecord(record) && isOpenState(record.status));
  const unreadNotifications = notifications.filter((item) => !item.readAt).length;

  const dashboardRows = [
    { label: "Inbox & Approvals", value: pendingVisitors.length, meta: "Visitor, delivery, and gatepass decisions", icon: "inbox", feature: "Inbox & Approvals" },
    { label: "Live Gate Monitor", value: activePasses, meta: "Active passes and gate movement", icon: "activity", feature: "Live Gate Monitor" },
    { label: "Service Desk", value: openOperations.length, meta: "Complaints, maintenance, SOS, and requests", icon: "tool", feature: "Service Desk" },
    { label: "Export Reports", value: "CSV", meta: "Visitors, gate logs, and staff attendance", icon: "download", feature: "Export Reports" },
    { label: "Payment Reviews", value: paymentReviews.length, meta: "Maintenance payments awaiting verification", icon: "credit-card", feature: "Maintenance Billing" }
  ];

  const decideGatepass = async (passId, nextStatus) => {
    if (!passId) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await gatepassApi.updateStatus(session.accessToken, passId, { status: nextStatus });
      setStatus(nextStatus === "ACTIVE" ? "Gatepass approved." : "Gatepass rejected.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to update gatepass");
    } finally {
      setSaving(false);
    }
  };

  const updateOperation = async (record, nextStatus, payloadPatch = {}) => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await operationApi.update(session.accessToken, record.id, {
        status: nextStatus,
        payload: { ...(record.payload || {}), ...payloadPatch }
      });
      setStatus("Record updated.");
      showToast("Record updated.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to update record");
    } finally {
      setSaving(false);
    }
  };

  const createOperation = async (category) => {
    if (!form.title.trim()) {
      setError("Enter a title first.");
      return;
    }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await operationApi.create(session.accessToken, {
        category,
        title: form.title.trim(),
        description: form.description.trim() || form.note.trim(),
        payload: {
          contact: form.contact.trim(),
          source: "ADMIN_APK"
        }
      });
      setStatus(`${category} created.`);
      showToast(`${category} created.`);
      setForm({ title: "", description: "", contact: "", note: "" });
      await load();
    } catch (err) {
      setError(err.message || `Unable to create ${category.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const markAllNotificationsRead = async () => {
    setSaving(true);
    setError("");
    try {
      await notificationApi.markRead(session.accessToken);
      setStatus("All notifications marked read.");
      showToast("All notifications marked read.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to mark notifications read");
    } finally {
      setSaving(false);
    }
  };

  const shareReport = async (type) => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const { fromDate, toDate } = getReportPeriodRange(reportPeriod);
      const reportName = { visitors: "Visitors", logs: "CheckInOut", staff: "StaffAttendance", full: "FullReport" }[type] || "Report";
      const rows = [];

      if (type === "visitors" || type === "full") {
        const data = await visitorApi.list(session.accessToken, `?limit=5000&from=${fromDate}&to=${toDate}`);
        const list = data.visitors || [];
        if (type === "full") rows.push(["VISITOR PASSES"], []);
        rows.push(
          ["Visitor", "Phone", "Purpose", "Gate", "Vehicle", "Pass", "Status", "Date", "Time"],
          ...list.map((visitor) => {
            const pass = visitor.gatepasses?.[0];
            const vehicle = visitor.vehicles?.[0] || pass?.vehicle;
            return [
              visitor.fullName || "",
              visitor.phone || "",
              visitor.purpose || "",
              visitor.branch?.name || pass?.metadata?.gateName || "",
              vehicle?.number || "",
              pass?.passCode || "",
              pass?.status || "",
              formatDate(visitor.createdAt),
              formatTime(visitor.createdAt)
            ];
          })
        );
      }

      if (type === "logs" || type === "full") {
        const data = await gatepassApi.entryLogs(session.accessToken, `?from=${fromDate}&to=${toDate}&limit=5000`);
        const logs = data.logs || [];
        if (rows.length) rows.push([]);
        rows.push(
          ["VISITOR CHECK-IN / CHECK-OUT LOG"],
          [],
          ["Visitor", "Phone", "Pass", "Action", "Gate", "Vehicle", "Logged By", "Role", "Date", "Time"],
          ...logs.map((log) => {
            const visitor = log.gatepass?.visitor;
            const vehicle = log.gatepass?.vehicle;
            return [
              visitor?.fullName || log.snapshot?.visitorName || "",
              visitor?.phone || "",
              log.gatepass?.passCode || log.snapshot?.passCode || "",
              log.action === "ENTRY" ? "Check-In" : log.action === "EXIT" ? "Check-Out" : log.action,
              log.branch?.name || "",
              vehicle?.number || "",
              log.loggedBy?.name || "",
              log.loggedBy?.role?.name || "",
              formatDate(log.occurredAt),
              formatTime(log.occurredAt)
            ];
          })
        );
      }

      if (type === "staff" || type === "logs" || type === "full") {
        const data = await operationApi.list(session.accessToken, "?limit=5000&category=Resident%20Staff");
        const staffRows = getStaffAttendanceRows((data.operations || data.records || []).map(normalizeOperation).filter(Boolean), fromDate, toDate);
        if (rows.length) rows.push([]);
        rows.push(
          ["HOUSEHOLD STAFF ATTENDANCE (Maid / Driver / Domestic)"],
          [],
          ["Staff Name", "Designation", "ID Number", unitLabel, "Action", "Date", "Time", "Actioned By", "Current State", "Card No", "Date Added"],
          ...staffRows
        );
      }

      const fileName = `Mehman-${reportName}-${reportPeriod}-${toDate}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, String.fromCharCode(0xfeff) + toCsv(rows));
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error("Sharing is not available on this device");
      await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Share Mehman report" });
      setStatus(`${reportName} report ready.`);
    } catch (err) {
      setError(err.message || "Unable to prepare report");
    } finally {
      setSaving(false);
    }
  };

  const renderFeature = () => {
    if (activeFeature === "Inbox & Approvals") {
      return (
        <Panel title="Inbox & Approvals" meta={`${pendingVisitors.length} pending`}>
          {pendingVisitors.length === 0 ? <Empty text="No visitor approvals are pending." /> : pendingVisitors.map((visitor) => {
            const pass = visitor.gatepasses?.find((item) => ["DRAFT", "PENDING"].includes(item.status)) || visitor.gatepasses?.[0];
            return (
              <Record key={visitor.id} icon="user" title={visitor.fullName} meta={`${visitor.purpose || "Visitor"} | ${visitor.phone || "No phone"}`}>
                <View style={styles.actionRow}>
                  <Action label="Approve" icon="check" disabled={saving} onPress={() => decideGatepass(pass?.id, "ACTIVE")} />
                  <Action label="Reject" icon="x" tone="danger" disabled={saving} onPress={() => decideGatepass(pass?.id, "CANCELLED")} />
                </View>
              </Record>
            );
          })}
        </Panel>
      );
    }

    if (activeFeature === "Live Gate Monitor") {
      return (
        <Panel title="Live Gate Monitor" meta={`${branches.length} gates`}>
          <View style={styles.statGrid}>
            <MiniStat label="Active Passes" value={activePasses} />
            <MiniStat label="Visitors Today" value={visitors.length} />
            <MiniStat label="Open SOS" value={emergencies.length} danger />
            <MiniStat label={unitLabel + "s"} value={flats.length} />
          </View>
          {branches.map((branch) => {
            const count = visitors.filter((visitor) => visitor.branchId === branch.id).length;
            return <Record key={branch.id} icon="map-pin" title={branch.name} meta={`${count} visitor records linked to this gate`} />;
          })}
        </Panel>
      );
    }

    if (activeFeature === "Maintenance Billing") {
      return (
        <Panel title="Payment Reviews" meta={`${paymentReviews.length} waiting`}>
          {paymentReviews.length === 0 ? <Empty text="No payment proofs are waiting for review." /> : paymentReviews.map((record) => (
            <Record key={record.id} icon="credit-card" title={record.title} meta={`INR ${record.payload?.amount || "-"} | ${record.payload?.month || "Billing"}${record.payload?.reportedPaidAt ? ` | Submitted ${new Date(record.payload.reportedPaidAt).toLocaleDateString()}` : ""}`}>
              <View style={styles.actionRow}>
                <Action label="Mark Paid" icon="check" disabled={saving} onPress={() => updateOperation(record, "RESOLVED", { billState: "PAID", adminVerifiedAt: new Date().toISOString() })} />
                <Action label="Reject" icon="x" tone="danger" disabled={saving} onPress={() => updateOperation(record, "OPEN", { billState: "UNPAID", paymentDeniedNote: "Rejected by admin", paymentDeniedAt: new Date().toISOString() })} />
              </View>
            </Record>
          ))}
        </Panel>
      );
    }

    if (activeFeature === "Service Desk") {
      const serviceRecords = operations.filter((record) => isOpenState(record.status) && !isBillingRecord(record));
      return (
        <Panel title="Service Desk" meta={`${serviceRecords.length} open`}>
          {serviceRecords.length === 0 ? <Empty text="No service records are open." /> : serviceRecords.map((record) => (
            <Record key={record.id} icon={isEmergencyRecord(record) ? "alert-triangle" : isComplaintRecord(record) ? "message-square" : "file-text"} title={record.title} meta={`${record.category} | ${record.status}`}>
              <Text style={styles.recordBody}>{record.description || "No description"}</Text>
              <View style={styles.actionRow}>
                <Action label="In progress" icon="clock" disabled={saving} onPress={() => updateOperation(record, "IN_PROGRESS")} />
                <Action label="Close" icon="check" disabled={saving} onPress={() => updateOperation(record, "CLOSED")} />
              </View>
            </Record>
          ))}
        </Panel>
      );
    }

    if (activeFeature === "Resident Records") {
      const residentRecords = operations.filter((record) => /resident suite|household|resident staff/i.test(record.category || ""));
      return (
        <Panel title="Resident / Office Submitted Records" meta={`${residentRecords.length} submitted`}>
          {residentRecords.length === 0 ? <Empty text="No resident or office records submitted yet." /> : residentRecords.map((record) => (
            <Record
              key={record.id}
              icon={/vehicle/i.test(`${record.title || ""} ${record.payload?.feature || ""}`) ? "truck" : "users"}
              imageUri={record.payload?.photoUrl || ""}
              title={record.payload?.name || record.payload?.fullName || record.title}
              meta={`${record.payload?.feature || record.category} | ${record.status}`}
            >
              <Text style={styles.recordBody}>{record.payload?.note || record.description || "No notes"}</Text>
            </Record>
          ))}
        </Panel>
      );
    }

    if (activeFeature === "Announcements" || activeFeature === "Directory") {
      const category = activeFeature === "Announcements" ? `${clientLabel} Announcement` : `${clientLabel} Directory`;
      const existing = operations.filter((record) => activeFeature === "Announcements" ? isAnnouncementRecord(record) : isDirectoryRecord(record));
      return (
        <Panel title={activeFeature} meta="Create and review">
          <View style={styles.formCard}>
            <Input label={activeFeature === "Announcements" ? "Notice title" : "Contact name"} value={form.title} onChangeText={(value) => setForm((current) => ({ ...current, title: value }))} />
            <Input label={activeFeature === "Announcements" ? "Message" : "Phone / role"} value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} multiline />
            <Action label={saving ? "Saving..." : `Create ${activeFeature === "Announcements" ? "Notice" : "Contact"}`} icon="plus" disabled={saving} onPress={() => createOperation(category)} />
          </View>
          {existing.slice(0, 8).map((record) => <Record key={record.id} icon="bell" title={record.title} meta={record.description || record.category} />)}
        </Panel>
      );
    }

    if (activeFeature === "Notification History") {
      return (
        <Panel title="Notification History" meta={`${unreadNotifications} unread`}>
          {unreadNotifications > 0 ? (
            <Action label="Mark all read" icon="check-circle" disabled={saving} onPress={markAllNotificationsRead} />
          ) : null}
          {notifications.length === 0 ? <Empty text="No notifications yet." /> : notifications.map((item) => (
            <Record key={item.id} icon={item.readAt ? "bell" : "bell-off"} title={item.title || "Notification"} meta={`${item.body || "No details"} | ${new Date(item.createdAt).toLocaleString()}`} />
          ))}
        </Panel>
      );
    }

    if (activeFeature === "Export Reports") {
      const periodOptions = [
        { value: "daily", label: "Today" },
        { value: "weekly", label: "7 Days" },
        { value: "monthly", label: "Month" },
        { value: "last_3_months", label: "3 Months" }
      ];
      return (
        <Panel title="Export Reports" meta="CSV">
          <View style={styles.periodRow}>
            {periodOptions.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => setReportPeriod(item.value)}
                style={[styles.periodButton, reportPeriod === item.value && styles.periodButtonActive]}
              >
                <Text style={[styles.periodText, reportPeriod === item.value && styles.periodTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Record icon="user" title="Visitor Report" meta="Visitor name, phone, gate, pass, status, date and time">
            <View style={styles.actionRow}>
              <Action label={saving ? "Preparing..." : "Share CSV"} icon="download" disabled={saving} onPress={() => shareReport("visitors")} />
            </View>
          </Record>
          <Record icon="activity" title="Check-In / Check-Out Log" meta="Visitor and staff movement by guard, gate, date and time">
            <View style={styles.actionRow}>
              <Action label={saving ? "Preparing..." : "Share CSV"} icon="download" disabled={saving} onPress={() => shareReport("logs")} />
            </View>
          </Record>
          <Record icon="users" title="Staff Attendance" meta="Maid, driver, and domestic staff check-in/check-out history">
            <View style={styles.actionRow}>
              <Action label={saving ? "Preparing..." : "Share CSV"} icon="download" disabled={saving} onPress={() => shareReport("staff")} />
            </View>
          </Record>
          <Record icon="download" title="Full Report" meta="Visitor passes, gate logs, and staff attendance in one file">
            <View style={styles.actionRow}>
              <Action label={saving ? "Preparing..." : "Share All"} icon="download" disabled={saving} onPress={() => shareReport("full")} />
            </View>
          </Record>
        </Panel>
      );
    }

    if (activeFeature === "Admin Tools") {
      return (
        <Panel title="Admin Tools" meta="Quick access">
          <ToolGrid
            items={[
              { label: "Announcements", icon: "bell" },
              { label: "Directory", icon: "book-open" },
              { label: "Live Gate Monitor", icon: "activity" },
              { label: "Service Desk", icon: "tool" },
              { label: "Resident Records", icon: "users" },
              { label: "Maintenance Billing", icon: "credit-card" },
              { label: "Export Reports", icon: "download" },
              { label: "Inbox & Approvals", icon: "inbox" },
              { label: "Notification History", icon: "bell" }
            ]}
            onPress={openFeature}
          />
        </Panel>
      );
    }

    return null;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!activeFeature ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.eyebrow}>{clientLabel} Command Center</Text>
                <Text style={styles.heroTitle}>{session.user.name}</Text>
                <Text style={styles.heroSub}>{session.user.company?.name || "Mehman Operations"}</Text>
              </View>
              <TouchableOpacity onPress={() => openFeature("Notification History")} style={styles.heroIcon}>
                <Feather name="bell" size={18} color={colors.primary} />
                {unreadNotifications > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text></View> : null}
              </TouchableOpacity>
            </View>
            <View style={styles.heroStats}>
              <MiniStat label="Pending" value={pendingVisitors.length} />
              <MiniStat label="Active" value={activePasses} />
              <MiniStat label="SOS" value={emergencies.length} danger />
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Needs attention</Text>
            {dashboardRows.map((item) => (
              <TouchableOpacity key={item.label} onPress={() => openFeature(item.feature)} style={styles.homeRow} activeOpacity={0.84}>
                <View style={styles.rowIcon}><Feather name={item.icon} color={colors.primary} size={17} /></View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.label}</Text>
                  <Text style={styles.rowMeta}>{item.meta}</Text>
                </View>
                <Text style={styles.rowValue}>{item.value}</Text>
                <Feather name="chevron-right" color={colors.mutedLight} size={17} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Create fast</Text>
            <ToolGrid
              items={[
                { label: "Announcements", icon: "bell" },
                { label: "Directory", icon: "book-open" },
                { label: "Service Desk", icon: "tool" },
                { label: "Resident Records", icon: "users" },
                { label: "Live Gate Monitor", icon: "activity" },
                { label: "Export Reports", icon: "download" },
                { label: "Notification History", icon: "bell" }
              ]}
              onPress={openFeature}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setActiveFeature(null)} style={styles.backButton}>
              <Feather name="arrow-left" color={colors.ink} size={18} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.detailTitle}>{activeFeature}</Text>
          </View>
          {status ? <Message text={status} /> : null}
          {error ? <Message text={error} danger /> : null}
          {loading ? <Loader /> : renderFeature()}
        </>
      )}
      {!activeFeature && error ? <Message text={error} danger /> : null}
      {!activeFeature && loading ? <Loader /> : null}
    </ScrollView>
  );
}

function Panel({ title, meta, children }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {meta ? <Text style={styles.panelMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Record({ icon, title, meta, imageUri, children }) {
  return (
    <View style={styles.record}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.recordImage} />
      ) : (
        <View style={styles.rowIcon}><Feather name={icon} size={17} color={colors.primary} /></View>
      )}
      <View style={styles.recordMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
        {children}
      </View>
    </View>
  );
}

function ToolGrid({ items, onPress }) {
  return (
    <View style={styles.toolGrid}>
      {items.map((item) => (
        <TouchableOpacity key={item.label} onPress={() => onPress(item.label)} style={styles.tool}>
          <Feather name={item.icon} color={colors.primary} size={18} />
          <Text style={styles.toolText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MiniStat({ label, value, danger }) {
  return (
    <View style={[styles.miniStat, danger && styles.miniStatDanger]}>
      <Text style={[styles.miniValue, danger && styles.dangerText]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function Action({ label, icon, onPress, disabled, tone = "primary" }) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, tone === "danger" && styles.actionDanger, tone === "neutral" && styles.actionNeutral, disabled && styles.disabled]}
      activeOpacity={0.84}
    >
      <Feather name={icon} size={15} color={tone === "neutral" ? colors.ink : colors.white} />
      <Text style={[styles.actionText, tone === "neutral" && styles.actionTextNeutral]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Input({ label, value, onChangeText, multiline = false }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={label}
        placeholderTextColor={colors.mutedLight}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function Message({ text, danger }) {
  return (
    <View style={[styles.message, danger && styles.messageDanger]}>
      <Feather name={danger ? "alert-triangle" : "check-circle"} color={danger ? colors.danger : colors.success} size={17} />
      <Text style={[styles.messageText, danger && styles.dangerText]}>{text}</Text>
    </View>
  );
}

function Loader() {
  return <View style={styles.loader}><ActivityIndicator color={colors.primary} /><Text style={styles.empty}>Loading...</Text></View>;
}

function Empty({ text }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 112, gap: 18 },
  hero: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 18, ...shadow },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  heroTitle: { color: colors.ink, fontSize: 30, fontWeight: "900", marginTop: 6 },
  heroSub: { color: colors.muted, fontSize: 14, fontWeight: "700", marginTop: 3 },
  heroIcon: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: -4, top: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "900" },
  heroStats: { flexDirection: "row", gap: 10, marginTop: 18 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  miniStat: { flex: 1, minWidth: "30%", borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, padding: 12 },
  miniStatDanger: { backgroundColor: colors.dangerSoft, borderColor: "#fecaca" },
  miniValue: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  miniLabel: { color: colors.muted, marginTop: 3, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  panel: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10, ...shadow },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  panelTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  panelMeta: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  homeRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 13, backgroundColor: colors.surfaceMuted },
  rowIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  rowMeta: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  rowValue: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 12, height: 42 },
  backText: { color: colors.ink, fontWeight: "800" },
  detailTitle: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: "900" },
  record: { flexDirection: "row", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 13, backgroundColor: colors.surfaceMuted },
  recordImage: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  recordMain: { flex: 1, minWidth: 0 },
  recordBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  periodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodButton: { minHeight: 38, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  periodButtonActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  periodText: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  periodTextActive: { color: colors.white },
  action: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, borderRadius: 13, backgroundColor: colors.primary, paddingHorizontal: 13 },
  actionDanger: { backgroundColor: colors.danger },
  actionNeutral: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  actionText: { color: colors.white, fontWeight: "900", fontSize: 13 },
  actionTextNeutral: { color: colors.ink },
  disabled: { opacity: 0.55 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tool: { width: "48%", minHeight: 94, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, padding: 13, justifyContent: "space-between" },
  toolText: { color: colors.ink, fontSize: 13, fontWeight: "900", lineHeight: 18 },
  formCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, padding: 13, gap: 12 },
  inputGroup: { gap: 6 },
  inputLabel: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  input: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, color: colors.ink, fontWeight: "700" },
  textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" },
  message: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 15, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: colors.successSoft, padding: 12 },
  messageDanger: { borderColor: "#fecaca", backgroundColor: colors.dangerSoft },
  messageText: { flex: 1, color: colors.success, fontWeight: "800", fontSize: 13 },
  dangerText: { color: colors.danger },
  loader: { alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
  empty: { color: colors.muted, fontSize: 13, fontWeight: "700", paddingVertical: 10 }
});
