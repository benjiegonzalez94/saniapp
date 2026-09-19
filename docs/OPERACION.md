# Operación: copias de seguridad y recuperación

Este documento cubre lo que hay que hacer **después** de que SaniTi funcione:
respaldarla y poder devolverla a la vida. Para el modelo de amenaza y el porqué
de cada control criptográfico, vea [`SECURITY.md`](./SECURITY.md).

Va escrito para el día malo, no para el día bueno. Si está leyendo esto con
prisa, salte a [Recuperación ante desastre](#recuperación-ante-desastre).

---

## 1. Qué se copia y qué no

```bash
npm run backup                          # base local → ./copias/
npm run backup -- --url "postgresql://…"   # otra base (producción)
npm run backup -- --destino D:/copias
```

Cada copia es una carpeta con tres cosas:

| Pieza | Cifrada | Para qué |
|---|---|---|
| `manifiesto.json` | no | Conteos, huellas y qué claves hacen falta. Permite detectar una copia truncada **sin descifrarla**. |
| `datos.sql.gz.enc` | sí | El volcado de Postgres: `public`, `auth` y `storage`. |
| `archivos/**.enc` | sí | Los estudios del bucket, uno por archivo. |

### Lo que NO se copia, a propósito

**El esquema.** Vive en `supabase/migrations/`, versionado en git. Restaurar es
aplicar las migraciones y cargar los datos encima. El efecto secundario es
deliberado: cada restauración comprueba además que las migraciones siguen
siendo reproducibles desde cero.

**Las claves de cifrado.** No están en la base y no deben acabar junto a la
copia. Quien se lleve el disco de copias tendría, si no, las notas clínicas en
claro. El manifiesto anota **qué versiones de clave** hacen falta
(`clavesDeCifradoNecesarias`); las claves en sí van en el gestor de secretos.

> Una copia sin sus claves recupera filas, no un historial clínico. Los nombres
> y teléfonos volverán; las notas y las cédulas serán ruido para siempre.

### Por qué la copia va cifrada

Aunque las notas clínicas ya estén cifradas campo a campo, el volcado contiene
en claro nombres, teléfonos, direcciones y diagnósticos CIE-10. Eso es un dato
de salud bajo la LOPDP. Se cifra entero con **AES-256-GCM** y
`SANITI_BACKUP_KEY`, que es una clave **distinta** de las de campo: quien opera
las copias no tiene por qué poder leer las notas, y una copia robada no debe
abrirse con la clave que ya está en el servidor de la aplicación.

Cada pieza lleva un AAD con el identificador de su copia y su nombre. Sin él,
alguien con acceso al disco podría sustituir el volcado de hoy por el del mes
pasado —ambos cifrados con la misma clave, ambos auténticos por separado— y la
restauración no notaría nada.

---

## 2. El ensayo

```bash
npm run backup:ensayo            # verifica la copia SIN tocar la base
npm run backup:ensayo -- --si    # la restaura de verdad
```

**Fase 1** descifra cada pieza, coteja las huellas contra el manifiesto y
confirma que las claves del entorno cubren lo que la copia necesita. No toca la
base: si algo falla, se sabe antes de haber borrado nada.

**Fase 2** hace la restauración real sobre la base local. Es el procedimiento
real a propósito: un ensayo que siguiera un camino distinto ensayaría el camino
equivocado. Después comprueba tres cosas:

1. **Los conteos cuadran**, tabla por tabla, contra el manifiesto.
2. **La cadena de auditoría sigue íntegra.** Es más fino de lo que parece: el
   volcado desactiva los triggers al cargar, así que los hashes que entran son
   los originales y no unos recalculados. Una bitácora que se resella al
   restaurarse deja de probar nada, y esta comprobación lo caza.
3. **Lo cifrado vuelve a leerse.** Se descifran notas clínicas y cédulas con las
   claves actuales. Es la diferencia entre recuperar filas y recuperar un
   historial.

> `--si` reemplaza la base **local**. Para volver a los datos de desarrollo:
> `npm run db:reset && npm run db:seed-cifrado`.

### El ensayo corre en CI

Va en `.github/workflows/verificar.yml`, al final, porque es destructivo. En el
runner eso no cuesta nada —la base muere con el job— y a cambio el
procedimiento de recuperación queda comprobado **en cada push**.

No es una precaución teórica. La primera vez que se ejecutó, **falló**:

```
duplicate key value violates unique constraint "icd10_codes_pkey"
```

Varias tablas las llenan las propias migraciones (`icd10_codes` en la 0013,
`medications` en la 0014, `permissions` y `role_permissions` en la 0002, `plans`
en la 0010). Tras reaplicar migraciones ya tenían sus filas, y el volcado —que
también las trae— chocaba contra su propia clave primaria.

Es decir: había una copia **íntegra, correctamente cifrada y perfectamente
inútil**. Ninguna verificación del archivo lo habría detectado. Sólo restaurarla
de verdad. Por eso el ensayo vacía las tablas antes de cargar, y por eso corre
solo.

---

## 3. Recuperación ante desastre

Lo que necesita tener a mano **antes** de empezar:

- La carpeta de la copia.
- `SANITI_BACKUP_KEY` — abre la copia.
- `SANITI_ENCRYPTION_KEYS` con **todas** las versiones que diga el manifiesto —
  hace legible lo cifrado.
- `SANITI_BLIND_INDEX_KEY` — sin ella la búsqueda por cédula deja de encontrar
  pacientes, aunque los datos estén.

Si le falta alguna de las tres últimas, deténgase y consígala antes de tocar
nada. Restaurar sin ellas produce una base que parece correcta y no lo es.

```bash
# 1. Comprobar la copia ANTES de destruir nada.
npm run backup:ensayo -- --copia /ruta/a/saniti-2026-…

# 2. Si la fase 1 pasa, restaurar.
npm run backup:ensayo -- --copia /ruta/a/saniti-2026-… --si
```

Contra una base que no sea la local, pase `--url`.

### Después de restaurar, compruebe a mano

- Entrar con una cuenta real. Si `auth.users` no se restauró, nadie entra.
- Abrir una nota clínica en la interfaz. Que se lea confirma las claves.
- Buscar un paciente por cédula. Confirma `SANITI_BLIND_INDEX_KEY`.
- `/i/{slug}/auditoria` → «Verificar integridad».
- Abrir un estudio. Confirma que los archivos volvieron, no sólo sus filas.

---

## 4. Cadencia y custodia

Nada de esto está automatizado todavía; hoy es una decisión suya.

- **Frecuencia**: al menos diaria mientras haya consulta. Una copia semanal
  significa que el peor día se pierden cinco jornadas de historias.
- **Regla 3-2-1**: tres copias, dos soportes, una fuera del sitio. Un disco USB
  en el mismo consultorio no sobrevive a un incendio ni a un robo.
- **Las claves van aparte de las copias.** Siempre. Si viajan juntas, el cifrado
  no aporta nada.
- **Ensaye una restauración al menos cada trimestre**, con una copia elegida al
  azar y no siempre la última.
- **Retención**: bajo la LOPDP los datos clínicos no se conservan
  indefinidamente «por si acaso». Defina un plazo y bórrelas al cumplirse.

---

## 5. Lo que todavía NO cubre

Dicho claro, para que nadie lo dé por hecho:

- **No hay automatización.** `npm run backup` lo lanza una persona. Falta el
  cron y, sobre todo, la alerta de que una copia **no** se hizo — un cron que
  falla en silencio es peor que no tenerlo.
- **No hay copia fuera del sitio.** El script escribe en una carpeta; subirla a
  otro lugar es manual.
- **No se verifica la copia recién hecha.** Habría que encadenar la fase 1 al
  final de `npm run backup`.
- **No hay rotación de claves de cifrado.** El esquema la soporta (`key_version`
  por fila, `needsRotation()`) y desde la migración 0018 también `patients`,
  pero falta el trabajo que recifre lo antiguo.
- **Recuperación a un punto en el tiempo (PITR).** Sólo se recupera al instante
  de la copia; lo escrito después se pierde. Los planes de pago de Supabase
  ofrecen PITR y conviene evaluarlo antes de que haya pacientes reales.
