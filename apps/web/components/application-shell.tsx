"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  Calculator,
  Check,
  ChevronRight,
  FolderKanban,
  Home,
  Menu,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "./session";
import { Dialog } from "./ui/dialog";
import { navigationFor, roleLabel } from "@/lib/product-view";

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
  knowledge: "Knowledge Library",
  cases: "Work",
  workflows: "Work",
  decisions: "Work",
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
  impact: FolderKanban,
};

// Sidebar + header + inset composition informed by 21st.dev Appshell.
export function ApplicationShell({
  view,
  children,
}: {
  view: View;
  children: ReactNode;
}) {
  const { user, users, selectUser, authenticated, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = useReducedMotion();
  const nav = navigationFor(user.role_id);
  const activeView = ["workflows", "decisions"].includes(view) ? "cases" : view;
  const navigation = (
    <>
      <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
        <span className="superbank-wordmark">
          <Image
            src="/branding/superbank-wordmark.png"
            width={1128}
            height={191}
            alt="Superbank"
            priority
          />
        </span>
        <span className="superflow-brand-name">
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
        {nav.map((item, index) => {
          const Icon = ICONS[item.view as keyof typeof ICONS];
          return (
            <div key={item.title}>
              {"group" in item &&
                item.group &&
                (index === 0 ||
                  !("group" in nav[index - 1]) ||
                  nav[index - 1].group !== item.group) && (
                  <p className="nav-label">{item.group}</p>
                )}
              <Link
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`nav-item ${activeView === item.view ? "selected" : ""}`}
                aria-current={activeView === item.view ? "page" : undefined}
              >
                <Icon size={17} />
                <span>{item.title}</span>
                {activeView === item.view && <ChevronRight size={14} />}
              </Link>
            </div>
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
            <strong>{TITLES[view]}</strong>
          </div>
          <div className="session-controls">
            <span className="demo-label">
              {authenticated
                ? roleLabel(user.role_id)
                : "Demo role · Prototype only"}
            </span>
            <span className="avatar">
              {user.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            {authenticated ? (
              <button
                className="button secondary"
                onClick={() => void logout()}
              >
                Sign out
              </button>
            ) : (
              <label className="role-picker">
                <span className="sr-only">Demo role</span>
                <select
                  aria-label="Demo role"
                  value={user.id}
                  onChange={(event) => selectUser(event.target.value)}
                >
                  {users
                    .filter(
                      (person) =>
                        [
                          "employee",
                          "manager",
                          "compliance",
                          "finance",
                          "governance",
                        ].includes(person.id) || person.id === user.id,
                    )
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.id === "compliance_checker"
                          ? "Compliance Checker"
                          : roleLabel(person.role_id)}{" "}
                        — {person.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
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
          <span>Knowledge → Evidence → Decision → Action</span>
        </footer>
      </div>
    </div>
  );
}
