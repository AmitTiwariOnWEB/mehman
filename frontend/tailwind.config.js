export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#04101c",
          900: "#061420",
          850: "#07182a",
          800: "#0a2035"
        },
        blue: {
          50: "#eef4fb",
          100: "#dbe7f5",
          200: "#bfd3eb",
          300: "#95b6da",
          400: "#6f98c9",
          500: "#4e7eb4",
          600: "#06284f",
          700: "#031b36",
          800: "#021528",
          900: "#021528"
        },
        gold: {
          50: "#fff8ec",
          100: "#fde9bd",
          200: "#f9d780",
          300: "#f6d071",
          400: "#e2ac3b",
          500: "#c89019",
          600: "#a87614",
          700: "#8b620f",
          800: "#6f4f0d",
          900: "#593f0a"
        },
        teal: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a"
        },
        emerald: {
          50: "#ecfdf5",
          100: "#d1fae5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857"
        }
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Sora", "Manrope", "Segoe UI", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 28px rgba(37, 99, 235, 0.22)",
        card: "0 1px 3px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)",
        sidebar: "14px 0 36px rgba(4,16,28,0.22)"
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-6px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "slide-in": "slideIn 0.18s ease-out",
        "fade-up": "fadeUp 0.2s ease-out"
      }
    }
  },
  plugins: [],
  safelist: [
    "bg-blue-500/20",
    "bg-blue-500/25",
    "bg-white/[4%]",
    "bg-white/[5%]",
    "bg-white/[6%]",
    "border-white/10",
    "bg-navy-900",
    "bg-emerald-50", "text-emerald-700", "ring-emerald-200", "bg-emerald-500",
    "bg-blue-50",    "text-blue-700",    "ring-blue-200",    "bg-blue-500",
    "bg-amber-50",   "text-amber-700",   "ring-amber-200",   "bg-amber-500",
    "bg-purple-50",  "text-purple-700",  "ring-purple-200",  "bg-purple-500",
    "bg-indigo-50",  "text-indigo-700",  "ring-indigo-200",  "bg-indigo-500",
    "bg-rose-50",    "text-rose-700",    "ring-rose-200",    "bg-rose-500"
  ]
};
