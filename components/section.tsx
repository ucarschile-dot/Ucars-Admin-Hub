type SectionProps = {
  title: string;
  copy: string;
  children: React.ReactNode;
  sideLabel?: string;
};

export function Section({ title, copy, children, sideLabel }: SectionProps) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="section-copy">{copy}</p>
        </div>
        {sideLabel ? <span className="chip">{sideLabel}</span> : null}
      </div>
      {children}
    </section>
  );
}