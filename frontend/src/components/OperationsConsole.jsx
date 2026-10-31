import { PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { societyApi } from "../lib/api";
import { societyOperationModules } from "../lib/moduleCatalog";
import { exportRecordsCsv, StatusPill, WorkflowHeader, WorkflowLayout, WorkflowQueue } from "./WorkflowPrimitives";

const priorityForModule = (module) => (
  module.title.includes("SOS") || module.title.includes("Security") ? "HIGH" : "NORMAL"
);

export function OperationsConsole({ session }) {
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRecords = async () => {
    try {
      const data = await societyApi.operations(session.accessToken, "?limit=8");
      setRecords(data.records || []);
    } catch (err) {
      setError(err.message || "Unable to load operations");
    }
  };

  useEffect(() => {
    loadRecords();
  }, [session.accessToken]);

  const startModule = async (module) => {
    setMessage("");
    setError("");
    try {
      await societyApi.createOperation(session.accessToken, {
        category: module.category,
        title: module.title,
        description: `${module.title} workflow opened from the professional operations console.`,
        priority: priorityForModule(module),
        payload: { module: module.title, owner: module.owner, features: module.features }
      });
      setMessage(`${module.title} workflow opened.`);
      await loadRecords();
    } catch (err) {
      setError(err.message || "Unable to open workflow");
    }
  };

  return (
    <section className="grid gap-6">
      <WorkflowHeader
        eyebrow="Professional Society Operations"
        title="Unified Management Console"
        description="Track resident, flat, tower, guard, visitor, gate, vehicle, QR pass, report export, role management, and security log workflows from one dashboard."
        stats={[
          { label: "Modules", value: societyOperationModules.length },
          { label: "Open Queue", value: records.length },
          { label: "Role Apps", value: 4 }
        ]}
      />
      <div className="-mt-6">
        {message ? <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <WorkflowLayout
        main={
        <div className="panel rounded-xl p-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <h4 className="font-semibold text-slate-950">Operational Modules</h4>
            <p className="mt-1 text-sm text-slate-500">Open any module to create a live operational workflow record.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="ops-table w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Coverage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {societyOperationModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <tr key={module.title}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                            <Icon size={18} />
                          </span>
                          <div>
                            <p className="font-semibold text-slate-950">{module.title}</p>
                            <p className="text-xs text-slate-500">{module.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600">{module.owner}</td>
                      <td>
                        <StatusPill status={module.status} />
                      </td>
                      <td className="max-w-md text-slate-500">{module.features.join(", ")}</td>
                      <td>
                        <button onClick={() => startModule(module)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white">
                          <PlayCircle size={15} />
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        }
        queue={<WorkflowQueue records={records} onExport={() => exportRecordsCsv("mehman-workflows.csv", records)} />}
      />
    </section>
  );
}

