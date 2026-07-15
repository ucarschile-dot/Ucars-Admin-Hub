type StatusBadgeProps = {
  tone: 'success' | 'warning' | 'danger';
  text: string;
};

export function StatusBadge({ tone, text }: StatusBadgeProps) {
  return (
    <span className={`status ${tone}`}>
      <span className="status-dot" />
      {text}
    </span>
  );
}