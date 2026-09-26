import type { Metadata } from "next";
import { SessionProvider } from "@/components/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperFlow · Knowledge-to-Action Workspace",
  description:
    "Enterprise knowledge, supporting evidence, and controlled human decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
