type PageHeadProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
};

export function PageHead({ eyebrow, title, description, primaryAction, secondaryAction }: PageHeadProps) {
  return (
    <section className="page-head">
      <div className="stack">
        <span className="brand-badge">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="hero-actions">
        <button className="button" type="button">
          {primaryAction}
        </button>
        <button className="button-secondary" type="button">
          {secondaryAction}
        </button>
      </div>
    </section>
  );
}