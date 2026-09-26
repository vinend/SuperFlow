"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  FolderKanban,
  GitBranch,
  Home,
  Layers3,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "./session";
import { Dialog } from "./ui/dialog";

export type View = "home" | "ask" | "knowledge";
export const TITLES = {
  home: "Home",
  ask: "Ask SuperFlow",
  knowledge: "Knowledge Hub",
};
const NAV = [
  { title: "Home", href: "/", view: "home", icon: Home },
  { title: "Ask SuperFlow", href: "/ask", view: "ask", icon: Sparkles },
  {
    title: "Knowledge Hub",
    href: "/knowledge",
    view: "knowledge",
    icon: BookOpen,
  },
];
const LATER = [
  { title: "Cases", icon: FolderKanban },
  { title: "Workflows", icon: GitBranch },
  { title: "Decision Center", icon: Check },
  { title: "Analytics", icon: ChartNoAxesCombined },
  { title: "Governance", icon: ShieldCheck },
];

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
        {NAV.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={`nav-item ${view === item.view ? "selected" : ""}`}
            aria-current={view === item.view ? "page" : undefined}
          >
            <item.icon size={17} />
            <span>{item.title}</span>
            {view === item.view && <ChevronRight size={14} />}
          </Link>
        ))}
      </nav>
      <div className="nav-divider" />
      <p className="nav-label">Later phases</p>
      <div className="future-nav">
        {LATER.map((item) => (
          <button
            className="nav-item unavailable"
            key={item.title}
            disabled
            title="Available in a later development phase"
          >
            <item.icon size={16} />
            <span>{item.title}</span>
            <small>Later</small>
          </button>
        ))}
      </div>
      <div className="sidebar-foot">
        <div className="phase-label">
          Knowledge Core <span>Phase 0 / 1</span>
        </div>
        <p>Enterprise Knowledge-to-Action Platform</p>
        <div className="sidebar-rule" />
        <span className="small">Synthetic data · Demo environment</span>
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
            <strong>{TITLES[view]}</strong>
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
                    {person.role_name} · {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        {children}
        <footer className="workspace-footer">
          <span>SuperFlow / Enterprise Knowledge-to-Action Platform</span>
          <span>
            Phase 0 + 1 · Synthetic prototype <ArrowUpRight size={12} />
          </span>
        </footer>
      </div>
    </div>
  );
}
