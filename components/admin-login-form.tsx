'use client';

import { FormEvent, useState } from 'react';

type AdminLoginFormProps = {
  nextPath: string;
};

export function AdminLoginForm({ nextPath }: AdminLoginFormProps) {
  // Estado de los controles visibles y de los mensajes de respuesta del formulario.
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, pin })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo iniciar sesion.');
      }

      window.location.assign(nextPath);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No se pudo iniciar sesion.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Campos de acceso y accion principal que componen el panel derecho de la pantalla de login.
    <form className="login-form" onSubmit={handleSubmit}>
      <label className="login-field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          placeholder="admin@ucars.cl"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="login-field">
        <span>PIN</span>
        <input
          type="password"
          name="pin"
          autoComplete="current-password"
          inputMode="numeric"
          placeholder="Ingresa tu PIN"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          required
        />
      </label>

      {/* Mensaje visible cuando la validacion no permite iniciar sesion. */}
      {error ? <p className="login-error">{error}</p> : null}

      <button type="submit" className="login-submit" disabled={submitting}>
        {submitting ? 'Validando acceso...' : 'Entrar al Admin Hub'}
      </button>
    </form>
  );
}