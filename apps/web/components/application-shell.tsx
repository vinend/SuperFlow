"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  ChartNoAxesCombined,
  Calculator,
  Check,
  ChevronRight,
  FolderKanban,
  Home,
  Layers3,
  Menu,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "./session";
import { Dialog } from "./ui/dialog";
import { navigationFor, roleLabel, reviewsLabel } from "@/lib/product-view";

export type KnowledgeView = "home" | "ask" | "knowledge";
export type View =
  | KnowledgeView
  | "cases"
  | "workflows"
  | "decisions"
  | "regulatory"
  | "investigation"
  | "investment"
  | "demo"
  | "impact";
export const TITLES = {
  home: "Home",
  ask: "Ask SuperFlow",
  knowledge: "Knowledge",
  cases: "My Work",
  workflows: "My Work",
  decisions: "Reviews / Approvals",
  regulatory: "Regulatory Review",
  investigation: "Investigation Review",
  investment: "Investment Analysis",
  impact: "Impact",
  demo: "Demo walkthrough",
};
const ICONS = {
  home: Home,
  ask: Sparkles,
  knowledge: BookOpen,
  cases: FolderKanban,
  decisions: Check,
  regulatory: Scale,
  investigation: ShieldCheck,
  investment: Calculator,
  impact: ChartNoAxesCombined,
};

// Sidebar + header + inset composition informed by 21st.dev Appshell.
export function ApplicationShell({
  view,
  children,
}: {
  view: View;
  children: ReactNode;
}) {
  const { user, users, selectUser } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = useReducedMotion();
  const nav = navigationFor(user.role_id);
  const activeView = view === "workflows" ? "cases" : view;
  const navigation = (
    <>
      <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark">
          <Layers3 size={21} />
        </span>
        <span>
          SuperFlow<span className="brand-caption">Knowledge to action</span>
        </span>
      </Link>
      <div className="workspace-label">
        <span className="workspace-icon">SB</span>
        <span>
          Superbank<small>Internal knowledge workspace</small>
        </span>
      </div>
      <p className="nav-label">Workspace</p>
      <nav aria-label="Main navigation">
        {nav.map((item) => {
          const Icon = ICONS[item.view as keyof typeof ICONS];
          return (
            <Link
              key={item.title}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`nav-item ${activeView === item.view ? "selected" : ""}`}
              aria-current={activeView === item.view ? "page" : undefined}
            >
              <Icon size={17} />
              <span>{item.title}</span>
              {activeView === item.view && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <p>Enterprise Knowledge-to-Action Platform</p>
        <div className="sidebar-rule" />
        <span className="small">Superbank · Internal workspace</span>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a href="#workspace-main" className="skip-link">
        Skip to workspace
      </a>
      <aside className="sidebar desktop-sidebar">{navigation}</aside>
      {menuOpen && (
        <Dialog
          label="Workspace navigation"
          className="mobile-navigation"
          close={() => setMenuOpen(false)}
        >
          <button
            className="icon-button navigation-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
          {navigation}
        </Dialog>
      )}
      <div className="workspace-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Superbank</span>
            <ChevronRight size={13} />
            <strong>
              {view === "decisions" ? reviewsLabel(user.role_id) : TITLES[view]}
            </strong>
          </div>
          <div className="session-controls">
            <span className="demo-label">Demo role</span>
            <span className="avatar">
              {user.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <label className="role-picker">
              <span className="sr-only">Demo role</span>
              <select
                aria-label="Demo role"
                value={user.id}
                onChange={(event) => selectUser(event.target.value)}
              >
                {users.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.id === "compliance_checker"
                      ? "Compliance Checker"
                      : roleLabel(person.role_id)}{" "}
                    — {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <motion.div
          key={view}
          className="workspace-content"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {children}
        </motion.div>
        <footer className="workspace-footer">
          <span>SuperFlow / Enterprise Knowledge-to-Action Platform</span>
          <Link href="/demo">Demo walkthrough</Link>
          <span>Knowledge → Evidence → Decision → Action</span>
        </footer>
      </div>
    </div>
  );
}
