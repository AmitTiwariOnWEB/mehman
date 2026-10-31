const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const { protocol, hostname } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocalhost ? `${protocol}//localhost:4000/api` : "/api";
};

const API_BASE_URL = getApiBaseUrl();
export const SESSION_STORAGE_KEY = "mehmanSession";
const LEGACY_SESSION_STORAGE_KEY = "mehmanLegacySession";

let refreshRequest = null;
let sessionInvalidated = false;

const normalizeToken = (value) => {
  if (!value || typeof value !== "string") return null;
  let token = value.trim();
  if (!token) return null;

  if ((token.startsWith("\"") && token.endsWith("\"")) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }

  while (/^Bearer\s+/i.test(token)) {
    token = token.replace(/^Bearer\s+/i, "").trim();
  }

  return token || null;
};

const getStoredSession = () => {
  try {
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setStoredSession = (session) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mehman:session", { detail: { session } }));
  }
};

const clearStoredSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mehman:session", { detail: { session: null } }));
  }
};

const refreshAccessToken = async () => {
  if (refreshRequest) return refreshRequest;

  const session = getStoredSession();
  const refreshToken = session?.refreshToken;
  if (!refreshToken) return null;

  refreshRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        sessionInvalidated = true;
        clearStoredSession();
        return null;
      }

      const payload = await response.json();
      const nextSession = {
        ...session,
        accessToken: payload.accessToken,
        user: payload.user || session.user,
        refreshToken
      };

      sessionInvalidated = false;
      setStoredSession(nextSession);
      return normalizeToken(nextSession.accessToken);
    } catch {
      sessionInvalidated = true;
      clearStoredSession();
      return null;
    }
  })().finally(() => {
    refreshRequest = null;
  });

  return refreshRequest;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest(path, { method = "GET", body, token } = {}, retryOnAuth = true) {
  const storedToken = normalizeToken(getStoredSession()?.accessToken);
  const providedToken = normalizeToken(token);
  const authToken = providedToken || (sessionInvalidated ? null : storedToken);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (
    response.status === 401 &&
    retryOnAuth &&
    !["/auth/login", "/auth/mobile-login", "/auth/refresh"].includes(path)
  ) {
    const refreshedAccessToken = await refreshAccessToken();
    if (refreshedAccessToken) {
      return apiRequest(path, { method, body, token: refreshedAccessToken }, false);
    }
  }

  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = await response.json();
      const fieldErrors = data?.issues?.fieldErrors || {};
      const firstFieldError = Object.values(fieldErrors).flat().find(Boolean);
      message = firstFieldError || data.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const authApi = {
  login: async ({ identifier, password }) => {
    // Try admin login first (expects `email` field)
    try {
      const session = await apiRequest("/auth/login", {
        method: "POST",
        body: { email: identifier, password }
      });
      sessionInvalidated = false;
      setStoredSession(session);
      return session;
    } catch {
      // Fall back to mobile login for guards and flat owners (accepts any identifier)
      const session = await apiRequest("/auth/mobile-login", {
        method: "POST",
        body: { identifier, password }
      });
      sessionInvalidated = false;
      setStoredSession(session);
      return session;
    }
  },
  me: (token) => apiRequest("/auth/me", { token }),
  changePassword: (token, body) => apiRequest("/auth/change-password", { method: "POST", token, body })
};

export const superAdminApi = {
  societies: (token) => apiRequest("/societies", { token }),
  updateSocietySubscription: (token, societyId, body) =>
    apiRequest(`/societies/${societyId}/subscription`, { method: "PATCH", token, body }),
  onboardSociety: (token, body) =>
    apiRequest("/societies/onboard", { method: "POST", token, body })
};

export const societyApi = {
  /* Users */
  users: (token) => apiRequest("/users", { token }),
  createUser: (token, body) =>
    apiRequest("/users", { method: "POST", token, body }),
  assignGuardGate: (token, userId, body) =>
    apiRequest(`/users/${userId}/gate`, { method: "PATCH", token, body }),

  /* Analytics */
  analytics: (token, query = "") => apiRequest(`/analytics/dashboard${query}`, { token }),

  /* Visitors */
  visitors: (token, query = "") => apiRequest(`/visitors${query}`, { token }),
  entryLogs: (token, query = "") => apiRequest(`/gatepasses/logs${query}`, { token }),
  createVisitor: (token, body) =>
    apiRequest("/visitors", { method: "POST", token, body }),

  /* Branches / Gates */
  branches: (token) => apiRequest("/branches", { token }),
  createBranch: (token, body) =>
    apiRequest("/branches", { method: "POST", token, body }),

  /* Operations (complaints, maintenance, announcements, etc.) */
  operations: (token, query = "") =>
    apiRequest(`/operations${query}`, { token }),
  createOperation: (token, body) =>
    apiRequest("/operations", { method: "POST", token, body }),
  updateOperation: (token, id, body) =>
    apiRequest(`/operations/${id}`, { method: "PATCH", token, body }),

  /* Notifications */
  notifications: (token, query = "") =>
    apiRequest(`/notifications${query}`, { token }),
  markNotificationRead: (token, id) =>
    apiRequest(`/notifications/${id}/read`, { method: "PATCH", token }),
  markAllRead: (token) =>
    apiRequest("/notifications/read", { method: "PATCH", token }),

  /* Gatepasses */
  updateGatepassStatus: (token, id, body) =>
    apiRequest(`/gatepasses/${id}/status`, { method: "PATCH", token, body }),

  /* Flats */
  flats: (token, query = "") => apiRequest(`/flats${query}`, { token }),
  createFlat: (token, body) => apiRequest("/flats", { method: "POST", token, body }),
  updateFlat: (token, id, body) => apiRequest(`/flats/${id}`, { method: "PATCH", token, body }),

  /* Gatepasses */
  gatepasses: (token, query = "") => apiRequest(`/gatepasses${query}`, { token })
};
