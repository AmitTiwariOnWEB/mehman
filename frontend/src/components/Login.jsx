import { ArrowLeft, Eye, EyeOff, LockKeyhole, User } from "lucide-react";
import { useState } from "react";
import { SESSION_STORAGE_KEY, authApi } from "../lib/api";
import { ChangePasswordModal } from "./ChangePasswordModal";
import mehmanLogo from "../assets/mehman-logo.webp";
import paymasterLogo from "../assets/company-logo-nav.webp";

const roleLabels = {
  SUPER_ADMIN: "Super Admin",
  SOCIETY_ADMIN: "Society Admin",
  FLAT_OWNER: "Resident",
  SECURITY_GUARD: "Security Guard"
};

export function Login({ onLogin, onBack }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authApi.login({
        identifier: identifier.trim(),
        password
      });
      const role = session?.user?.role;
      if (!roleLabels[role]) {
        throw new Error("Unrecognized account role. Contact your administrator.");
      }
      if (session?.user?.mustChangePassword) {
        setPendingSession(session);
        return;
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      onLogin(session);
    } catch (err) {
      setError(err.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChanged = () => {
    if (!pendingSession) return;
    const updated = { ...pendingSession, user: { ...pendingSession.user, mustChangePassword: false } };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    onLogin(updated);
  };

  return (
    <>
    {pendingSession && (
      <ChangePasswordModal
        token={pendingSession.accessToken}
        forced={true}
        onSuccess={handlePasswordChanged}
      />
    )}
    <main className="login-canvas grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-300/35 sm:p-8">
        <div className="mb-6 flex justify-end">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
              Back
            </button>
          ) : null}
        </div>

        <div className="mx-auto mb-8 flex h-36 w-72 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 sm:h-40 sm:w-80">
          <img src={mehmanLogo} alt="Mehman logo" className="h-full w-full object-contain" />
        </div>

        <div className="-mt-5 mb-7 flex flex-col items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Powered by PMSL</span>
          <img src={paymasterLogo} alt="Paymaster Management Solutions Ltd" className="h-10 w-auto object-contain" />
        </div>

        <h1 className="text-center text-2xl font-bold text-[#031b36]">Login</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username</span>
            <span className="field-glass mt-2 flex h-12 items-center gap-3 rounded-xl px-4">
              <User size={16} className="shrink-0 text-[#0b396d]" />
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                className="w-full bg-transparent text-sm text-slate-950 outline-none"
                placeholder="Enter username"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <span className="field-glass mt-2 flex h-12 items-center gap-3 rounded-xl px-4">
              <LockKeyhole size={16} className="shrink-0 text-[#0b396d]" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                className="w-full bg-transparent text-sm text-slate-950 outline-none"
                placeholder="Enter password"
                required
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="shrink-0 text-slate-400 hover:text-slate-700 transition">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            disabled={loading || !identifier || !password}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#06284f] font-bold text-white transition hover:bg-[#031b36] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
    </>
  );
}
