import Link from 'next/link';

const tabs = [
  { href: '/', label: 'Stock' },
  { href: '/ucarianos', label: 'Ucarianos' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/notificaciones', label: 'Notificaciones' }
];

type StitchShellProps = {
  activePath: string;
  children: React.ReactNode;
};

export function StitchShell({ activePath, children }: StitchShellProps) {
  return (
    <div className="stitch-shell">
      <header className="stitch-tabs" aria-label="Secciones del panel administrador">
        <div className="stitch-tabs-inner">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="stitch-tab"
              data-active={activePath === tab.href}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="stitch-shell-content">{children}</div>
    </div>
  );
}