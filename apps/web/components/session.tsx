"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, User } from "@/lib/api";
import Image from "next/image";

type Session = { users: User[]; user: User; selectUser: (id: string) => void };
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState("employee");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<User[]>("/api/users", undefined, { signal: controller.signal })
      .then((result) => {
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
      })
      .catch((reason: Error) => {
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
        <p>{error || "Connecting to your knowledge workspace…"}</p>
        {error && (
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
        selectUser: (id) => {
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
