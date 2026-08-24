## Qué cambia y por qué

<!-- Qué hace ahora la aplicación que antes no hacía, y qué problema resuelve.
     Si descartaste una alternativa razonable, di cuál y por qué. -->

## Cómo se probó

<!-- Qué recorriste a mano, con qué cuenta y en qué pantalla. `npm test` no
     ejercita el camino navegador→Supabase: habla con Postgres directamente. -->

## ¿Toca el esquema?

- [ ] No
- [ ] Sí — migración `____`, numerada tras comprobar `origin/main`, y
      `9999_verify_security.sql` sigue siendo la última
- [ ] Sí — y regeneré los tipos con `npm run db:types` (el diff de
      `src/lib/db/database.types.ts` va en este PR)

## Verificación

- [ ] `npm run verify` pasa en local
