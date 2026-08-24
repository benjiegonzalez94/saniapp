/**
 * Armazón de los textos legales (privacidad y términos).
 *
 * Comparten estructura a propósito: son documentos que se leen enteros, a veces
 * impresos y archivados junto al consentimiento del paciente. De ahí la medida
 * angosta y el interlineado holgado — una columna de 90 caracteres se pierde de
 * renglón, y aquí perder un renglón es perder una obligación.
 *
 * La versión se muestra porque cada consentimiento guarda sobre qué versión del
 * texto se otorgó (`patient_consents.policy_version`): sin verla, un paciente no
 * puede saber si lo que aceptó es lo que está leyendo.
 */

export function DocumentoLegal({
  titulo,
  entradilla,
  version,
  vigencia,
  children,
}: {
  titulo: string;
  entradilla: string;
  version: string;
  /** Marcador o fecha de entrada en vigencia. */
  vigencia: string;
  children: React.ReactNode;
}) {
  return (
    // El realce de los términos se declara aquí, sobre el documento entero, y no
    // en cada `<strong>`: eran cuarenta copias de la misma decisión repartidas
    // entre privacidad y términos, y basta con que una se quede atrás para que el
    // mismo concepto se lea con dos pesos distintos en dos documentos que se
    // firman juntos.
    <article className="mx-auto max-w-2xl px-6 py-16 [&_strong]:font-medium [&_strong]:text-(--color-tinta)">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-(--color-tinta)">
        {titulo}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-pretty text-(--color-tinta-2)">
        {entradilla}
      </p>
      <p className="mt-4 text-sm text-(--color-tinta-3)">
        Versión {version} · en vigor desde {vigencia}
      </p>

      {children}
    </article>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-(--color-tinta)">{titulo}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-(--color-tinta-2)">{children}</div>
    </section>
  );
}

export function Puntos({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-(--color-tinta-3)">{children}</ul>;
}

/** Dato que el cliente debe completar antes de publicar. Se marca en pantalla
 *  para que no pase inadvertido: un texto legal con un hueco sin rellenar es
 *  peor que uno sin publicar. */
export function PorCompletar({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-(--radius-sm) bg-(--color-aviso-suave) px-1 py-0.5 text-(--color-tinta)">
      {children}
    </span>
  );
}
