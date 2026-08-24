<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# SaniTi

Plataforma SaaS de gestión clínica multi-institución. Ecuador, marco LOPDP.

**Antes de escribir código, lee [`docs/ONBOARDING-AGENTES.md`](docs/ONBOARDING-AGENTES.md).**
Está escrito a partir de errores que ya se cometieron aquí; te ahorra repetirlos.

## Contexto que ordena las prioridades

El primer usuario real es un **médico general que hoy lleva todo en papel**
(Manta, Ecuador). Si teclear en SaniTi es más lento que escribir a mano, vuelve
al papel. De ahí salen decisiones que si no parecen arbitrarias: un solo
buscador, dos campos obligatorios al registrar un paciente, sólo el «subjetivo»
obligatorio en una consulta.

## Reglas que no se rompen

1. **El aislamiento entre instituciones vive en la base, no en el código.** Si
   una comprobación en TypeScript es lo único que impide un acceso indebido,
   falta una política RLS.
2. **RLS y `GRANT` son dos capas.** Postgres comprueba el privilegio ANTES de
   aplicar la política; sin `GRANT`, la política nunca se ejecuta. Toda tabla
   nueva necesita su entrada en el estilo de `supabase/migrations/0011_grants.sql`.
3. **Toda función `SECURITY DEFINER` lleva `set search_path = ''`.**
4. **Nunca `FORCE ROW LEVEL SECURITY`** — rompe en silencio las funciones
   `SECURITY DEFINER` del proyecto (afectan a cero filas, sin error).
5. **`createAdminClient()` sólo en código sin usuario detrás** (webhooks,
   workers). Ignora RLS por completo.

`supabase/migrations/9999_verify_security.sql` aborta el despliegue si se
incumplen 3, 4 o los grants de 2. Es una red, no un sustituto de leer.

## Trampas frecuentes

- **No ejecutes Prettier**: está instalado sin configuración a propósito;
  rompería `npm run check:drift`.
- **`setState` en el cuerpo de un `useEffect` es error de lint**, no aviso.
  Guarda el resultado junto a su clave y deriva lo que se pinta.
- **No concatenes el `select` de Supabase con `+`**: TypeScript ensancha a
  `string` y se pierde toda la inferencia de tipos.
- **`npm test` no ejercita el camino navegador→Supabase.** Los 104 tests hablan
  con Postgres directamente. Un fallo de CSP o de RPC desde cliente los pasa
  todos.
- **No edites el bloque de arriba**: lo reescribe `next dev` en cada arranque.

## Comandos

```bash
npm run db:start     # PostgreSQL 17 + migraciones + datos de desarrollo
npm run dev
npm run verify       # check:sql + typecheck + lint + test + check:drift
npm run db:types     # regenera los tipos tras CADA migración
```

Mide el estado de `verify` **antes** de empezar: si ya estaba rojo, no lo has
roto tú.
