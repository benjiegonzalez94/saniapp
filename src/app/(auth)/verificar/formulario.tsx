'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { createClient } from '@/lib/supabase/client';

/**
 * Segundo factor (TOTP).
 *
 * Se resuelve en el CLIENTE con el SDK de Supabase, no con una server action:
 * el reto de MFA actualiza el token de sesión en el navegador y hacerlo desde
 * el servidor obligaría a reescribir las cookies a mano, con riesgo de dejar la
 * sesión en un estado intermedio —autenticada pero sin nivel aal2— que la base
 * rechazaría sin explicación.
 */
export function FormularioVerificacion({ siguiente }: { siguiente: string }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (!vigente) return;

      if (err || !data?.totp?.length) {
        setError('No hay ningún segundo factor configurado en esta cuenta.');
        setCargando(false);
        return;
      }
      setFactorId(data.totp[0].id);
      setCargando(false);
    })();
    return () => {
      vigente = false;
    };
  }, []);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;

    setError(null);
    setVerificando(true);

    const supabase = createClient();
    const { data: reto, error: errReto } = await supabase.auth.mfa.challenge({ factorId });

    if (errReto || !reto) {
      setError('No se pudo iniciar la verificación. Inténtelo de nuevo.');
      setVerificando(false);
      return;
    }

    const { error: errVerif } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: reto.id,
      code: codigo.trim(),
    });

    if (errVerif) {
      // Mensaje único: distinguir "código incorrecto" de "código caducado"
      // ayudaría a quien intenta adivinarlo por fuerza bruta.
      setError('Código incorrecto. Revise su aplicación de autenticación.');
      setCodigo('');
      setVerificando(false);
      return;
    }

    router.replace(siguiente);
    router.refresh();
  }

  return (
    <form onSubmit={verificar} className="space-y-4">
      <div className="text-center">
        <ShieldCheck
          className="mx-auto size-8 text-(--color-acento)"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>

      <Field
        label="Código de verificación"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        autoFocus
        disabled={cargando}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
        className="cifras text-center text-lg tracking-widest"
        ayuda="Los seis dígitos de su aplicación de autenticación."
        error={error ?? undefined}
      />

      <Button
        type="submit"
        className="w-full"
        size="lg"
        cargando={verificando}
        disabled={cargando || codigo.length < 6}
      >
        Verificar
      </Button>
    </form>
  );
}
