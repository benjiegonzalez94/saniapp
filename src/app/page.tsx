import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import {
  CalendarDays,
  FileLock2,
  MessageSquareText,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';

const CAPACIDADES = [
  {
    icon: Stethoscope,
    titulo: 'Historia clínica',
    texto:
      'Notas SOAP, diagnósticos CIE-10, signos vitales y alergias. Lo firmado queda inmutable: se enmienda, no se reescribe.',
  },
  {
    icon: CalendarDays,
    titulo: 'Agenda por médico',
    texto:
      'Horarios, bloqueos y sedes. La base impide dos citas a la misma hora, aunque se agenden a la vez desde tres sitios.',
  },
  {
    icon: MessageSquareText,
    titulo: 'Citas por WhatsApp',
    texto:
      'El paciente elige médico, día y hora desde un menú de botones. Recordatorios automáticos antes de la consulta.',
  },
  {
    icon: FileLock2,
    titulo: 'Resultados y estudios',
    texto:
      'Suba exámenes e imágenes y compártalos con un colega de la institución. Nunca se sirve un enlace público.',
  },
  {
    icon: Users,
    titulo: 'Equipo y roles',
    texto:
      'Médicos, enfermería, recepción y facturación. Cada rol ve lo justo: recepción agenda sin abrir la historia clínica.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Auditoría real',
    texto:
      'Cada acceso a un expediente queda registrado en una bitácora encadenada por hash: alterarla o borrar un evento se detecta.',
  },
] as const;

export default function PaginaInicio() {
  return (
    <div className="min-h-dvh bg-(--color-lienzo)">
      <header className="sticky top-0 z-40 border-b border-(--color-borde) bg-(--color-lienzo)/85 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <Logo size={30} />
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/precios"
              className="rounded-(--radius-md) px-3 py-2 text-sm text-(--color-tinta-2) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-tinta)"
            >
              Precios
            </Link>
            <Link
              href="/ingresar"
              className="rounded-(--radius-md) px-3 py-2 text-sm text-(--color-tinta-2) transition-colors hover:bg-(--color-superficie-2) hover:text-(--color-tinta)"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="rounded-(--radius-md) bg-(--color-acento) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
            >
              Empezar
            </Link>
          </div>
        </nav>
      </header>

      <main id="contenido">
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-(--color-acento-suave) px-3 py-1 text-xs font-medium text-(--color-acento-fuerte)">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Conforme a la LOPDP del Ecuador
            </p>

            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-(--color-tinta) sm:text-5xl">
              La gestión de su clínica, sin fricción y sin sustos
            </h1>

            <p className="mt-5 text-lg leading-relaxed text-pretty text-(--color-tinta-2)">
              Historia clínica, agenda, resultados y comunicación con el paciente en un solo
              lugar. Construido sobre aislamiento por institución, cifrado de los datos
              sensibles y auditoría de cada acceso, no añadidos después.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/registro"
                className="inline-flex h-11 items-center justify-center rounded-(--radius-md) bg-(--color-acento) px-6 text-sm font-medium text-white transition-colors hover:bg-(--color-acento-fuerte)"
              >
                Probar 14 días gratis
              </Link>
              <Link
                href="/precios"
                className="inline-flex h-11 items-center justify-center rounded-(--radius-md) border border-(--color-borde-fuerte) bg-(--color-superficie) px-6 text-sm font-medium text-(--color-tinta) transition-colors hover:bg-(--color-superficie-2)"
              >
                Ver planes
              </Link>
            </div>

            <p className="mt-4 text-sm text-(--color-tinta-3)">
              Sin tarjeta de crédito. Desde consultorio individual hasta hospital.
            </p>
          </div>
        </section>

        <section className="border-t border-(--color-borde) bg-(--color-superficie)">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-(--color-tinta)">
              Lo que hace SaniTi
            </h2>

            <ul className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {CAPACIDADES.map(({ icon: Icon, titulo, texto }) => (
                <li key={titulo}>
                  <Icon
                    className="size-5 text-(--color-acento)"
                    aria-hidden="true"
                    strokeWidth={1.75}
                  />
                  <h3 className="mt-3 font-medium text-(--color-tinta)">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-(--color-tinta-2)">
                    {texto}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-(--color-borde)">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-(--color-tinta)">
                La seguridad no es una casilla de la lista
              </h2>
              <p className="mt-4 leading-relaxed text-(--color-tinta-2)">
                Los datos de cada institución están separados en la propia base de datos, no
                por un filtro en el código: aunque una consulta se escriba mal, no puede
                devolver el paciente de otra clínica. Las cédulas y las notas clínicas se
                guardan cifradas con claves que la base de datos no conoce, así que un backup
                robado no revela nada.
              </p>
              <p className="mt-4 leading-relaxed text-(--color-tinta-2)">
                Y una decisión que no vamos a cambiar:{' '}
                <strong className="font-medium text-(--color-tinta)">
                  una factura impaga nunca bloquea el acceso a una historia clínica
                </strong>
                . Un problema de cobro es nuestro; la seguridad del paciente, de nadie.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-(--color-borde) bg-(--color-superficie)">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-(--color-tinta-3) sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SaniTi</p>
          <div className="flex gap-6">
            <Link href="/legal/privacidad" className="hover:text-(--color-tinta-2)">
              Política de privacidad
            </Link>
            <Link href="/legal/terminos" className="hover:text-(--color-tinta-2)">
              Términos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
