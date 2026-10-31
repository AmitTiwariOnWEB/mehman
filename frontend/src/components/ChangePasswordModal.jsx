import { Eye, EyeOff, KeyRound, X } from "lucide-react";
import { useState } from "react";
import { authApi } from "../lib/api";

/**
 * ChangePasswordModal
 * Props:
 *   token        – access token
 *   forced       – boolean, if true the user MUST change (no close button)
 *   onSuccess    – called with updated session after change (web caller updates localStorage)
 *   onClose      – called when the modal is dismissed (only when forced=false)
 */
export function ChangePasswordModal({ token, forced = false, onSuccess, onClose }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPw !== confirmPw) {
      setError("New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPw === currentPw) {
      setError("New password must be different from current password.");
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(token, { currentPassword: currentPw, newPassword: newPw });
      setDone(true);
      if (onSuccess) setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  const PwField = ({ label, value, onChange, show, onToggle, autoComplete }) => (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-2 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="w-full bg-transparent text-sm outline-none"
          placeholder="••••••••"
        />
        <button type="button" onClick={onToggle} className="ml-2 shrink-0 text-slate-400 hover:text-slate-700 transition">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <KeyRound size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {forced ? "Set New Password" : "Change Password"}
              </h2>
              {forced && (
                <p className="text-xs text-slate-500 mt-0.5">Required before continuing</p>
              )}
            </div>
          </div>
          {!forced && onClose && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
              <X size={18} />
            </button>
          )}
        </div>

        {forced && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            For security, please change your password before using the system.
          </div>
        )}

        {done ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 text-center font-medium">
            Password changed successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PwField
              label="Current Password"
              value={currentPw}
              onChange={setCurrentPw}
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              autoComplete="current-password"
            />
            <PwField
              label="New Password"
              value={newPw}
              onChange={setNewPw}
              show={showNew}
              onToggle={() => setShowNew((v) => !v)}
              autoComplete="new-password"
            />
            <PwField
              label="Confirm New Password"
              value={confirmPw}
              onChange={setConfirmPw}
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
            />

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              disabled={loading || !currentPw || !newPw || !confirmPw}
              className="mt-1 flex h-11 w-full items-center justify-center rounded-xl bg-[#06284f] font-bold text-white transition hover:bg-[#031b36] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
