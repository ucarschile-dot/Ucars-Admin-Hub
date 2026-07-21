import { AdminLoginForm } from '@/components/admin-login-form';

export default function LoginPage() {
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

        <AdminLoginForm />
      </section>
    </main>
  );
}