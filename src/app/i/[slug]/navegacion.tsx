'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText, ShieldCheck, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Permission } from '@/lib/db/types';

/**
 * Navegación de la institución.
 *
 * Cada entrada declara el permiso que la habilita, así que un recepcionista no
 * ve "Auditoría" y un facturador no ve "Pacientes". Esconder lo que no se puede
 * usar no es seguridad —de eso se encarga RLS— pero sí es respeto por quien
 * trabaja aquí ocho horas: una pestaña que siempre da error es ruido.
 */
const SECCIONES = [
  { href: 'pacientes', etiqueta: 'Pacientes', icono: Users, permiso: 'patients.read' },
  { href: 'agenda', etiqueta: 'Agenda', icono: CalendarDays, permiso: 'appointments.read' },
  { href: 'documentos', etiqueta: 'Estudios', icono: FileText, permiso: 'documents.read' },
  { href: 'auditoria', etiqueta: 'Auditoría', icono: ShieldCheck, permiso: 'audit.read' },
] as const satisfies ReadonlyArray<{
  href: string;
  etiqueta: string;
  icono: typeof Users;
  permiso: Permission;
}>;

export function NavegacionInstitucion({
  slug,
  permisos,
}: {
  slug: string;
  permisos: Permission[];
}) {
  const pathname = usePathname();
  const disponibles = SECCIONES.filter((s) => permisos.includes(s.permiso));

  return (
    <nav
      aria-label="Secciones"
      // Desplazamiento horizontal en móvil: en una tableta de mostrador caben
      // dos pestañas, y partirlas en dos filas descoloca el resto de la cabecera.
      className="flex gap-1 overflow-x-auto border-t border-(--color-borde) px-2 sm:px-4"
    >
      {disponibles.map(({ href, etiqueta, icono: Icono }) => {
        const ruta = `/i/${slug}/${href}`;
        const activo = pathname === ruta || pathname.startsWith(`${ruta}/`);

        return (
          <Link
            key={href}
            href={ruta}
            aria-current={activo ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors',
              activo
                ? 'border-(--color-acento) font-medium text-(--color-acento)'
                : 'border-transparent text-(--color-tinta-2) hover:text-(--color-tinta)'
            )}
          >
            <Icono className="size-4" aria-hidden="true" strokeWidth={1.75} />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
