# Cómo trabajar en SaniTi entre varios

Este archivo cubre sólo la convivencia: ramas, migraciones y revisión. Las
reglas del código —RLS, cifrado, auditoría, convenciones de estilo— están en
[`docs/ONBOARDING-AGENTES.md`](docs/ONBOARDING-AGENTES.md), y **eso se lee
antes que esto**.

Para levantar el entorno, [`README.md`](README.md) § *Puesta en marcha*. No se
duplica aquí para que no haya dos versiones que se contradigan.

---

## Ramas

`main` está protegida: no se empuja directo, todo entra por pull request.

```
feat/agenda-vista-semanal
fix/receta-alergia-no-detectada
docs/contribuir
```

Prefijo, guion, descripción corta en español. Ramas de vida corta: cuanto más
tiempo vive una rama, más caro sale el rebase —y con migraciones de por medio,
el choque es seguro (ver abajo).

Antes de pedir revisión, ponte al día:

```bash
git fetch origin && git rebase origin/main
```

---

## Migraciones: la regla que puede arruinarle el día al otro

Dos personas creando una migración a la vez la numeran igual. El archivo no
choca en git —son nombres distintos, `0017_sedes.sql` y `0017_recordatorios.sql`
conviven sin conflicto—, así que git no avisa de nada. Lo que se rompe es el
orden de aplicación, y se descubre tarde.

### Antes de numerar

```bash
ls supabase/migrations/                                    # lo que hay en disco
git fetch && git log origin/main --oneline -- supabase/migrations/   # lo ya fusionado
git status --short                                         # la tuya sin commitear
```

Los tres, no uno. `ls` no ve la migración que tu compañero fusionó hace diez
minutos si no has hecho `fetch`; `git log` no ve la que tú tienes sin commitear.
El README y el índice del onboarding pueden ir por detrás: **la carpeta manda**.

### Si al rebasar chocan dos números

**Renumeras la tuya. Nunca la de `main`.**

No es cortesía, es reversibilidad. Supabase anota cada migración aplicada por su
versión en `supabase_migrations.schema_migrations`. La de `main` ya está aplicada
en la base de todos los que hayan hecho `db:reset` desde entonces: renombrarla
deja su registro huérfano y la CLI la vuelve a aplicar sobre objetos que ya
existen. La tuya, en cambio, sólo existe en tu máquina y no le debe nada a nadie.

```bash
git mv supabase/migrations/0017_recordatorios.sql supabase/migrations/0018_recordatorios.sql
npm run db:reset     # reaplica todo desde cero en el orden nuevo
npm run db:types     # los tipos generados salen del esquema, y el esquema cambió
```

### `9999_verify_security.sql` va siempre la última

Las migraciones se aplican en orden alfabético, y ese archivo no crea nada: son
aserciones que abortan el despliegue si alguna tabla quedó sin RLS, sin
políticas, con una función `SECURITY DEFINER` sin `search_path` o con una
política inalcanzable por falta de `GRANT`.

Si dejara de ser la última, comprobaría un esquema a medio construir: no vería
la tabla que acabas de añadir y pasaría en verde. Un fallo de seguridad que el
verificador no mira es peor que no tener verificador, porque da confianza.

Por eso el hueco es de cuatro dígitos desde `0017` hacia arriba, y **nada se
numera por encima de 9999**.

### Avisa antes

Decir «voy a crear la 0018» cuesta diez segundos. Descubrir por qué el
`db:reset` del otro falla cuesta media tarde. Y fusiona las migraciones pronto:
una migración que pasa una semana en una rama choca, sin excepción.

---

## Antes de abrir un pull request

```bash
npm run verify   # check:sql + typecheck + lint + test + check:drift
```

Es exactamente lo que ejecuta CI ([`.github/workflows/verificar.yml`](.github/workflows/verificar.yml)),
así que un `verify` verde en local es un CI verde salvo sorpresa.

Si tocaste el esquema, antes de `verify`:

```bash
npm run db:reset && npm run db:types
```

y commitea `src/lib/db/database.types.ts` con el resto. Un tipo generado que se
queda atrás no rompe nada hoy y miente durante semanas.

> **Mide el estado base antes de empezar.** Si `verify` ya estaba rojo al
> arrancar, no lo has roto tú: averigua qué había antes de ponerte a arreglar
> trabajo ajeno.

---

## Lo que no se hace

- **Ejecutar Prettier.** Está instalado, pero sin `.prettierrc` y sin script a
  propósito. Con la configuración por defecto pasaría `src/lib/db/types.ts` a
  comillas dobles, y `readTsConst()` de `scripts/check-schema-drift.mjs` sólo
  reconoce comillas simples: `check:drift` empezaría a reportar que faltan en
  TypeScript todos los valores de los enums vigilados. Un falso positivo caro y
  difícil de atribuir.
- **Editar el bloque de `AGENTS.md`.** Lo reescribe `next dev` en cada arranque;
  quitarlo sólo genera una modificación que reaparece. Las convenciones del
  proyecto van en `docs/ONBOARDING-AGENTES.md`.
- **Commitear `.env.local`.** Lleva las claves de cifrado de los datos clínicos y
  la de servicio, que ignora RLS por completo.
- **Commitear `.graphify/`.** Guarda rutas absolutas de la máquina que lo generó
  y se regenera con `npm run graph`.

Los dos últimos están en `.gitignore`: si aparecen en `git status`, alguien usó
`git add -f`.

---

## Repartirse el trabajo

**Por dominio, no por capa.** Una persona en agenda
(`src/app/i/[slug]/agenda/` + `src/lib/db/scheduling.ts`), otra en pacientes e
historia clínica (`src/app/i/[slug]/pacientes/` + `patients.ts`, `clinical.ts`,
`prescriptions.ts`). Cortar por capa —uno el SQL, otro la interfaz— obliga a los
dos a tocar los mismos archivos en cada tarea.

Territorio común, avisar antes de entrar:

| Archivo | Por qué duele |
|---|---|
| `supabase/migrations/` | El choque de numeración de arriba |
| `src/lib/db/types.ts` | Un enum por dominio, un archivo para todos |
| `src/lib/auth/context.ts` | Lo importa cada página |
| `src/app/globals.css` | Los tokens de diseño |
| `src/components/ui/` | `Button` y `Field` los usa todo |

---

## Commits

Mensaje **en español y en imperativo** («Añade la vista semanal», no «Añadida»
ni «Añadiendo»), asunto de una línea, sin punto final.

El cuerpo se escribe cuando la decisión no es obvia: qué alternativa se descartó,
qué modo de fallo evita. Si el asunto se explica solo —una errata, un texto— no
hace falta cuerpo.

```
Renumera la migración de recordatorios a 0018

0017 ya estaba tomada en origin/main por el catálogo de sedes. Se renumera
ésta y no aquélla porque la de main ya está aplicada en las bases de ambos
entornos: renombrar una migración aplicada deja huérfano su registro en
supabase_migrations.schema_migrations y la CLI la reaplica sobre objetos
que ya existen.
```

---

## Al revisar

Un pull request, un asunto. Y tres preguntas que conviene hacerse siempre:

1. ¿Hay una política RLS detrás de cada comprobación en TypeScript, o el
   TypeScript es lo único que impide el acceso?
2. ¿Cada política nueva tiene su `GRANT` en `0011_grants.sql`? Sin él la política
   nunca llega a ejecutarse.
3. Si cambió el esquema, ¿se regeneraron los tipos?
