import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VXSTATION — VYRDON Control Plane",
  description: "Room operations dashboard for VYRDON protocol",
};

const rooms = [
  { key: "camps", label: "Camp" },
  { key: "commercial", label: "Commercial" },
  { key: "evidence", label: "Evidence" },
  { key: "market", label: "Market" },
  { key: "reports", label: "Reports / Plans" },
  { key: "policy", label: "Policy" },
  { key: "operations", label: "Operations" },
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <nav className="sidebar">
            <div className="sidebar-header">
              <h1>VXSTATION</h1>
              <p>VYRDON Control Plane</p>
            </div>
            <a href="/" className="nav-link">Dashboard</a>
            {rooms.map((r) => (
              <a key={r.key} href={`/rooms/${r.key}`} className="nav-link">
                {r.label}
              </a>
            ))}
          </nav>
          <main className="main">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
