import { Building2, Home, Plus, Save, Shield, ShieldCheck, User, Users, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { societyApi } from "../lib/api";
import { getClientTerms, getRoleLabel } from "../lib/clientTerminology";
import { StatusPill, WorkflowHeader, WorkflowLayout } from "./WorkflowPrimitives";

const getRoleMeta = (session) => ({
  FLAT_OWNER:    { label: getRoleLabel("FLAT_OWNER", session),     color: "bg-blue-50 text-blue-700 border-blue-200",   Icon: Home    },
  SECURITY_GUARD:{ label: getRoleLabel("SECURITY_GUARD", session), color: "bg-blue-50 text-blue-700 border-blue-200",    Icon: Shield  },
  SOCIETY_ADMIN: { label: getRoleLabel("SOCIETY_ADMIN", session),  color: "bg-purple-50 text-purple-700 border-purple-200", Icon: UserCog },
  RECEPTIONIST:  { label: getRoleLabel("RECEPTIONIST", session),   color: "bg-amber-50 text-amber-700 border-amber-200", Icon: User    }
});

/* -- User Roles & Access - overview/management of ALL users by role -- */
export function SocietyUsers({ session }) {
  const terms = getClientTerms(session);
  const roleMeta = getRoleMeta(session);
  const [users, setBranches_users]    = useState([]);
  const [branches, setBranches]       = useState([]);
  const [gateAssignments, setGateAssignments] = useState({});
  const [roleFilter, setRoleFilter]   = useState("ALL");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [status, setStatus]           = useState("");

  const load = async () => {
    try {
      setError("");
      const [uData, bData] = await Promise.all([
        societyApi.users(session.accessToken),
        societyApi.branches(session.accessToken)
      ]);
      setBranches_users(uData.users || []);
      setBranches(bData.branches || []);
      setGateAssignments(Object.fromEntries(
        (uData.users || [])
          .filter((u) => u.role === "SECURITY_GUARD")
          .map((u) => [u.id, u.branch?.id || ""])
      ));
    } catch (err) {
      setError(err.message || "Unable to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session.accessToken]);

  const assignGate = async (userId) => {
    const branchId = gateAssignments[userId];
    if (!branchId) return;
    setStatus(""); setError("");
    try {
      await societyApi.assignGuardGate(session.accessToken, userId, { branchId });
      setStatus("Guard gate updated.");
      await load();
    } catch (err) {
      setError(err.message || "Unable to assign gate");
    }
  };

  const roles = ["ALL", "FLAT_OWNER", "SECURITY_GUARD", "SOCIETY_ADMIN", "RECEPTIONIST"];
  const filtered = roleFilter === "ALL" ? users : users.filter((u) => u.role === roleFilter);

  const counts = Object.fromEntries(
    Object.keys(roleMeta).map((r) => [r, users.filter((u) => u.role === r).length])
  );

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Access Control"
        title="User Roles & Access"
        description={`All ${terms.clientLower} user accounts - ${terms.residentPluralLower}, guards, admins. Use ${terms.resident} Management or Guard Management to create new users.`}
        stats={[
          { label: "Total users",    value: users.length },
          { label: terms.residentPlural, value: counts.FLAT_OWNER || 0 },
          { label: "Guards",         value: counts.SECURITY_GUARD || 0 }
        ]}
      />
      {error  ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {status ? <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{status}</p> : null}

      {/* Role summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(roleMeta).map(([role, meta]) => (
          <button
            key={role}
            onClick={() => setRoleFilter(roleFilter === role ? "ALL" : role)}
            className={`panel rounded-xl p-5 text-left transition hover:shadow-md ${roleFilter === role ? "ring-2 ring-blue-500" : ""}`}
          >
            <div className={`mb-3 inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold ${meta.color}`}>
              <meta.Icon size={12} /> {meta.label}
            </div>
            <p className="text-3xl font-black text-slate-950">{counts[role] || 0}</p>
            <p className="mt-1 text-xs text-slate-400 uppercase tracking-wide">Accounts</p>
          </button>
        ))}
      </div>

      {/* Role filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${roleFilter === r ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"}`}
          >
            {r === "ALL" ? `All (${users.length})` : `${roleMeta[r]?.label || r} (${counts[r] || 0})`}
          </button>
        ))}
      </div>

      {/* Users table */}
      <div className="panel rounded-xl p-0">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="font-semibold text-slate-950">
            {roleFilter === "ALL" ? "All Users" : (roleMeta[roleFilter]?.label || roleFilter) + "s"}  | {filtered.length}
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? <p className="p-6 text-sm text-slate-400">Loading users...</p> :
            filtered.length === 0 ? <p className="p-6 text-sm text-slate-400">No users in this role.</p> :
            filtered.map((user) => {
              const meta = roleMeta[user.role] || { label: user.role, color: "bg-slate-100 text-slate-600 border-slate-200", Icon: User };
              return (
                <div key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 font-bold text-slate-600 text-sm">
                      {user.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950 truncate">{user.name}</p>
                      <p className="text-sm text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold ${meta.color}`}>
                      <meta.Icon size={11} /> {meta.label}
                    </span>
                    {user.branch?.name && (
                      <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{user.branch.name}</span>
                    )}
                    {user.flats?.length > 0 && (
                      <span className="rounded-xl bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                        {terms.unit} {user.flats.map((f) => f.flatNumber).join(", ")}
                      </span>
                    )}
                  </div>
                  {/* Guard gate assignment inline */}
                  {user.role === "SECURITY_GUARD" && branches.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={gateAssignments[user.id] || ""}
                        onChange={(e) => setGateAssignments((g) => ({ ...g, [user.id]: e.target.value }))}
                        className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="">Assign gate</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button type="button" onClick={() => assignGate(user.id)}
                        className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-800 px-3 text-xs font-bold text-white">
                        <Save size={12} /> Save
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      </div>
    </section>
  );
}

export function GatesAndTowers({ session }) {
  const terms = getClientTerms(session);
  const [branches, setBranches] = useState([]);
  const [form, setForm]         = useState({ name: "", code: "", address: "", city: "", state: "" });
  const [status, setStatus]     = useState("");
  const [error, setError]       = useState("");
  const token = session?.accessToken || JSON.parse(localStorage.getItem("mehmanSession") || "null")?.accessToken;

  const load = async () => {
    if (!token) return;
    try {
      const data = await societyApi.branches(token);
      setBranches(data.branches || []);
    } catch (err) {
      setError(err.message || "Unable to load gates");
    }
  };

  useEffect(() => { load(); }, []);

  const update = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" && !current.code
        ? { code: value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 12) }
        : {})
    }));
  };

  const choosePresetGate = (name, code) => setForm((current) => ({ ...current, name, code, address: current.address || `${name} entrance` }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus(""); setError("");
    try {
      await societyApi.createBranch(token, form);
      setStatus("Gate created successfully.");
      setForm({ name: "", code: "", address: "", city: "", state: "" });
      await load();
    } catch (err) {
      setError(err.message || "Unable to create gate");
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Gate Operations"
        title="Gates, Towers & Access Points"
        description="Create every gate manually, then use gates across guard duty, visitor passes, flats, and entry logs."
        stats={[
          { label: "Gates",  value: branches.length },
          { label: "Mode",   value: "Manual"         },
          { label: "Status", value: "Active"          }
        ]}
      />
      <WorkflowLayout
        main={
          <form onSubmit={submit} className="panel rounded-xl p-6">
            <div className="mb-6 flex items-center gap-3">
              <Building2 className="text-blue-700" size={28} />
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Create Gate</h3>
                <p className="text-sm text-slate-500">{terms.adminRole} creates every gate manually.</p>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap gap-2">
              {[["Main Gate", "MAIN"], ["Front Gate", "FRONT"], ["Back Gate", "BACK"]].map(([name, code]) => (
                <button key={code} type="button" onClick={() => choosePresetGate(name, code)} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-100">
                  {name}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[["name", "Gate Name"], ["code", "Gate Code"], ["address", "Gate Address"], ["city", "City"], ["state", "State"]].map(([key, label]) => (
                <label key={key} className={key === "address" ? "md:col-span-2" : ""}>
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <input value={form[key]} onChange={(e) => update(key, e.target.value)} className="field-glass mt-2 h-11 w-full rounded-xl px-3 text-sm outline-none focus:border-blue-500" required={["name", "code", "address"].includes(key)} />
                </label>
              ))}
            </div>
            {status ? <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-sm text-blue-800">{status}</p> : null}
            {error  ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <button className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">
              <Plus size={18} /> Create Gate
            </button>
          </form>
        }
        queue={
          <div className="panel rounded-xl p-0">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center gap-3">
              <Home className="text-blue-700" size={22} />
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Live Gates</h3>
                <p className="text-sm text-slate-500">Use these when creating guards and flat owners.</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {branches.length === 0 ? <p className="p-5 text-sm text-slate-500">No gates created yet.</p> :
                branches.map((branch) => (
                  <div key={branch.id} className="p-4">
                    <p className="font-medium text-slate-950">{branch.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{branch.code}  | {branch.address}</p>
                    <div className="mt-2"><StatusPill status={branch.isActive ? "ACTIVE" : "INACTIVE"} /></div>
                  </div>
                ))
              }
            </div>
          </div>
        }
      />
    </section>
  );
}

