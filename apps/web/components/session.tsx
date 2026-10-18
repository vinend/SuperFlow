"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, User } from "@/lib/api";
import Image from "next/image";

type Session = {
  users: User[];
  user: User;
  selectUser: (id: string) => void;
  authenticated: boolean;
  environment: string;
  logout: () => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState("employee");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [environment, setEnvironment] = useState("local");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const config = await api<{ mode: string; environment: string }>(
        "/api/auth/config",
        undefined,
        { signal: controller.signal },
      );
      setAuthenticated(config.mode === "password");
      setEnvironment(config.environment);
      if (config.mode === "password") {
        try {
          const [person, directory] = await Promise.all([
            api<User>("/api/auth/me", undefined, { signal: controller.signal }),
            api<User[]>("/api/users", undefined, { signal: controller.signal }),
          ]);
          setUsers(directory.length ? directory : [person]);
          setSelectedId(person.id);
          setNeedsLogin(false);
        } catch {
          if (!controller.signal.aborted) setNeedsLogin(true);
        }
        return;
      }
      return api<User[]>("/api/users", undefined, {
        signal: controller.signal,
      }).then((result) => {
        if (!result.length)
          throw new Error("No demo users are available. Run the seed command.");
        let stored: string | null = null;
        try {
          stored = localStorage.getItem("superflow.demo-user");
        } catch {
          /* Storage is optional. */
        }
        setSelectedId(
          result.some((person) => person.id === stored) ? stored! : "employee",
        );
        setUsers(result);
        setError("");
      });
    };
    void load().catch((reason: Error) => {
      if (!controller.signal.aborted) setError(reason.message);
    });
    return () => controller.abort();
  }, [attempt]);
  const user = users.find((item) => item.id === selectedId) || users[0];
  if (!user)
    return (
      <div className="boot-screen">
        <Image
          src="/branding/superbank-symbol.png"
          width={64}
          height={64}
          alt="Superbank"
          priority
        />
        <h1>SuperFlow</h1>
        <p>
          {needsLogin
            ? "Sign in to your knowledge workspace"
            : error || "Connecting to your knowledge workspace…"}
        </p>
        {needsLogin && (
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              setBusy(true);
              setError("");
              try {
                const person = await api<User>("/api/auth/login", undefined, {
                  method: "POST",
                  body: JSON.stringify({
                    email: data.get("email"),
                    password: data.get("password"),
                  }),
                });
                form.reset();
                setSelectedId(person.id);
                setUsers([person]);
                setNeedsLogin(false);
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : "Sign-in failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={200}
            />
            <label htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
            {error && <p role="alert">{error}</p>}
            <button className="button primary" disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
        {error && !needsLogin && (
          <button
            className="button primary"
            onClick={() => setAttempt(attempt + 1)}
          >
            Retry connection
          </button>
        )}
      </div>
    );
  return (
    <SessionContext.Provider
      value={{
        users,
        user,
        authenticated,
        environment,
        logout: async () => {
          await api("/api/auth/logout", user, { method: "POST" });
          setUsers([]);
          setNeedsLogin(true);
        },
        selectUser: (id) => {
          if (authenticated) return;
          if (!users.some((person) => person.id === id)) return;
          try {
            localStorage.setItem("superflow.demo-user", id);
          } catch {
            /* Storage is optional. */
          }
          setSelectedId(id);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is required.");
  return session;
}
