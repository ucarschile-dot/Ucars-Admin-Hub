type MetricCardProps = {
  icon: string;
  label: string;
  value: string;
  note: string;
};

export function MetricCard({ icon, label, value, note }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <div>
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
        </div>
        <div className="metric-icon">{icon}</div>
      </div>
      <p className="metric-note">{note}</p>
    </article>
  );
}