import React from "react";
import { createRoot } from "react-dom/client";
import { SESSION_STORAGE_KEY } from "./lib/api";
import App from "./pages/App.jsx";
import "./styles.css";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown frontend error"
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Root render failure:", error, errorInfo);
  }

  reset = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#eef4f8" }}>
          <section style={{ maxWidth: 680, width: "100%", border: "1px solid #dbe5ee", borderRadius: 16, background: "#fff", padding: 24, boxShadow: "0 12px 24px rgba(15,23,42,.08)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#06284f", margin: 0 }}>Mehman UI Recovery</p>
            <h1 style={{ marginTop: 8, marginBottom: 8, fontSize: 24, color: "#0f172a" }}>Frontend crashed while rendering.</h1>
            <p style={{ margin: 0, color: "#475569" }}>The app hit an unexpected runtime error. Click reload to reset local session and recover.</p>
            <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px" }}>
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.reset}
              style={{ marginTop: 14, height: 42, borderRadius: 10, border: "none", background: "#06284f", color: "#fff", padding: "0 16px", fontWeight: 700, cursor: "pointer" }}
            >
              Reload Mehman App
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

