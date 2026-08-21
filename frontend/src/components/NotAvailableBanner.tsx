export function NotAvailableBanner({ message }: { message?: string }) {
  return (
    <div className="card">
      <span className="badge badge-warning">Not available yet</span>
      <p style={{ marginBottom: 0 }}>
        {message ??
          "This team has no locked-in squad yet - the public FPL API only exposes picks once a gameweek's deadline has passed."}
      </p>
    </div>
  );
}
