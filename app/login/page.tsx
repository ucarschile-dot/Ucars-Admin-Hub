import { AdminLoginForm } from '@/components/admin-login-form';

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams?.next || '/';

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-copy">
          <span className="login-kicker">Ucars Admin Hub</span>
          <h1>Acceso exclusivo para administradores</h1>
          <p>
            Ingresa con el Email y PIN del registro de Ucarianos en Notion. Solo los perfiles
            que tengan el rol Administrador podran entrar a la plataforma.
          </p>
        </div>

        <AdminLoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}