import Link from 'next/link';

const menu = [
  { href: '/', label: 'Stock', icon: '01' },
  { href: '/ucarianos', label: 'Ucarianos', icon: '02' },
  { href: '/agenda', label: 'Agenda', icon: '03' },
  { href: '/notificaciones', label: 'Notificaciones', icon: '04' }
];

type AdminShellProps = {
  activePath: string;
  children: React.ReactNode;
  source: 'notion' | 'mock';
};

export function AdminShell({ activePath, children, source }: AdminShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge">Ucars Admin Hub</span>
          <h1>Operación en tiempo real.</h1>
          <p>Stock, vendedores, agenda comercial y notificaciones desde una sola consola.</p>
        </div>

        <nav className="menu" aria-label="Navegación principal">
          {menu.map((item) => (
            <Link key={item.href} href={item.href} className="menu-link" data-active={activePath === item.href}>
              <span className="menu-icon">{item.icon}</span>
              <span>{item.label}</span>
              <span className="pill">{item.icon}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-card">
          <h2>Fuente de datos</h2>
          <p className="sidebar-note">
            {source === 'notion'
              ? 'Conectado a Notion. Los datos del panel se están resolviendo desde tus bases reales.'
              : 'Modo demo activo. Configura las variables NOTION_* en Vercel para usar la base real.'}
          </p>
        </div>
      </aside>

      <main className="content">
        <div className="frame">{children}</div>
      </main>
    </div>
  );
}