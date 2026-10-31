import { useState, useEffect, useRef } from "react";
import heroEntrance from "../assets/hero-entrance.webp";
import dashboardHero from "../assets/dashboard-hero.webp";
import shotVisitor from "../assets/mobile-feature-approval-inbox.webp";
import shotSos from "../assets/mobile-resident-dashboard.webp";
import shotQr from "../assets/mobile-feature-qr-scan.webp";
import shotGuard from "../assets/mobile-guard-dashboard.webp";
import shotAdmin from "../assets/mobile-admin-dashboard.webp";
import chaiCompare from "../assets/price-chai-compare.webp";
import mehmanMark from "../assets/mehman-logo.webp";
import paymasterLogo from "../assets/company-logo-nav.webp";
import paymasterFooterLogo from "../assets/company-logo-footer.webp";
import artGate from "../assets/art-gate.webp";
import artQr from "../assets/art-qr.webp";
import artShield from "../assets/art-shield.webp";
import artTower from "../assets/art-tower.webp";
import artBell from "../assets/art-bell.webp";
import artLog from "../assets/art-log.webp";
import contactMap from "../assets/contact-map.webp";

export function LandingPage({ onContinue }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", looking_for: "", message: ""
  });
  const [formStatus, setFormStatus] = useState("idle");
  const [formErrors, setFormErrors] = useState({});
  const howRef = useRef(null);
  const [howVisible, setHowVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);
  useEffect(() => {
    const el = howRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setHowVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const aboutRef = useRef(null);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [counts, setCounts] = useState({ societies: 0, visitors: 0, gates: 0, seconds: 0 });
  useEffect(() => {
    const el = aboutRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAboutVisible(true);
          obs.disconnect();
          const targets = { societies: 100, visitors: 50000, gates: 250, seconds: 3 };
          const dur = 1600, start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / dur, 1);
            const e = 1 - Math.pow(1 - p, 3);
            setCounts({
              societies: Math.round(targets.societies * e),
              visitors: Math.round(targets.visitors * e),
              gates: Math.round(targets.gates * e),
              seconds: Math.round(targets.seconds * e),
            });
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const fmt = (n) => n.toLocaleString("en-IN");
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    const nextValue = name === "phone" ? value.replace(/\D/g, "").slice(0, 10) : value;
    setFormData(prev => ({ ...prev, [name]: nextValue }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    } else if (!/^[a-zA-Z\s.\-]+$/.test(formData.name.trim())) {
      errors.name = "Name can only contain letters, spaces, dots, and hyphens";
    }
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    const digits = formData.phone.replace(/\D/g, "");
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (digits.length !== 10) {
      errors.phone = "Phone must be exactly 10 digits";
    } else if (!/^[6-9]/.test(digits)) {
      errors.phone = "Must start with 6, 7, 8, or 9";
    }
    if (!formData.looking_for) {
      errors.looking_for = "Please select what you are looking for";
    }
    if (formData.message && formData.message.length > 1000) {
      errors.message = "Message must be under 1000 characters";
    }
    return errors;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormStatus("sending");
    setFormErrors({});
    try {
      const res = await fetch("/send-mail.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          phone: formData.phone.replace(/\D/g, "")
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFormStatus("success");
        setFormData({ name: "", email: "", phone: "", looking_for: "", message: "" });
      } else {
        setFormStatus("error");
      }
    } catch {
      setFormStatus("error");
    }
  };

  const handleAnchorClick = (e) => {
    const href = e.currentTarget.getAttribute("href");
    if (href && href.startsWith("#") && href.length > 1) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { background: #f0ebe0; scroll-behavior: smooth; }
        body { background: #f0ebe0; overscroll-behavior-y: none; -webkit-font-smoothing: antialiased; overflow-x: hidden; width: 100%; max-width: 100%; position: relative; }
        #root { overflow-x: hidden; width: 100%; max-width: 100%; }

        /* NAVBAR */
        /* Craft: fixed top center, rounded-full pill, h-[52px], backdrop-blur-xs, glass-button-shadow */
        .navbar {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          height: 52px;
          width: min(940px, calc(100vw - 28px));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 0 8px 0 16px;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border-radius: 9999px;
          box-shadow:
            0 1px 3px rgba(0,0,0,0.07),
            0 4px 12px rgba(0,0,0,0.06),
            0 0 0 1px rgba(0,0,0,0.05);
          transition: box-shadow 0.2s;
        }
        .navbar.scrolled {
          box-shadow:
            0 2px 8px rgba(0,0,0,0.10),
            0 8px 24px rgba(0,0,0,0.08),
            0 0 0 1px rgba(0,0,0,0.07);
        }
        .nav-brand {
          display: flex; align-items: center; gap: 0;
          text-decoration: none; flex-shrink: 0;
        }
        .nav-center {
          display: flex; align-items: center; justify-content: center; gap: 0;
          position: static; transform: none;
          flex: 1; min-width: 0;
          margin: 0;
        }
        .nav-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 400; color: #222;
          text-decoration: none; padding: 6px 12px; border-radius: 9999px;
          transition: background 0.12s;
          white-space: nowrap;
        }
        .nav-link:hover { background: rgba(0,0,0,0.05); }
        .nav-right {
          display: flex; align-items: center; gap: 12px;
          margin-left: 0;
          flex-shrink: 0;
        }
        .nav-login {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 600;
          color: #b1790a;
          text-decoration: none;
          padding: 9px 20px;
          border: 1.5px solid rgba(177,121,10,0.45);
          border-radius: 9999px;
          background: transparent;
          transition: background 0.22s ease, border-color 0.22s ease, color 0.22s ease, transform 0.22s ease;
          white-space: nowrap;
        }
        .nav-login:hover {
          background: #b1790a;
          border-color: #b1790a;
          color: #fff;
          transform: translateY(-1px);
        }
        /* Craft CTA: black pill, "Try Craft Free" */
        .nav-cta {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 500; color: #fff;
          background: #111; text-decoration: none;
          padding: 0 18px; height: 36px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 9999px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          transition: background 0.15s, transform 0.12s;
          white-space: nowrap;
        }
        .nav-cta:hover { background: #222; transform: scale(1.02); }

        /* HERO PANEL */
        /* Craft: rounded-[28px] card, overflow hidden, sky image fills it */
        .hero-panel {
          position: relative;
          margin: 6px 16px 0;
          border-radius: 28px;
          overflow: hidden;
          height: calc(100vh - 40px);
          min-height: 600px;
          max-height: 880px;
        }

        /* Sky background image - full panel fill */
        .hero-bg-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          display: block;
          z-index: 0;
          border-radius: 28px;
        }

        /* Subtle top-to-mid overlay so text is crisp */
        .hero-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          border-radius: 28px;
          background: linear-gradient(180deg, rgba(180,215,248,0.50) 0%, rgba(160,200,242,0.28) 20%, transparent 45%);
        }

        /* HEADLINE BLOCK */
        /* Craft: absolute centered vertically in top portion, above screenshot */
        .hero-text-block {
          position: absolute;
          top: clamp(88px, 13vh, 140px);
          left: 0; right: 0;
          z-index: 50;
          display: flex; flex-direction: column;
          align-items: center; gap: 16px;
        }

        /* Craft h1: font-serif, font-weight normal (400), 66px, letter-spacing -0.03em */
        .hero-headline {
          font-family: 'Lora', 'ui-serif', 'Georgia', serif;
          font-weight: 400;
          font-size: clamp(34px, 4.6vw, 56px);
          line-height: 1.0;
          letter-spacing: -0.03em;
          color: #0d0d0d;
          text-align: center;
          max-width: 666px;
          width: min(666px, 88vw);
          animation: fadeSlideDown 0.6s ease both;
        }
        .hero-subheadline {
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          font-size: clamp(15px, 1.5vw, 18px);
          line-height: 1.55;
          letter-spacing: -0.005em;
          color: #2c2c2c;
          text-align: center;
          max-width: 560px;
          width: min(560px, 86vw);
          margin-top: -6px;
          text-shadow: 0 1px 2px rgba(255,255,255,0.4);
          animation: fadeSlideDown 0.6s 0.18s ease both;
        }
        .hero-sub-accent {
          font-weight: 600;
          color: #111;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .hero-sub-break { display: none; }
        }

        /* Craft CTA button: glass morphism frosted white pill */
        .hero-btn {
          display: inline-flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 500; color: #111;
          text-decoration: none;
          height: 48px; padding: 0 32px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow:
            0 2px 8px rgba(0,0,0,0.10),
            0 8px 24px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.9),
            0 0 0 1px rgba(0,0,0,0.06);
          transition: background 0.18s, transform 0.13s, box-shadow 0.18s;
          animation: fadeSlideDown 0.6s 0.26s ease both;
          margin-top: 4px;
          white-space: nowrap;
        }
        .hero-btn:hover {
          background: rgba(255,255,255,0.96);
          transform: scale(1.04);
          box-shadow:
            0 4px 16px rgba(0,0,0,0.14),
            0 12px 32px rgba(0,0,0,0.10),
            inset 0 1px 0 rgba(255,255,255,1),
            0 0 0 1px rgba(0,0,0,0.07);
        }

        /* APP SCREENSHOT */
        /* Craft: absolute bottom-0 centered, no frame, drop-shadow-2xl, bleeds off */
        .hero-screenshot-wrap {
          position: absolute;
          bottom: -110px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          width: min(820px, 74%);
          animation: slideUp 1s 0.9s ease both;
          -webkit-mask-image: linear-gradient(to bottom, black 0%, black 58%, rgba(0,0,0,0.3) 82%, transparent 100%);
          mask-image: linear-gradient(to bottom, black 0%, black 58%, rgba(0,0,0,0.3) 82%, transparent 100%);
        }
        .mac-window {
          background: #ffffff;
          border-radius: 12px 12px 0 0;
          box-shadow:
            0 25px 50px rgba(0,0,0,0.20),
            0 8px 16px rgba(0,0,0,0.10);
          overflow: hidden;
        }
        .mac-titlebar {
          position: relative;
          display: flex;
          align-items: center;
          padding: 10px 14px;
          background: #ebebeb;
        }
        .mac-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
          flex-shrink: 0;
        }
        .mac-dot-r { background: #ff5f57; }
        .mac-dot-y { background: #febc2e; }
        .mac-dot-g { background: #28c840; }
        .mac-url {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          min-width: 190px;
          padding: 4px 32px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.65);
          color: #9a9a9a;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          line-height: 1;
          text-align: center;
        }
        .hero-screenshot {
          width: 100%;
          display: block;
          border-radius: 0;
          /* Show only top portion - bleeds off bottom exactly like Craft */
          max-height: 48vh;
          object-fit: cover;
          object-position: top center;
        }

        /* ANIMATIONS */
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(32px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* RESPONSIVE */
        @media (max-width: 640px) {
          .nav-center { display: none; }
          .navbar { padding: 0 6px 0 12px; }
          .hero-panel { margin: 6px 10px 0; border-radius: 18px; }
          .hero-screenshot { max-height: 36vh; }
        }
        @media (max-width: 760px) {
          .nav-logo-svg {
            width: 162px !important;
            height: 42px !important;
          }
          .nav-logo-img {
            transform: translateX(-22px) scale(1.26) !important;
          }
          .hero-screenshot-wrap {
            top: auto !important;
            bottom: -40px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 92% !important;
          }
          .hero-screenshot {
            max-height: 34vh !important;
          }
          .hero-text-block {
            top: 50% !important;
            transform: translateY(-50%) !important;
            bottom: auto !important;
          }
          .hero-panel {
            min-height: 620px !important;
          }
        }

        .nav-logo-svg { width: 260px; height: 50px; flex-shrink: 0; }
        .nav-logo-img { width: 100%; height: 100%; display: block; object-fit: contain; transform: translateX(-26px) scale(1.5); transform-origin: left center; }
        .nav-dropdown-wrap { position: relative; display: flex; align-items: center; }
        .nav-dropdown-wrap::after {
          content: "";
          position: absolute;
          left: -10px;
          right: -10px;
          top: 100%;
          height: 14px;
        }
        .nav-dropdown-btn {
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; font-weight: 400; color: #222;
          padding: 6px 12px; border-radius: 9999px;
          user-select: none;
          transition: background 0.12s;
        }
        .nav-dropdown-btn:hover { background: rgba(0,0,0,0.05); }
        .nav-dropdown {
          display: flex;
          flex-direction: column;
          gap: 2px;
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 14px;
          padding: 8px;
          min-width: 260px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06);
          z-index: 300;
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.16s ease, visibility 0.16s ease, transform 0.16s ease;
        }
        .nav-dropdown-wrap:hover .nav-dropdown {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateX(-50%) translateY(2px);
        }
        .nav-dropdown-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 10px;
          text-decoration: none; color: #111;
          transition: background 0.12s;
        }
        .nav-dropdown-item:hover { background: #f5f2ec; }
        .nav-dropdown-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: #f5f2ec;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .nav-dropdown-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 500; color: #111; line-height: 1.2;
        }
        .nav-dropdown-desc {
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px; font-weight: 400; color: #888; line-height: 1.2; margin-top: 1px;
        }

        /* -- SOCIAL PROOF MARQUEE -- */
        .proof-bar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: 28px 24px;
          background: #f0ebe0;
        }
        .proof-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          text-align: center;
        }
        .proof-marquee {
          position: relative;
          width: min(620px, 92vw);
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%);
        }
        .proof-marquee-track {
          display: flex;
          align-items: center;
          gap: 18px;
          width: max-content;
          animation: proofScroll 26s linear infinite;
        }
        .proof-marquee:hover .proof-marquee-track {
          animation-play-state: paused;
        }
        .proof-item {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #6a6256;
          white-space: nowrap;
        }
        .proof-sep {
          color: #b1790a;
          font-size: 12px;
          opacity: 0.6;
        }
        .proof-stat {
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px;
          font-weight: 600;
          color: #111;
          text-transform: uppercase;
          letter-spacing: 0.10em;
          text-align: center;
        }
        @keyframes proofScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .proof-marquee-track { animation: none; }
        }
        @media (max-width: 640px) {
          .proof-marquee { width: 100vw; }
          .proof-item { font-size: 13px; }
        }

        /* -- PROBLEM STATEMENT -- */
        .problem-section {
          background: #f0ebe0;
          padding: 56px 24px 64px;
        }
        .problem-inner {
          max-width: 860px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
        }
        .problem-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #999;
        }
        .problem-headline {
          font-family: 'Lora', 'ui-serif', Georgia, serif;
          font-weight: 400;
          font-size: clamp(30px, 3.4vw, 44px);
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: #0d0d0d;
          text-align: center;
          margin-top: -12px;
        }
        .problem-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          width: 100%;
        }
        .problem-card {
          background: #fff;
          border: 1px solid rgba(255,255,255,0.88);
          border-radius: 16px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 12px 30px rgba(30,24,14,0.07);
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .problem-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 60px rgba(30,24,14,0.13);
        }
        .problem-card-panel {
          min-height: 152px;
          padding: 16px 17px 13px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 82px;
          gap: 14px;
          border-radius: 14px;
          margin: 4px;
          position: relative;
          overflow: hidden;
        }
        .problem-card:nth-child(1) .problem-card-panel { background: #ffe0ee; }
        .problem-card:nth-child(2) .problem-card-panel { background: #dff5fb; }
        .problem-card:nth-child(3) .problem-card-panel { background: #fff8bf; }
        .problem-card:nth-child(4) .problem-card-panel { background: #d9fadd; }
        .problem-card-copy {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .problem-badge {
          align-self: flex-start;
          font-family: 'DM Sans', sans-serif;
          font-size: 9px;
          font-weight: 600;
          color: #333;
          padding: 4px 8px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.42);
          margin-bottom: 10px;
        }
        .problem-card-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #111;
          line-height: 1.15;
          margin: 0 0 6px;
        }
        .problem-card-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px;
          font-weight: 400;
          color: rgba(17,17,17,0.62);
          line-height: 1.28;
          max-width: 220px;
          margin: 0;
        }
        .problem-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .problem-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: 'DM Sans', sans-serif;
          font-size: 10.5px;
          font-weight: 500;
          color: #171717;
        }
        .problem-meta-item svg { flex-shrink: 0; }
        .problem-progress-row {
          grid-column: 1 / -1;
          align-self: end;
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 4px;
        }
        .problem-progress-labels {
          display: flex;
          justify-content: space-between;
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          font-weight: 500;
          color: rgba(17,17,17,0.62);
        }
        .problem-progress-track {
          height: 5px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.42);
          overflow: hidden;
        }
        .problem-progress-fill {
          display: block;
          height: 100%;
          width: var(--progress);
          border-radius: inherit;
          background: #111;
        }
        .problem-card-visual {
          width: 76px;
          height: 76px;
          border-radius: 9999px;
          align-self: start;
          justify-self: end;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 35% 28%, rgba(255,255,255,0.95), rgba(255,255,255,0.18) 35%, transparent 36%),
            rgba(255,255,255,0.26);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35), 0 10px 18px rgba(0,0,0,0.09);
        }
        .problem-card-visual svg {
          width: 50px;
          height: 50px;
          filter: drop-shadow(0 6px 8px rgba(0,0,0,0.12));
        }
        .problem-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 18px 15px;
        }
        .problem-card-footer-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px;
          color: #666;
        }
        .problem-card-action {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
          background: #050505;
          border-radius: 9999px;
          padding: 7px 14px;
          box-shadow: 0 8px 18px rgba(0,0,0,0.16);
          white-space: nowrap;
        }
        .problem-resolution {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-top: -2px;
        }
        .problem-resolution-text {
          font-family: 'Lora', 'ui-serif', Georgia, serif;
          font-size: 20px;
          font-weight: 400;
          font-style: italic;
          color: #111;
          letter-spacing: -0.02em;
        }
        .problem-resolution-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          color: #111;
          text-decoration: none;
          border-bottom: 1px solid rgba(0,0,0,0.25);
          padding-bottom: 1px;
          transition: border-color 0.15s, color 0.15s;
        }
        .problem-resolution-link:hover {
          color: #000;
          border-color: #000;
        }

        /* -- FEATURES SECTION -- */
        .feat-section {
          background: #f0ebe0;
          padding: 44px 24px 48px;
        }
        .feat-head {
          max-width: 700px; margin: 0 auto 28px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .feat-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: #b1790a;
        }
        .feat-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(28px, 3.2vw, 42px);
          line-height: 1.08; letter-spacing: -0.03em; color: #0d0d0d;
        }
        .feat-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(15px, 1.4vw, 17px);
          line-height: 1.55; color: #555; max-width: 500px;
        }
        .feat-row {
          max-width: 960px;
          margin: 0 auto 22px;
          display: grid; grid-template-columns: 1fr 1fr;
          align-items: center; gap: 40px;
          padding: 32px 40px;
          scroll-margin-top: 100px;
          background: linear-gradient(158deg, #fdfaf3 0%, #f7f0e2 100%);
          border: 1px solid rgba(177,121,10,0.28);
          border-radius: 22px;
          box-shadow:
            0 1px 2px rgba(120,80,10,0.04),
            0 10px 30px rgba(120,80,10,0.06);
          position: relative;
          overflow: hidden;
          transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s ease, border-color 0.4s ease;
        }
        .feat-row::before {
          content: "";
          position: absolute;
          top: -40%; right: -10%;
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(177,121,10,0.10) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .feat-row:hover {
          transform: translateY(-4px);
          border-color: rgba(177,121,10,0.5);
          box-shadow:
            0 2px 4px rgba(120,80,10,0.06),
            0 18px 44px rgba(120,80,10,0.12);
        }
        .feat-row > * { position: relative; z-index: 1; }
        .feat-row.reverse .feat-copy { order: 2; }
        .feat-row.reverse .feat-shot { order: 1; }
        .feat-copy { display: flex; flex-direction: column; gap: 14px; }
        .feat-tag {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase; color: #b1790a;
        }
        .feat-heading {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(22px, 2.4vw, 31px);
          line-height: 1.14; letter-spacing: -0.02em; color: #111;
        }
        .feat-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; line-height: 1.65; color: #4a4a4a;
        }
        .feat-list { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-top: 2px; }
        .feat-list li {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #2c2c2c; padding-left: 25px; position: relative;
        }
        .feat-list li::before {
          content: ""; position: absolute; left: 0; top: 5px;
          width: 14px; height: 14px; border-radius: 50%; background: #b1790a;
          -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 7.5l2.5 2.5L11 4.5' stroke='black' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 7.5l2.5 2.5L11 4.5' stroke='black' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
        }

        /* -- CLEAN SCREENSHOT FRAME (Android-friendly, no notch) -- */
        .feat-shot {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          padding: 10px 0;
        }
        .shot-glow {
          position: absolute;
          width: 270px; height: 270px; border-radius: 50%;
          background: radial-gradient(circle, rgba(177,121,10,0.20) 0%, rgba(177,121,10,0.07) 45%, transparent 70%);
          filter: blur(6px); z-index: 0; pointer-events: none;
        }
        .shot-frame {
          position: relative; z-index: 1;
          width: min(248px, 68%);
          background: linear-gradient(155deg, #1c1c1f 0%, #0c0c0e 100%);
          border-radius: 36px;
          padding: 7px;
          box-shadow:
            0 2px 4px rgba(0,0,0,0.18),
            0 16px 36px rgba(0,0,0,0.20),
            0 32px 64px rgba(0,0,0,0.16),
            inset 0 0 0 1.5px rgba(255,255,255,0.08),
            inset 0 0 0 3px rgba(0,0,0,0.4);
          transition: transform 0.45s cubic-bezier(0.22,1,0.36,1), box-shadow 0.45s ease;
          animation: shotFloat 6s ease-in-out infinite;
        }
        .shot-frame img {
          width: 100%; display: block;
          border-radius: 30px;
          background: #fff;
        }
        /* Pixel 8 punch-hole camera */
        .shot-cam {
          position: absolute;
          top: 16px; left: 50%; transform: translateX(-50%);
          width: 9px; height: 9px;
          background: #000;
          border-radius: 50%;
          z-index: 3;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
        }
        /* Pixel 8 side buttons */
        .shot-frame::before {
          content: ""; position: absolute;
          right: -2px; top: 88px;
          width: 3px; height: 34px;
          background: #2a2a2d;
          border-radius: 2px;
        }
        .shot-frame::after {
          content: ""; position: absolute;
          right: -2px; top: 130px;
          width: 3px; height: 56px;
          background: #2a2a2d;
          border-radius: 2px;
        }
        .feat-shot:hover .shot-frame {
          transform: translateY(-10px) scale(1.015);
          box-shadow:
            0 4px 8px rgba(0,0,0,0.12),
            0 22px 46px rgba(0,0,0,0.20),
            0 44px 88px rgba(0,0,0,0.14),
            inset 0 0 0 1px rgba(0,0,0,0.06);
          animation-play-state: paused;
        }
        @keyframes shotFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        @media (max-width: 760px) {
          .feat-row { grid-template-columns: 1fr; gap: 20px; padding: 26px 22px; margin-bottom: 18px; }
          .feat-row.reverse .feat-copy { order: 2; }
          .feat-row.reverse .feat-shot { order: 1; }
          .feat-shot { order: 1; }
          .feat-copy { order: 2; }
          .shot-glow { width: 230px; height: 230px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shot-frame { animation: none; }
        }

        /* -- PRICING SECTION -- */
        .price-section {
          background: #f0ebe0;
          padding: 64px 24px 80px;
        }
        .price-head {
          max-width: 640px; margin: 0 auto 44px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .price-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: #b1790a;
        }
        .price-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(28px, 3.2vw, 42px);
          line-height: 1.1; letter-spacing: -0.03em; color: #0d0d0d;
        }
        .price-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(15px, 1.4vw, 17px);
          line-height: 1.55; color: #555; max-width: 480px;
        }
        .price-card {
          position: relative;
          max-width: 860px; margin: 0 auto;
          border-radius: 28px;
          background: linear-gradient(158deg, #fdfaf3 0%, #f6efe0 100%);
          border: 1px solid rgba(177,121,10,0.3);
          box-shadow:
            0 2px 4px rgba(120,80,10,0.05),
            0 20px 50px rgba(120,80,10,0.10);
          overflow: hidden;
        }
        .price-card-glow {
          position: absolute; top: -30%; left: 50%; transform: translateX(-50%);
          width: min(420px, 90%); height: 320px;
          max-width: 100%;
          background: radial-gradient(circle, rgba(177,121,10,0.12) 0%, transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .price-amount-block {
          display: flex; align-items: baseline; justify-content: center; gap: 2px;
        }
        .price-currency {
          font-family: 'Lora', 'ui-serif', Georgia, serif;
          font-size: 26px; color: #0d0d0d; font-weight: 400;
          align-self: flex-start; margin-top: 7px;
        }
        .price-amount {
          font-family: 'Lora', 'ui-serif', Georgia, serif;
          font-size: clamp(42px, 5vw, 56px); font-weight: 400;
          line-height: 1; letter-spacing: -0.03em; color: #0d0d0d;
        }
        .price-period {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; color: #777; margin-left: 6px;
        }
        .price-chai {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #b1790a; font-weight: 500;
          margin-top: 12px; max-width: 100%; line-height: 1.5;
          white-space: nowrap;
        }
        .price-divider {
          width: 100%; height: 1px;
          background: rgba(177,121,10,0.18);
          margin: 28px 0;
        }
        .price-includes {
          list-style: none; display: flex; flex-direction: column; gap: 12px;
          width: 100%; margin-bottom: 32px; text-align: left;
        }
        .price-includes li {
          font-family: 'DM Sans', sans-serif;
          font-size: 14.5px; color: #2c2c2c;
          padding-left: 28px; position: relative; line-height: 1.4;
        }
        .price-includes li::before {
          content: ""; position: absolute; left: 0; top: 2px;
          width: 16px; height: 16px; border-radius: 50%; background: #b1790a;
          -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5' stroke='black' stroke-width='1.7' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.5l2.5 2.5L12 5' stroke='black' stroke-width='1.7' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
        }
        .price-cta {
          display: inline-flex; align-items: center; justify-content: center;
          width: 100%;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 500; color: #fff;
          background: #0d0d0d;
          padding: 15px 28px; border-radius: 9999px;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s;
        }
        .price-cta:hover { background: #b1790a; transform: translateY(-2px); }
        .price-note {
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px; color: #999; margin-top: 14px;
        }

        /* -- PRICING TWO-COLUMN -- */
        .price-card-grid {
          position: relative; z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: stretch;
        }
        .price-visual {
          position: relative;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 36px 28px;
          background: linear-gradient(158deg, #faf4e8 0%, #f1e7d2 100%);
          border-right: 1px solid rgba(177,121,10,0.18);
        }
        .price-visual img {
          width: 100%; max-width: 280px; display: block;
          border-radius: 16px;
        }
        .price-visual-labels {
          display: flex; justify-content: center;
          width: 100%; max-width: 280px; margin-top: 14px; gap: 28px;
        }
        .price-visual-label {
          flex: 1; text-align: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 11.5px; color: #8a7a55; line-height: 1.45;
        }
        .price-visual-label strong {
          display: block; margin-top: 2px;
          font-size: 13px; font-weight: 600; color: #b1790a;
        }
        .price-details {
          padding: 40px 38px 34px;
          display: flex; flex-direction: column; align-items: flex-start; text-align: left;
        }
        .price-details .price-amount-block { justify-content: flex-start; }
        .price-details .price-chai { text-align: left; max-width: 100%; }
        .price-details .price-includes { text-align: left; }
        .price-details .price-cta { width: 100%; }
        .price-details .price-note { align-self: center; }

        @media (max-width: 720px) {
          .price-section { padding: 44px 10px 52px; }
          .price-card { max-width: 100%; width: min(100%, calc(100vw - 20px)); overflow: hidden; margin-left: auto; margin-right: auto; }
          .price-card-grid { display: block !important; grid-template-columns: 1fr !important; width: 100%; }
          .price-card-glow { display: none !important; }
          .price-visual {
            border-right: none !important;
            border-bottom: 1px solid rgba(177,121,10,0.18);
            padding: 26px 16px;
            width: 100%;
            overflow: hidden;
          }
          .price-visual img { max-width: 190px; width: 80%; }
          .price-visual-labels { max-width: 260px; width: 100%; justify-content: center; gap: 26px; }
          .price-details {
            padding: 28px 18px 26px;
            align-items: center;
            text-align: center;
            width: 100%;
            max-width: 100%;
            overflow: hidden;
          }
          .price-details .price-amount-block { justify-content: center; flex-wrap: wrap; width: 100%; }
          .price-amount { font-size: clamp(38px, 12vw, 50px); }
          .price-details .price-chai { text-align: center; max-width: 280px; white-space: normal !important; overflow-wrap: anywhere; }
          .price-details .price-includes { text-align: left; width: 100%; max-width: 300px; margin-left: auto; margin-right: auto; }
          .price-details .price-cta { width: 100%; max-width: 300px; padding-left: 18px; padding-right: 18px; }
          .price-period { white-space: normal; }
        }

        /* -- HOW IT WORKS -- */
        .how-section {
          background: #f0ebe0;
          padding: 64px 24px 72px;
        }
        .how-head {
          max-width: 640px; margin: 0 auto 56px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .how-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: #b1790a;
        }
        .how-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(28px, 3.2vw, 42px);
          line-height: 1.1; letter-spacing: -0.03em; color: #0d0d0d;
        }
        .how-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(15px, 1.4vw, 17px);
          line-height: 1.55; color: #555; max-width: 460px;
        }
        .how-flow {
          max-width: 960px; margin: 0 auto;
          display: flex; align-items: flex-start; justify-content: center;
          gap: 8px; position: relative;
        }
        .how-line {
          position: absolute; top: 28px; left: 12%; right: 12%; height: 2px;
          background: rgba(177,121,10,0.18); border-radius: 2px; z-index: 0;
        }
        .how-line-fill {
          display: block; height: 100%; width: 0%;
          background: #b1790a; border-radius: 2px;
          transition: width 1.4s ease 0.2s;
        }
        .how-flow.is-visible .how-line-fill { width: 100%; }
        .how-step {
          position: relative; z-index: 1;
          flex: 1; max-width: 240px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          gap: 10px;
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1);
          transition-delay: var(--d);
        }
        .how-flow.is-visible .how-step { opacity: 1; transform: translateY(0); }
        .how-icon {
          width: 58px; height: 58px; border-radius: 16px;
          background: linear-gradient(158deg, #fdfaf3 0%, #f4ecdb 100%);
          border: 1px solid rgba(177,121,10,0.3);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 18px rgba(120,80,10,0.08);
        }
        .how-num {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.16em; color: #b1790a;
        }
        .how-step-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: 22px; color: #111; letter-spacing: -0.02em;
        }
        .how-step-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; line-height: 1.6; color: #555; max-width: 220px;
        }
        .how-arrow {
          display: flex; align-items: center; padding-top: 18px;
          opacity: 0; transition: opacity 0.5s ease 0.5s;
        }
        .how-flow.is-visible .how-arrow { opacity: 1; }
        @media (max-width: 720px) {
          .how-flow { flex-direction: column; align-items: center; gap: 14px; }
          .how-line { display: none; }
          .how-arrow { transform: rotate(90deg); padding: 0; }
          .how-step { max-width: 320px; }
        }

        /* -- MORE CAPABILITIES GRID -- */
        .more-feat {
          max-width: 960px; margin: 44px auto 0;
        }
        .more-head {
          text-align: center; margin-bottom: 28px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .more-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 10.5px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase; color: #b1790a;
        }
        .more-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(20px, 2.2vw, 27px);
          line-height: 1.15; letter-spacing: -0.02em; color: #0d0d0d;
        }
        .more-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
        }
        .more-card {
          background: linear-gradient(158deg, #fdfaf3 0%, #f7f0e2 100%);
          border: 1px solid rgba(177,121,10,0.22);
          border-radius: 16px;
          padding: 22px 20px;
          display: flex; flex-direction: column; gap: 10px;
          transition: transform 0.35s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease, border-color 0.35s ease;
        }
        .more-card:hover {
          transform: translateY(-4px);
          border-color: rgba(177,121,10,0.45);
          box-shadow: 0 12px 30px rgba(120,80,10,0.10);
        }
        .more-icon {
          width: 42px; height: 42px; border-radius: 11px;
          background: rgba(177,121,10,0.08);
          border: 1px solid rgba(177,121,10,0.18);
          display: flex; align-items: center; justify-content: center;
        }
        .more-card-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 600; color: #1a1a1a;
        }
        .more-card-text {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; line-height: 1.55; color: #666;
        }
        @media (max-width: 760px) {
          .more-grid { grid-template-columns: 1fr; }
        }
        @media (min-width: 481px) and (max-width: 760px) {
          .more-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* -- ABOUT SECTION -- */
        .about-section {
          position: relative;
          background: #f0ebe0;
          padding: 52px 24px 56px;
          overflow: hidden;
        }
        .about-watermark {
          position: absolute;
          left: 50%; top: 46%;
          transform: translate(-50%, -50%);
          width: 340px; height: auto;
          opacity: 0.075;
          pointer-events: none; user-select: none;
          z-index: 0;
          mix-blend-mode: multiply;
        }
        .about-inner {
          position: relative; z-index: 1;
          max-width: 940px; margin: 0 auto;
        }
        .about-head {
          text-align: center; max-width: 620px; margin: 0 auto 32px;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .about-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: #b1790a;
        }
        .about-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(28px, 3.4vw, 44px);
          line-height: 1.12; letter-spacing: -0.03em; color: #0d0d0d;
        }
        .about-lead {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(15px, 1.5vw, 17px);
          line-height: 1.7; color: #555;
        }
        .about-lead em { color: #b1790a; font-style: italic; }

        .about-transform {
          display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center; gap: 24px;
          margin-bottom: 64px;
          opacity: 0; transform: translateY(28px);
          transition: opacity 0.7s ease 0.1s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s;
        }
        .about-inner.is-visible .about-transform { opacity: 1; transform: none; }
        .about-col {
          border-radius: 20px; padding: 28px 26px;
        }
        .about-col.before {
          background: rgba(120,90,40,0.04);
          border: 1px dashed rgba(120,90,40,0.3);
        }
        .about-col.after {
          background: linear-gradient(158deg, #fdfaf3 0%, #f6efe0 100%);
          border: 1px solid rgba(177,121,10,0.35);
          box-shadow: 0 12px 34px rgba(120,80,10,0.10);
        }
        .about-col-tag {
          display: block;
          font-family: 'DM Sans', sans-serif;
          font-size: 10.5px; font-weight: 600;
          letter-spacing: 0.16em; text-transform: uppercase;
          margin-bottom: 16px;
        }
        .about-col.before .about-col-tag { color: #a08a5e; }
        .about-col.after .about-col-tag { color: #b1790a; }
        .about-list { list-style: none; display: flex; flex-direction: column; gap: 11px; }
        .about-list li {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; line-height: 1.5; padding-left: 24px; position: relative;
        }
        .about-list.before-list li { color: #8a7c63; }
        .about-list.before-list li::before {
          content: "x"; position: absolute; left: 0; top: 0;
          color: #b9a884; font-size: 12px;
        }
        .about-list.after-list li { color: #2c2c2c; }
        .about-list.after-list li::before {
          content: ""; position: absolute; left: 0; top: 4px;
          width: 14px; height: 14px; border-radius: 50%; background: #b1790a;
          -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 7.5l2.5 2.5L11 4.5' stroke='black' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 7.5l2.5 2.5L11 4.5' stroke='black' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
        }
        .about-arrow { display: flex; align-items: center; justify-content: center; }

        .about-stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
          padding: 24px 0;
          border-top: 1px solid rgba(177,121,10,0.18);
          border-bottom: 1px solid rgba(177,121,10,0.18);
          margin-bottom: 32px;
        }
        .about-stat { text-align: center; display: flex; flex-direction: column; gap: 6px; }
        .about-stat-num {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(24px, 2.8vw, 34px);
          color: #0d0d0d; letter-spacing: -0.02em; line-height: 1;
        }
        .about-stat-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px; color: #777; letter-spacing: 0.02em;
        }

        .about-lockup {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          text-align: center;
        }
        .about-lockup-line { width: 40px; height: 2px; background: #b1790a; border-radius: 2px; margin-bottom: 4px; }
        .about-lockup-prefix {
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px; color: #888; letter-spacing: 0.04em;
        }
        .about-lockup-link {
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
          transition: transform 0.3s ease;
        }
        .about-lockup-link:hover {
          transform: translateY(-3px);
        }
        .about-lockup-logo {
          height: 42px; width: auto; display: block;
        }
        .about-lockup-caption {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: #888; margin-top: 0;
        }

        @media (max-width: 760px) {
          .about-transform { grid-template-columns: 1fr; }
          .about-arrow { transform: rotate(90deg); margin: 4px auto; }
          .about-stats { grid-template-columns: repeat(2, 1fr); gap: 28px 12px; }
          .about-watermark { width: 240px; left: 50%; top: 48%; transform: translate(-50%, -50%); }
        }

        /* -- ABOUT DRIFTING STRIP -- */
        .about-strip {
          position: relative; overflow: hidden;
          margin: 0 0 36px; padding: 8px 0;
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.7s ease 0.1s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s;
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%);
        }
        .about-inner.is-visible .about-strip { opacity: 1; transform: none; }
        .about-strip-track {
          display: flex; gap: 24px; width: max-content;
          animation: aboutDrift 36s linear infinite;
        }
        .about-strip:hover .about-strip-track { animation-play-state: paused; }
        .about-strip-item {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          flex-shrink: 0; width: 104px;
          transition: transform 0.3s ease;
        }
        .about-strip-item img {
          width: 78px; height: 78px;
          border-radius: 18px;
          background: linear-gradient(158deg, #fdfaf3 0%, #f4ecdb 100%);
          border: 1px solid rgba(177,121,10,0.22);
          padding: 12px; object-fit: contain;
          transition: box-shadow 0.3s ease;
        }
        .about-strip-item span {
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #b1790a;
          white-space: nowrap;
        }
        .about-strip-item:hover { transform: translateY(-4px); }
        .about-strip-item:hover img { box-shadow: 0 10px 26px rgba(120,80,10,0.12); }
        @keyframes aboutDrift {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) { .about-strip-track { animation: none; } }
        @media (max-width: 760px) {
          .about-strip-item { width: 100px; }
          .about-strip-item img { width: 76px; height: 76px; border-radius: 14px; padding: 9px; }
          .about-strip-item span { font-size: 11px; }
          .about-strip { margin-bottom: 40px; }
        }

        /* -- CONTACT SECTION -- */
        .contact-section {
          background: #f0ebe0;
          padding: 64px 24px 56px;
        }
        .contact-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: #b1790a;
        }
        .contact-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(28px, 3.2vw, 42px);
          line-height: 1.1; letter-spacing: -0.03em; color: #0d0d0d;
          margin: 12px 0 14px;
        }
        .contact-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(15px, 1.4vw, 17px);
          line-height: 1.6; color: #555; max-width: 420px; margin-bottom: 32px;
        }
        .contact-card {
          display: flex; align-items: center; gap: 16px;
          background: linear-gradient(158deg, #fdfaf3 0%, #f7f0e2 100%);
          border: 1px solid rgba(177,121,10,0.25);
          border-radius: 16px; padding: 14px 16px;
          text-decoration: none;
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .contact-card:hover {
          transform: translateY(-3px);
          border-color: rgba(177,121,10,0.5);
          box-shadow: 0 12px 30px rgba(120,80,10,0.10);
        }
        .contact-card-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          background: rgba(177,121,10,0.08);
          border: 1px solid rgba(177,121,10,0.18);
          display: flex; align-items: center; justify-content: center;
        }
        .contact-card-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow: visible; }
        .contact-card-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
          text-transform: uppercase; color: #b1790a;
        }
        .contact-card-value {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #1a1a1a; font-weight: 500;
          line-height: 1.4;
          white-space: nowrap;
          overflow: visible;
          text-overflow: clip;
          max-width: 100%;
        }

        /* CONTACT REDESIGN */
        .contact-redesign {
          max-width: 1100px; margin: 0 auto 44px;
          display: grid; grid-template-columns: 1fr 1.2fr; gap: 48px;
          align-items: start;
        }
        .contact-left { display: flex; flex-direction: column; gap: 0; }
        .contact-left .contact-title { margin: 12px 0 14px; }
        .contact-cards-stack { display: flex; flex-direction: column; gap: 12px; margin-top: 28px; }
        .contact-cards-stack .contact-card { width: 100%; }
        .contact-right { position: sticky; top: 80px; }
        .contact-form-card {
          background: linear-gradient(158deg, #fdfaf3 0%, #f7f0e2 100%);
          border: 1px solid rgba(177,121,10,0.28);
          border-radius: 22px;
          padding: 32px 28px;
          box-shadow: 0 8px 32px rgba(120,80,10,0.08);
        }
        .contact-form-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(20px, 2.2vw, 26px);
          color: #0d0d0d; letter-spacing: -0.02em; margin-bottom: 8px;
        }
        .contact-form-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #777; line-height: 1.5; margin-bottom: 24px;
        }
        .contact-form { display: flex; flex-direction: column; gap: 16px; }
        .contact-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .contact-form-field { display: flex; flex-direction: column; gap: 6px; }
        .contact-form-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 600; color: #555;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .contact-form-input {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #111;
          background: rgba(255,255,255,0.85);
          border: 1.5px solid rgba(177,121,10,0.25);
          border-radius: 10px; padding: 11px 14px;
          outline: none; width: 100%;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .contact-form-input:focus {
          border-color: #b1790a;
          box-shadow: 0 0 0 3px rgba(177,121,10,0.10);
        }
        .contact-form-input::placeholder { color: #bbb; }
        .contact-form-select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23b1790a' strokeWidth='1.4' fill='none' strokeLinecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; }
        .contact-form-textarea { resize: vertical; min-height: 100px; }
        .contact-form-btn {
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 500; color: #fff;
          background: #0d0d0d; border: none; cursor: pointer;
          padding: 14px 28px; border-radius: 9999px; width: 100%;
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .contact-form-btn:hover:not(:disabled) { background: #b1790a; transform: translateY(-2px); }
        .contact-form-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .contact-form-error {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: #c0392b; text-align: center;
        }
        .contact-field-error {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; color: #c0392b;
          margin-top: 3px; display: block;
        }
        .contact-field-count {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; color: #aaa;
          text-align: right; display: block; margin-top: 3px;
        }
        .contact-form-input.has-error {
          border-color: #c0392b;
          box-shadow: 0 0 0 3px rgba(192,57,43,0.08);
        }
        .contact-form-success-banner {
          display: flex; align-items: flex-start; gap: 10px;
          background: linear-gradient(158deg, #fdfaf3 0%, #f4ecdb 100%);
          border: 1px solid rgba(177,121,10,0.35);
          border-radius: 12px; padding: 14px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #5a4020; line-height: 1.5;
          margin-top: 4px;
        }
        .contact-form-success-banner svg { flex-shrink: 0; margin-top: 1px; }
        .contact-form-success {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; text-align: center; padding: 32px 16px;
        }
        .contact-form-success h4 {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: 22px; color: #0d0d0d;
        }
        .contact-form-success p {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #666; line-height: 1.6; max-width: 280px;
        }
        .contact-map-banner {
          max-width: 1100px; margin: 0 auto;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
        }
        .contact-map-banner img {
          width: 100%; display: block;
          height: 220px;
          object-fit: cover;
          object-position: center;
          border-radius: 22px;
          border: 1px solid rgba(177,121,10,0.2);
          box-shadow: 0 16px 44px rgba(120,80,10,0.10);
          -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
          mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
        }
        .contact-map-caption {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: #888; text-align: center;
        }
        @media (max-width: 860px) {
          .contact-redesign { grid-template-columns: 1fr; gap: 32px; }
          .contact-right { position: static; }
          .contact-form-row { grid-template-columns: 1fr; }
        }
        @media (max-width: 760px) {
          .contact-card-body { min-width: 0; }
          .contact-card-value { font-size: clamp(8.2px, 2.25vw, 11px); white-space: nowrap; overflow: visible; text-overflow: clip; max-width: 100%; }
          .contact-map-banner img { height: 160px; }
        }
        @media (max-width: 640px) {
          .contact-form-card { padding: 24px 18px; }
        }

        @media (max-width: 640px) {
          .problem-section { padding: 44px 16px; }
          .problem-cards { grid-template-columns: 1fr; }
          .problem-inner { gap: 26px; }
          .problem-card-panel { grid-template-columns: minmax(0, 1fr) 72px; min-height: 146px; padding: 16px; }
          .problem-card-visual { width: 68px; height: 68px; }
          .problem-card-visual svg { width: 46px; height: 46px; }
          .problem-card-footer { padding: 10px 14px 12px; }
        }

        /* FINAL CTA */
        .cta-section {
          position: relative;
          background: linear-gradient(158deg, #fdf6e8 0%, #f3e6c9 100%);
          padding: 88px 24px 96px;
          overflow: hidden;
        }
        .cta-glow {
          position: absolute; top: -40%; left: 50%; transform: translateX(-50%);
          width: 700px; height: 500px;
          background: radial-gradient(circle, rgba(177,121,10,0.14) 0%, transparent 65%);
          pointer-events: none;
        }
        .cta-inner {
          position: relative; z-index: 1;
          max-width: 680px; margin: 0 auto; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }
        .cta-eyebrow {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.18em; text-transform: uppercase; color: #b1790a;
        }
        .cta-title {
          font-family: 'Lora', 'ui-serif', Georgia, serif; font-weight: 400;
          font-size: clamp(30px, 3.8vw, 48px);
          line-height: 1.1; letter-spacing: -0.03em; color: #0d0d0d;
        }
        .cta-sub {
          font-family: 'DM Sans', sans-serif;
          font-size: clamp(15px, 1.5vw, 17px);
          line-height: 1.6; color: #5a4f3a; max-width: 440px;
        }
        .cta-button {
          margin-top: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 500; color: #fff;
          background: #0d0d0d; padding: 16px 36px; border-radius: 9999px;
          text-decoration: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.16);
          transition: background 0.25s ease, transform 0.25s ease;
        }
        .cta-button:hover { background: #b1790a; transform: translateY(-3px); }
        .cta-note {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; color: #8a7c5e; margin-top: 4px;
        }

        /* FOOTER */
        .footer {
          background: #16130d;
          padding: 64px 24px 32px;
          color: #e8e2d4;
        }
        .footer-top {
          max-width: 1040px; margin: 0 auto;
          display: grid; grid-template-columns: 1.6fr 1fr 1fr 1.2fr;
          gap: 40px; padding-bottom: 48px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .footer-logo { display: flex; align-items: center; margin-bottom: 16px; }
        .footer-logo img { width: 170px; height: auto; object-fit: contain; }
        .footer-blurb {
          font-family: 'DM Sans', sans-serif;
          font-size: 13.5px; line-height: 1.65; color: #a89f8c; max-width: 280px;
        }
        .footer-col { display: flex; flex-direction: column; gap: 12px; }
        .footer-powered { align-items: center; text-align: center; }
        .footer-col-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: 0.14em;
          text-transform: uppercase; color: #8a8270; margin-bottom: 4px;
        }
        .footer-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #d8d1c2; text-decoration: none;
          transition: color 0.2s ease;
        }
        .footer-link:hover { color: #f0b84a; }
        .footer-paymaster {
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent; border-radius: 0; padding: 0;
          width: fit-content;
          transition: transform 0.25s ease;
        }
        .footer-paymaster:hover { transform: translateY(-2px); }
        .footer-paymaster img { height: 42px; width: auto; display: block; }
        .footer-bottom {
          max-width: 1040px; margin: 0 auto; padding-top: 24px;
          display: flex; justify-content: center; text-align: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 12.5px; color: #8a8270;
        }
        @media (max-width: 860px) {
          .footer-top { grid-template-columns: 1fr 1fr; gap: 32px; }
        }
        @media (max-width: 520px) {
          .footer-top { grid-template-columns: 1fr; }
          .footer-bottom { flex-direction: column; text-align: center; align-items: center; }
        }

        /* MOBILE MENU */
        .nav-burger {
          display: none;
          flex-direction: column; justify-content: center; gap: 5px;
          width: 42px; height: 42px; padding: 10px;
          background: transparent; border: none; cursor: pointer;
          border-radius: 10px;
        }
        .nav-burger span {
          display: block; height: 2px; width: 100%;
          background: #0d0d0d; border-radius: 2px;
        }
        .mobile-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: #f7f2e8;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 36px;
          opacity: 0; visibility: hidden;
          transform: translateY(-12px);
          transition: opacity 0.32s ease, transform 0.32s ease, visibility 0.32s;
        }
        .mobile-overlay.open { opacity: 1; visibility: visible; transform: translateY(0); }
        .mobile-close {
          position: absolute; top: 22px; right: 22px;
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(177,121,10,0.08); border: 1px solid rgba(177,121,10,0.2);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .mobile-links {
          display: flex; flex-direction: column; align-items: center; gap: 22px;
        }
        .mobile-links a {
          font-family: 'Lora', 'ui-serif', Georgia, serif;
          font-size: 26px; color: #0d0d0d; text-decoration: none;
          letter-spacing: -0.02em;
          transition: color 0.2s ease;
        }
        .mobile-links a:hover { color: #b1790a; }
        .mobile-actions {
          display: flex; flex-direction: column; align-items: center; gap: 14px; width: 80%;
          max-width: 300px;
        }
        .mobile-login {
          width: 100%; text-align: center;
          font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600;
          color: #b1790a; text-decoration: none;
          padding: 13px; border: 1.5px solid rgba(177,121,10,0.45); border-radius: 9999px;
        }
        .mobile-cta {
          width: 100%; text-align: center;
          font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
          color: #fff; background: #0d0d0d; text-decoration: none;
          padding: 14px; border-radius: 9999px;
        }
        @media (max-width: 860px) {
          .nav-center { display: none !important; }
          .nav-right { display: none !important; }
          .nav-burger { display: flex; }
        }
        @media (min-width: 861px) {
          .mobile-overlay { display: none; }
        }
      `}</style>

      {/* NAVBAR - Craft exact pill */}
      <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
        <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <div className="nav-logo-svg">
            <img src={mehmanMark} alt="Mehman" className="nav-logo-img" />
          </div>
        </a>
        <div className="nav-center">
          <div className="nav-dropdown-wrap">
            <a href="#product" className="nav-link nav-dropdown-btn" onClick={handleAnchorClick}>
              Features
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginLeft:'4px'}}>
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <div className="nav-dropdown">
              <a href="#visitor" className="nav-dropdown-item" onClick={handleAnchorClick}>
                <span className="nav-dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#111" strokeWidth="1.3"/><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="#111" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </span>
                <div><div className="nav-dropdown-label">Visitor Management</div><div className="nav-dropdown-desc">Track every entry and exit</div></div>
              </a>
              <a href="#sos" className="nav-dropdown-item" onClick={handleAnchorClick}>
                <span className="nav-dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#111" strokeWidth="1.3"/><path d="M8 5v4M8 11v.5" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </span>
                <div><div className="nav-dropdown-label">SOS Emergency Alert</div><div className="nav-dropdown-desc">1-tap emergency response</div></div>
              </a>
              <a href="#qr" className="nav-dropdown-item" onClick={handleAnchorClick}>
                <span className="nav-dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="#111" strokeWidth="1.3"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="#111" strokeWidth="1.3"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="#111" strokeWidth="1.3"/><rect x="9" y="9" width="2" height="2" fill="#111"/><rect x="13" y="9" width="2" height="2" fill="#111"/><rect x="9" y="13" width="2" height="2" fill="#111"/><rect x="13" y="13" width="2" height="2" fill="#111"/></svg>
                </span>
                <div><div className="nav-dropdown-label">QR Code Entry</div><div className="nav-dropdown-desc">Contactless gate access</div></div>
              </a>
              <a href="#guard" className="nav-dropdown-item" onClick={handleAnchorClick}>
                <span className="nav-dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L3 4.5V8c0 3 2.5 5 5 5.5C11.5 13 14 11 14 8V4.5L8 2z" stroke="#111" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                </span>
                <div><div className="nav-dropdown-label">Guard Management</div><div className="nav-dropdown-desc">Duty logs and shift tracking</div></div>
              </a>
              <a href="#admin" className="nav-dropdown-item" onClick={handleAnchorClick}>
                <span className="nav-dropdown-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="#111" strokeWidth="1.3"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="#111" strokeWidth="1.3"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="#111" strokeWidth="1.3"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="#111" strokeWidth="1.3"/></svg>
                </span>
                <div><div className="nav-dropdown-label">Admin Dashboard</div><div className="nav-dropdown-desc">Full premises overview</div></div>
              </a>
            </div>
          </div>
          <a href="#how" className="nav-link" onClick={handleAnchorClick}>How It Works</a>
          <a href="#pricing" className="nav-link" onClick={handleAnchorClick}>Pricing</a>
          <a href="#about" className="nav-link" onClick={handleAnchorClick}>About Us</a>
          <a href="#contact" className="nav-link" onClick={handleAnchorClick}>Contact</a>
        </div>
        <div className="nav-right">
          <button type="button" className="nav-login" onClick={onContinue}>Log in</button>
          <a href="#contact" className="nav-cta" onClick={handleAnchorClick}>Start Free Trial</a>
        </div>
        <button className="nav-burger" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <span /><span /><span />
        </button>
      </nav>

      <div className={"mobile-overlay" + (menuOpen ? " open" : "")}>
        <button className="mobile-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#0d0d0d" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
        <nav className="mobile-links">
          <a href="#product" onClick={(e) => { setMenuOpen(false); handleAnchorClick(e); }}>Features</a>
          <a href="#pricing" onClick={(e) => { setMenuOpen(false); handleAnchorClick(e); }}>Pricing</a>
          <a href="#how" onClick={(e) => { setMenuOpen(false); handleAnchorClick(e); }}>How It Works</a>
          <a href="#about" onClick={(e) => { setMenuOpen(false); handleAnchorClick(e); }}>About Us</a>
          <a href="#contact" onClick={(e) => { setMenuOpen(false); handleAnchorClick(e); }}>Contact</a>
        </nav>
        <div className="mobile-actions">
          <button type="button" className="mobile-login" onClick={() => { setMenuOpen(false); onContinue?.(); }}>Log in</button>
          <a href="#contact" className="mobile-cta" onClick={(e) => { setMenuOpen(false); handleAnchorClick(e); }}>Start Free Trial</a>
        </div>
      </div>

      {/* HERO PANEL - rounded card, sky bg, text + screenshot */}
      <div className="hero-panel">

        {/* Sky background - full bleed, object-cover */}
        <img
          src={heroEntrance}
          alt=""
          className="hero-bg-img"
          aria-hidden="true"
          draggable="false"
        />

        {/* Tint overlay */}
        <div className="hero-overlay" aria-hidden="true" />

        {/* Headline + CTA - floating above screenshot */}
        <div className="hero-text-block">
          <h1 className="hero-headline">
            Your gate,<br />finally smart.
          </h1>
          <p className="hero-subheadline">
            India's most affordable security for societies and businesses. Visitor passes,
            <br className="hero-sub-break" /> instant SOS alerts, and live tracking,
            <span className="hero-sub-accent"> from just ₹0.50 a day.</span>
          </p>
          <a href="#contact" className="hero-btn" onClick={handleAnchorClick}>Start 10-Day Free Trial</a>
        </div>

        {/* App screenshot - no frame, bleeds off bottom */}
        <div className="hero-screenshot-wrap">
          <div className="mac-window">
            <div className="mac-titlebar">
              <span className="mac-dot mac-dot-r" />
              <span className="mac-dot mac-dot-y" />
              <span className="mac-dot mac-dot-g" />
              <div className="mac-url">mehman.net.in</div>
            </div>
            <img
              src={dashboardHero}
              alt="Mehman dashboard"
              className="hero-screenshot"
              draggable="false"
            />
          </div>
        </div>

      </div>

      {/* SOCIAL PROOF MARQUEE */}
      <div className="proof-bar">
        <span className="proof-label">Trusted by societies and businesses across India</span>
        <div className="proof-marquee">
          <div className="proof-marquee-track">
            <span className="proof-item">&#127970; Gated communities</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127961;&#65039; Apartment societies</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127970; Corporate offices</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127980; Commercial complexes</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127981; Corporate parks</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127970; Gated communities</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127961;&#65039; Apartment societies</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127970; Corporate offices</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127980; Commercial complexes</span>
            <span className="proof-sep">•</span>
            <span className="proof-item">&#127981; Corporate parks</span>
            <span className="proof-sep">•</span>
          </div>
        </div>
        <span className="proof-stat">100+ properties secured</span>
      </div>
      {/* PROBLEM STATEMENT */}
      <div className="problem-section">
        <div className="problem-inner">
          <span className="problem-eyebrow">THE PROBLEM</span>
          <h2 className="problem-headline">
            Your premises are still running<br/>on a paper register.
          </h2>
          <div className="problem-cards">
            <div className="problem-card">
              <div className="problem-card-panel" style={{"--progress": "18%"}}>
                <div className="problem-card-copy">
                  <span className="problem-badge">Manual</span>
                  <h3 className="problem-card-title">Paper register chaos</h3>
                  <p className="problem-card-text">Every visitor entry is handwritten, hard to search, and easy to miss during busy hours at any gate or reception.</p>
                  <div className="problem-card-meta">
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2.5h8v9H3z" stroke="#111" strokeWidth="1.2"/><path d="M5 5h4M5 7.5h3" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Slow logs
                    </span>
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      No search
                    </span>
                  </div>
                </div>
                <div className="problem-card-visual" aria-hidden="true">
                  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="22" y="12" width="34" height="48" rx="5" fill="#fff7f9" stroke="#111" strokeWidth="2"/>
                    <path d="M30 25h18M30 34h14M30 43h18" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M50 53l12 12" stroke="#111" strokeWidth="3" strokeLinecap="round"/>
                    <circle cx="47" cy="50" r="10" fill="#ff5f57" stroke="#111" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="problem-progress-row">
                  <div className="problem-progress-labels"><span>Digital readiness</span><span>18%</span></div>
                  <div className="problem-progress-track"><span className="problem-progress-fill"/></div>
                </div>
              </div>
              <div className="problem-card-footer">
                <span className="problem-card-footer-text">Risk: missing visitor records</span>
                <a href="#visitor" className="problem-card-action" onClick={handleAnchorClick}>Solve</a>
              </div>
            </div>
            <div className="problem-card">
              <div className="problem-card-panel" style={{"--progress": "24%"}}>
                <div className="problem-card-copy">
                  <span className="problem-badge">Frequent</span>
                  <h3 className="problem-card-title">Constant interruptions</h3>
                  <p className="problem-card-text">Residents and staff get repeated calls for guests, cabs, vendors, and delivery approvals throughout the day.</p>
                  <div className="problem-card-meta">
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="1.5" width="6" height="11" rx="1.5" stroke="#111" strokeWidth="1.2"/><path d="M6 4.5h2" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Gate calls
                    </span>
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v5l3 2" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/><circle cx="7" cy="7" r="5" stroke="#111" strokeWidth="1.2"/></svg>
                      Daily delays
                    </span>
                  </div>
                </div>
                <div className="problem-card-visual" aria-hidden="true">
                  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="27" y="10" width="26" height="52" rx="7" fill="#f7feff" stroke="#111" strokeWidth="2"/>
                    <path d="M34 23h12M34 32h9" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="40" cy="52" r="3" fill="#111"/>
                    <path d="M57 24c5 5 5 16 0 21M63 18c8 8 8 25 0 33" stroke="#2d78df" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="problem-progress-row">
                  <div className="problem-progress-labels"><span>Daily peace</span><span>24%</span></div>
                  <div className="problem-progress-track"><span className="problem-progress-fill"/></div>
                </div>
              </div>
              <div className="problem-card-footer">
                <span className="problem-card-footer-text">Impact: constant interruptions</span>
                <a href="#visitor" className="problem-card-action" onClick={handleAnchorClick}>Fix</a>
              </div>
            </div>
            <div className="problem-card">
              <div className="problem-card-panel" style={{"--progress": "14%"}}>
                <div className="problem-card-copy">
                  <span className="problem-badge">Unverified</span>
                  <h3 className="problem-card-title">Unchecked visitors at the gate</h3>
                  <p className="problem-card-text">Guests, contractors, and vendors enter offices and complexes without ID checks, photos, or a verified record.</p>
                  <div className="problem-card-meta">
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="#111" strokeWidth="1.2"/><path d="M2.5 12c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      No ID check
                    </span>
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="10" height="8" rx="1.5" stroke="#111" strokeWidth="1.2"/><circle cx="7" cy="7" r="2" stroke="#111" strokeWidth="1.2"/></svg>
                      No photo
                    </span>
                  </div>
                </div>
                <div className="problem-card-visual" aria-hidden="true">
                  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="40" cy="30" r="12" fill="#fffde8" stroke="#111" strokeWidth="2"/>
                    <path d="M20 64c0-11 9-18 20-18s20 7 20 18" fill="#fffde8" stroke="#111" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="58" cy="52" r="10" fill="#ff5f57" stroke="#111" strokeWidth="2"/>
                    <path d="M55 52h6M58 49v6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="problem-progress-row">
                  <div className="problem-progress-labels"><span>Verified entries</span><span>14%</span></div>
                  <div className="problem-progress-track"><span className="problem-progress-fill"/></div>
                </div>
              </div>
              <div className="problem-card-footer">
                <span className="problem-card-footer-text">Risk: anyone can walk in</span>
                <a href="#qr" className="problem-card-action" onClick={handleAnchorClick}>Verify</a>
              </div>
            </div>
            <div className="problem-card">
              <div className="problem-card-panel" style={{"--progress": "8%"}}>
                <div className="problem-card-copy">
                  <span className="problem-badge">Critical</span>
                  <h3 className="problem-card-title">No SOS response layer</h3>
                  <p className="problem-card-text">When something goes wrong, people and guards need a fast alert path, not a phone chain.</p>
                  <div className="problem-card-meta">
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="#111" strokeWidth="1.2"/><path d="M7 4v3M7 9.5v.2" stroke="#111" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      Emergency
                    </span>
                    <span className="problem-meta-item">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.8v2M7 10.2v2M12.2 7h-2M3.8 7h-2M10.7 3.3L9.3 4.7M4.7 9.3l-1.4 1.4M10.7 10.7L9.3 9.3M4.7 4.7L3.3 3.3" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Slow alert
                    </span>
                  </div>
                </div>
                <div className="problem-card-visual" aria-hidden="true">
                  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="40" cy="40" r="26" fill="#f5fff4" stroke="#111" strokeWidth="2"/>
                    <path d="M40 23v22" stroke="#111" strokeWidth="5" strokeLinecap="round"/>
                    <circle cx="40" cy="55" r="3.5" fill="#111"/>
                    <path d="M20 18l10 10M60 18L50 28M20 62l10-10M60 62L50 52" stroke="#28c840" strokeWidth="4" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="problem-progress-row">
                  <div className="problem-progress-labels"><span>Emergency readiness</span><span>8%</span></div>
                  <div className="problem-progress-track"><span className="problem-progress-fill"/></div>
                </div>
              </div>
              <div className="problem-card-footer">
                <span className="problem-card-footer-text">Need: instant SOS escalation</span>
                <a href="#sos" className="problem-card-action" onClick={handleAnchorClick}>Alert</a>
              </div>
            </div>
          </div>
          <div className="problem-resolution">
            <span className="problem-resolution-text">There is a better way.</span>
            <a href="#product" className="problem-resolution-link" onClick={handleAnchorClick}>See how Mehman solves this →</a>
          </div>
        </div>
      </div>

      {/* -- FEATURES (matches navbar dropdown) -- */}
      <section className="feat-section" id="product">
        <div className="feat-head">
          <span className="feat-eyebrow">EVERYTHING YOUR GATE NEEDS</span>
          <h2 className="feat-title">Everything clicks at the gate.</h2>
          <p className="feat-sub">From visitor passes to emergency SOS, Mehman covers every part of premises security for societies and businesses alike, without the complexity.</p>
        </div>

        <div className="feat-row" id="visitor">
          <div className="feat-copy">
            <span className="feat-tag">VISITOR MANAGEMENT</span>
            <h3 className="feat-heading">Every visitor, logged and approved.</h3>
            <p className="feat-text">Guests, cabs, and deliveries are sent to residents or employees for one-tap approval. No more guard phone calls, no more guesswork at the gate, just a clean, searchable record of who came in and when.</p>
            <ul className="feat-list">
              <li>One-tap approve or reject</li>
              <li>Searchable entry &amp; exit history</li>
            </ul>
          </div>
          <div className="feat-shot">
            <div className="shot-glow" aria-hidden="true" />
            <div className="shot-frame"><span className="shot-cam" aria-hidden="true" /><img src={shotVisitor} alt="Visitor approval inbox" draggable="false" /></div>
          </div>
        </div>

        <div className="feat-row reverse" id="sos">
          <div className="feat-copy">
            <span className="feat-tag">SOS EMERGENCY ALERT</span>
            <h3 className="feat-heading">Help is one tap away.</h3>
            <p className="feat-text">A single tap raises an instant SOS to guards and admins, built for the safety of residents, employees, children, and seniors. The fastest way to get help when every second matters.</p>
            <ul className="feat-list">
              <li>Instant one-tap emergency alert</li>
              <li>Reaches guards &amp; admin together</li>
            </ul>
          </div>
          <div className="feat-shot">
            <div className="shot-glow" aria-hidden="true" />
            <div className="shot-frame"><span className="shot-cam" aria-hidden="true" /><img src={shotSos} alt="SOS emergency alert" draggable="false" /></div>
          </div>
        </div>

        <div className="feat-row" id="qr">
          <div className="feat-copy">
            <span className="feat-tag">QR CODE ENTRY</span>
            <h3 className="feat-heading">Contactless, forgery-proof access.</h3>
            <p className="feat-text">Residents and employees share a QR pass with guests; guards scan it at the gate and capture the visitor's photo on entry. Every check-in and exit is recorded automatically, faster than a register, and impossible to fake.</p>
            <ul className="feat-list">
              <li>Photo captured &amp; registered on entry</li>
              <li>Auto-timestamped, tamper-proof</li>
            </ul>
          </div>
          <div className="feat-shot">
            <div className="shot-glow" aria-hidden="true" />
            <div className="shot-frame"><span className="shot-cam" aria-hidden="true" /><img src={shotQr} alt="QR code scan" draggable="false" /></div>
          </div>
        </div>

        <div className="feat-row reverse" id="guard">
          <div className="feat-copy">
            <span className="feat-tag">GUARD MANAGEMENT</span>
            <h3 className="feat-heading">Your guards, fully equipped.</h3>
            <p className="feat-text">Guards get a focused app to scan passes, verify deliveries, and log every movement at the gate, with shift and duty tracking that replaces the paper register entirely.</p>
            <ul className="feat-list">
              <li>Live visitor &amp; delivery log</li>
              <li>Shift and duty tracking</li>
            </ul>
          </div>
          <div className="feat-shot">
            <div className="shot-glow" aria-hidden="true" />
            <div className="shot-frame"><span className="shot-cam" aria-hidden="true" /><img src={shotGuard} alt="Guard dashboard" draggable="false" /></div>
          </div>
        </div>

        <div className="feat-row" id="admin">
          <div className="feat-copy">
            <span className="feat-tag">ADMIN DASHBOARD</span>
            <h3 className="feat-heading">Your whole premises, one screen.</h3>
            <p className="feat-text">Admins get complete oversight of every entry, every unit, and every alert, with records they can search and export anytime. Full control, zero spreadsheets.</p>
            <ul className="feat-list">
              <li>Property-wide visibility</li>
              <li>Searchable, exportable records</li>
            </ul>
          </div>
          <div className="feat-shot">
            <div className="shot-glow" aria-hidden="true" />
            <div className="shot-frame"><span className="shot-cam" aria-hidden="true" /><img src={shotAdmin} alt="Admin dashboard" draggable="false" /></div>
          </div>
        </div>

        <div className="more-feat">
          <div className="more-head">
            <span className="more-eyebrow">AND EVERYTHING ELSE A PROPERTY NEEDS</span>
            <h3 className="more-title">More built right in.</h3>
          </div>
          <div className="more-grid">
            <div className="more-card">
              <div className="more-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="5" width="16" height="12" rx="2" stroke="#b1790a" strokeWidth="1.4"/><path d="M3 9h16" stroke="#b1790a" strokeWidth="1.4"/><path d="M6 13h4" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <h4 className="more-card-title">Maintenance Billing</h4>
              <p className="more-card-text">Send bills to selected units, verify payments, and deny with notes.</p>
            </div>
            <div className="more-card">
              <div className="more-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 3v9l5 3" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 11h3M15 11h3M11 18v-2" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round"/><rect x="7" y="8" width="8" height="9" rx="1.5" stroke="#b1790a" strokeWidth="1.4"/></svg>
              </div>
              <h4 className="more-card-title">Voting System</h4>
              <p className="more-card-text">Admins create polls with limits; residents and staff vote privately.</p>
            </div>
            <div className="more-card">
              <div className="more-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="4" width="16" height="14" rx="2" stroke="#b1790a" strokeWidth="1.4"/><circle cx="8" cy="10" r="2" stroke="#b1790a" strokeWidth="1.4"/><path d="M13 8h4M13 11h3M6 15h7" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <h4 className="more-card-title">Maid / Driver IDs</h4>
              <p className="more-card-text">Issue staff ID cards; guards verify check-in and check-out.</p>
            </div>
            <div className="more-card">
              <div className="more-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="10" cy="10" r="6" stroke="#b1790a" strokeWidth="1.4"/><path d="M14.5 14.5L18 18" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <h4 className="more-card-title">Audit Trail</h4>
              <p className="more-card-text">Search history by pass ID, guest, unit, host, vehicle, or date.</p>
            </div>
            <div className="more-card">
              <div className="more-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 18V8l5-3 5 3v10M14 18V10l4-2v10" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 18h16" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </div>
              <h4 className="more-card-title">Multi-Tower Support</h4>
              <p className="more-card-text">Manage multiple towers, blocks, and gates under one account.</p>
            </div>
            <div className="more-card">
              <div className="more-icon">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6h12v8H3z" stroke="#b1790a" strokeWidth="1.4" strokeLinejoin="round"/><path d="M15 9h2.5L20 11.5V14h-5" stroke="#b1790a" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="6.5" cy="15.5" r="1.6" stroke="#b1790a" strokeWidth="1.4"/><circle cx="15.5" cy="15.5" r="1.6" stroke="#b1790a" strokeWidth="1.4"/></svg>
              </div>
              <h4 className="more-card-title">Delivery Management</h4>
              <p className="more-card-text">Residents and staff approve courier and delivery arrivals from the inbox.</p>
            </div>
          </div>
        </div>
      </section>

      {/* -- HOW IT WORKS -- */}
      <section className="how-section" id="how" ref={howRef}>
        <div className="how-head">
          <span className="how-eyebrow">HOW IT WORKS</span>
          <h2 className="how-title">A clean path from invite to exit.</h2>
          <p className="how-sub">Three simple steps keep every visit fast at the gate and fully accountable for any premises.</p>
        </div>

        <div className={"how-flow" + (howVisible ? " is-visible" : "")}>
          <div className="how-line" aria-hidden="true"><span className="how-line-fill" /></div>

          <div className="how-step" style={{ "--d": "0s" }}>
            <div className="how-icon">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M13 5v16M5 13h16" stroke="#b1790a" strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="13" cy="13" r="11" stroke="#b1790a" strokeWidth="1.4"/>
              </svg>
            </div>
            <span className="how-num">01</span>
            <h3 className="how-step-title">Invite</h3>
            <p className="how-step-text">Create a visitor pass with timing, purpose, host, unit, and vehicle details.</p>
          </div>

          <div className="how-arrow" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11h13m0 0l-5-5m5 5l-5 5" stroke="#b1790a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>

          <div className="how-step" style={{ "--d": "0.18s" }}>
            <div className="how-icon">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M13 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" stroke="#b1790a" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M9.5 13l2.2 2.2L16.5 10" stroke="#b1790a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="how-num">02</span>
            <h3 className="how-step-title">Verify</h3>
            <p className="how-step-text">Security sees identity, approval state, visit window, and the expected host at the gate.</p>
          </div>

          <div className="how-arrow" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11h13m0 0l-5-5m5 5l-5 5" stroke="#b1790a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>

          <div className="how-step" style={{ "--d": "0.36s" }}>
            <div className="how-icon">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <rect x="5" y="3" width="16" height="20" rx="2.5" stroke="#b1790a" strokeWidth="1.4"/>
                <path d="M9 9h8M9 13h8M9 17h5" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="how-num">03</span>
            <h3 className="how-step-title">Record</h3>
            <p className="how-step-text">Every entry, rejection, extension, and exit stays searchable for admins.</p>
          </div>
        </div>
      </section>

      {/* -- PRICING -- */}
      <section className="price-section" id="pricing">
        <div className="price-head">
          <span className="price-eyebrow">SIMPLE, HONEST PRICING</span>
          <h2 className="price-title">India's most affordable premises security.</h2>
          <p className="price-sub">No setup fees. No hidden charges. Complete security for societies and businesses, for less than the cost of a cup of chai.</p>
        </div>

        <div className="price-card">
          <div className="price-card-glow" aria-hidden="true" />
          <div className="price-card-grid">
            <div className="price-visual">
              <img src={chaiCompare} alt="A cup of chai versus complete premises security" draggable="false" />
              <div className="price-visual-labels">
                <span className="price-visual-label">A cup of chai<br/><strong>₹15 / day</strong></span>
                <span className="price-visual-label">Mehman security<br/><strong>₹0.50 / day</strong></span>
              </div>
            </div>

            <div className="price-details">
              <div className="price-amount-block">
                <span className="price-currency">₹</span>
                <span className="price-amount">0.50</span>
                <span className="price-period">/ unit / day</span>
              </div>
              <p className="price-chai">Less than a cup of chai, for your whole premises' safety.</p>

              <div className="price-divider" />

              <ul className="price-includes">
                <li>Unlimited visitor passes &amp; QR entry</li>
                <li>One-tap SOS emergency alerts</li>
                <li>Resident, Employee, Guard &amp; Admin apps</li>
                <li>Searchable digital entry records</li>
                <li>Free setup &amp; onboarding support</li>
              </ul>

              <a href="#contact" className="price-cta" onClick={handleAnchorClick}>Start 10-Day Free Trial</a>
              <p className="price-note">Contact us to activate your free trial · No credit card</p>
            </div>
          </div>
        </div>
      </section>

      {/* -- ABOUT -- */}
      <section className="about-section" id="about" ref={aboutRef}>
        <img src={mehmanMark} alt="" className="about-watermark" aria-hidden="true" />

        <div className={"about-inner" + (aboutVisible ? " is-visible" : "")}>
          <div className="about-head">
            <span className="about-eyebrow">ABOUT MEHMAN</span>
            <h2 className="about-title">Security that still feels<br/>like a warm welcome.</h2>
            <p className="about-lead">Mehman means <em>guest</em>, and every gate should greet one with both safety and a smile. We replace paper registers and missed phone calls with a calm, digital system that keeps societies and businesses moving.</p>
          </div>

          <div className="about-strip" aria-hidden="true">
            <div className="about-strip-track">
              <div className="about-strip-item"><img src={artGate} alt="" /><span>Welcome</span></div>
              <div className="about-strip-item"><img src={artQr} alt="" /><span>Trusted</span></div>
              <div className="about-strip-item"><img src={artShield} alt="" /><span>Secure</span></div>
              <div className="about-strip-item"><img src={artTower} alt="" /><span>Community</span></div>
              <div className="about-strip-item"><img src={artBell} alt="" /><span>Always Alert</span></div>
              <div className="about-strip-item"><img src={artLog} alt="" /><span>Accountable</span></div>
              <div className="about-strip-item"><img src={artGate} alt="" /><span>Welcome</span></div>
              <div className="about-strip-item"><img src={artQr} alt="" /><span>Trusted</span></div>
              <div className="about-strip-item"><img src={artShield} alt="" /><span>Secure</span></div>
              <div className="about-strip-item"><img src={artTower} alt="" /><span>Community</span></div>
              <div className="about-strip-item"><img src={artBell} alt="" /><span>Always Alert</span></div>
              <div className="about-strip-item"><img src={artLog} alt="" /><span>Accountable</span></div>
            </div>
          </div>

          <div className="about-stats">
            <div className="about-stat">
              <span className="about-stat-num">{fmt(counts.societies)}+</span>
              <span className="about-stat-label">Properties secured</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-num">{fmt(counts.visitors)}+</span>
              <span className="about-stat-label">Visitors logged</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-num">{fmt(counts.gates)}+</span>
              <span className="about-stat-label">Gates live</span>
            </div>
            <div className="about-stat">
              <span className="about-stat-num">~{fmt(counts.seconds)}s</span>
              <span className="about-stat-label">To verify a visitor</span>
            </div>
          </div>

          <div className="about-lockup">
            <div className="about-lockup-line" aria-hidden="true" />
            <span className="about-lockup-prefix">Built by</span>
            <a className="about-lockup-link" href="https://paymastermanagement.com/tech" target="_blank" rel="noopener noreferrer">
              <img src={paymasterLogo} alt="Paymaster Management Solutions Ltd" className="about-lockup-logo" />
            </a>
            <span className="about-lockup-caption">Dependable technology for communities and businesses.</span>
          </div>
        </div>
      </section>

      {/* -- CONTACT -- */}
      <section className="contact-section" id="contact">
        <div className="contact-redesign">
          <div className="contact-left">
            <span className="contact-eyebrow">GET IN TOUCH</span>
            <h2 className="contact-title">Talk to the<br/>Mehman team.</h2>
            <p className="contact-sub">For onboarding, deployment, or partnership queries, reach us directly. We would love to bring a warmer, safer gate to your society or business.</p>
            <div className="contact-cards-stack">
              <a className="contact-card" href="tel:8070001333" onClick={handleAnchorClick}>
                <div className="contact-card-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 3h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a1 1 0 01-1 1A14 14 0 013 4a1 1 0 011-1z" stroke="#b1790a" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                </div>
                <div className="contact-card-body">
                  <span className="contact-card-label">Call us</span>
                  <span className="contact-card-value">8070001333</span>
                </div>
              </a>
              <a className="contact-card" href="mailto:info@mehman.net.in">
                <div className="contact-card-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="10" rx="2" stroke="#b1790a" strokeWidth="1.4"/><path d="M4 6l6 5 6-5" stroke="#b1790a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="contact-card-body">
                  <span className="contact-card-label">Email us</span>
                  <span className="contact-card-value">info@mehman.net.in</span>
                </div>
              </a>
              <a className="contact-card" href="https://www.paymastermanagement.com" target="_blank" rel="noopener noreferrer">
                <div className="contact-card-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="#b1790a" strokeWidth="1.4"/><path d="M3 10h14M10 3c2 2.5 2 11.5 0 14M10 3c-2 2.5-2 11.5 0 14" stroke="#b1790a" strokeWidth="1.4"/></svg>
                </div>
                <div className="contact-card-body">
                  <span className="contact-card-label">Visit website</span>
                  <span className="contact-card-value">www.paymastermanagement.com</span>
                </div>
              </a>
            </div>
          </div>

          <div className="contact-right">
            <div className="contact-form-card">
              <h3 className="contact-form-title">Send us a message</h3>
              <p className="contact-form-sub">Fill in your details and we will get back to you within 24 hours.</p>

              <form className="contact-form" onSubmit={handleFormSubmit}>
                <div className="contact-form-row">
                  <div className="contact-form-field">
                    <label className="contact-form-label">Full Name *</label>
                    <input className={`contact-form-input${formErrors.name ? " has-error" : ""}`} type="text" name="name" placeholder="Your full name" value={formData.name} onChange={handleFormChange} required />
                    {formErrors.name && <span className="contact-field-error">{formErrors.name}</span>}
                  </div>
                  <div className="contact-form-field">
                    <label className="contact-form-label">Phone *</label>
                    <input className={`contact-form-input${formErrors.phone ? " has-error" : ""}`} type="tel" name="phone" placeholder="Your phone number" value={formData.phone} onChange={handleFormChange} inputMode="numeric" maxLength={10} required />
                    {formErrors.phone && <span className="contact-field-error">{formErrors.phone}</span>}
                  </div>
                </div>
                <div className="contact-form-field">
                  <label className="contact-form-label">Email *</label>
                  <input className={`contact-form-input${formErrors.email ? " has-error" : ""}`} type="email" name="email" placeholder="your@email.com" value={formData.email} onChange={handleFormChange} required />
                  {formErrors.email && <span className="contact-field-error">{formErrors.email}</span>}
                </div>
                <div className="contact-form-field">
                  <label className="contact-form-label">Looking for *</label>
                  <select className={`contact-form-input contact-form-select${formErrors.looking_for ? " has-error" : ""}`} name="looking_for" value={formData.looking_for} onChange={handleFormChange} required>
                    <option value="">Select property type</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Society">Society</option>
                    <option value="Corporate office">Corporate office</option>
                    <option value="Commercial complex">Commercial complex</option>
                    <option value="Other">Other</option>
                  </select>
                  {formErrors.looking_for && <span className="contact-field-error">{formErrors.looking_for}</span>}
                </div>
                <div className="contact-form-field">
                  <label className="contact-form-label">Message</label>
                  <textarea className={`contact-form-input contact-form-textarea${formErrors.message ? " has-error" : ""}`} name="message" placeholder="Tell us about your property and requirements..." value={formData.message} onChange={handleFormChange} rows={4} />
                  {formErrors.message && <span className="contact-field-error">{formErrors.message}</span>}
                  <span className="contact-field-count">{formData.message.length}/1000</span>
                </div>
                <button type="submit" className="contact-form-btn" disabled={formStatus === "sending" || formStatus === "success"}>
                  {formStatus === "sending" ? "Sending..." : formStatus === "success" ? "Message Sent!" : "Send Message"}
                </button>
                {formStatus === "error" && (
                  <p className="contact-form-error">Something went wrong. Please try again or call us at 8070001333.</p>
                )}
                {formStatus === "success" && (
                  <div className="contact-form-success-banner">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="#b1790a" strokeWidth="1.4"/><path d="M5.5 10l3 3 6-6" stroke="#b1790a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span>Message sent! We will get back to you shortly. Check your inbox for a confirmation email.</span>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        <div className="contact-map-banner">
          <img src={contactMap} alt="Mehman serves communities and businesses across India" />
          <span className="contact-map-caption">Bringing safer gates to communities and businesses across India</span>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section" id="trial">
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-inner">
          <span className="cta-eyebrow">READY WHEN YOU ARE</span>
          <h2 className="cta-title">Give your premises a warmer,<br/>safer welcome.</h2>
          <p className="cta-sub">Reach out to our team to activate your free 10-day trial. No credit card, no setup fees, no commitment.</p>
          <a href="#contact" className="cta-button" onClick={handleAnchorClick}>Start 10-Day Free Trial</a>
          <span className="cta-note">Contact us to get your property set up</span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">
              <img src={mehmanMark} alt="Mehman" />
            </div>
            <p className="footer-blurb">A warmer, safer gate for every society and business. Visitor passes, SOS alerts, and complete entry history in one simple app.</p>
          </div>

          <div className="footer-col">
            <span className="footer-col-title">Explore</span>
            <a href="#product" className="footer-link" onClick={handleAnchorClick}>Features</a>
            <a href="#how" className="footer-link" onClick={handleAnchorClick}>How It Works</a>
            <a href="#pricing" className="footer-link" onClick={handleAnchorClick}>Pricing</a>
            <a href="#about" className="footer-link" onClick={handleAnchorClick}>About Us</a>
          </div>

          <div className="footer-col">
            <span className="footer-col-title">Contact</span>
            <a href="tel:8070001333" className="footer-link">8070001333</a>
            <a href="mailto:info@mehman.net.in" className="footer-link">Email us</a>
            <a href="https://www.paymastermanagement.com" target="_blank" rel="noopener noreferrer" className="footer-link">www.paymastermanagement.com</a>
          </div>

          <div className="footer-col footer-powered">
            <span className="footer-col-title">Powered by</span>
            <a href="https://paymastermanagement.com/tech" target="_blank" rel="noopener noreferrer" className="footer-paymaster">
              <img src={paymasterFooterLogo} alt="Paymaster Management Solutions Ltd" />
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Mehman. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}
