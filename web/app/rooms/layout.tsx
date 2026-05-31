export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="rooms-nav">
        {["camps", "commercial", "evidence", "market", "reports", "policy", "operations"].map((r) => (
          <a key={r} href={`/rooms/${r}`} className="rooms-nav-link">
            {r}
          </a>
        ))}
      </div>
      {children}
    </div>
  );
}
