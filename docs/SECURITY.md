# Modelo de seguridad de SaniTi

Este documento explica **por qué** el sistema está construido así. Si va a
cambiar algo de lo que aquí se describe, lea antes la justificación: casi todas
estas decisiones tienen detrás un modo de fallo concreto.

---

## 1. La regla que gobierna todo

> **El aislamiento entre instituciones vive en la base de datos, no en el código
> de la aplicación.**

Toda tabla tiene RLS activo y políticas que exigen membresía activa en la
institución dueña de la fila. Una consulta mal escrita en un Server Component no
puede devolver el paciente de otra clínica: no es que la interfaz lo filtre, es
que Postgres no entrega la fila.

Corolario práctico: **si una comprobación en TypeScript es lo único que impide
un acceso indebido, falta una política**. Las funciones de
[`src/lib/auth/context.ts`](../src/lib/auth/context.ts) existen para decidir qué
pintar en pantalla y dar errores legibles, no para autorizar.

### Cómo se comprueba que sigue siendo verdad

`supabase/migrations/9999_verify_security.sql` corre al final de **cada**
despliegue y aborta la migración si encuentra:

1. Una tabla de `public` sin RLS.
2. Una tabla con RLS pero sin políticas (deniega todo en silencio: casi siempre
   es un olvido, no una decisión).
3. Una función `SECURITY DEFINER` sin `search_path` fijo.
4. Una tabla con `tenant_id` cuyas políticas no invocan ninguna función de
   aislamiento — atrapa el clásico `using (true)` copiado de otra política.

`npm run check:drift` ejecuta lo mismo contra un entorno ya desplegado.

---

## 2. RLS y privilegios son dos capas, y el orden importa

Postgres evalúa primero el **privilegio de tabla** (`GRANT`) y sólo después
aplica las **políticas RLS**. Sin el `GRANT`, la política nunca llega a
ejecutarse: la consulta muere antes con `permission denied`.

Esto no es teórico. En esta versión de Supabase, los privilegios por defecto de
`public` están configurados para el rol `supabase_admin`, pero las migraciones
se aplican como `postgres`. Las tablas nacen con `REFERENCES, TRIGGER, TRUNCATE`
para `authenticated` y **sin ningún DML**. El proyecto tuvo 63 políticas RLS
escritas sobre tablas que nadie podía siquiera leer.

Es un fallo cómodo de pasar por alto porque el síntoma parece seguridad: nadie
ve datos ajenos. Pero la aplicación queda inservible y, peor, **las pruebas de
aislamiento pasan por el motivo equivocado** — deniegan por privilegio, no por
política, y no prueban nada.

Los grants viven en
[`0011_grants.sql`](../supabase/migrations/0011_grants.sql), son explícitos por
tabla y conceden exactamente las operaciones para las que existe política. Un
`grant all on all tables` habría funcionado igual para la aplicación y habría
destruido la correspondencia entre las dos capas.

La comprobación 5 de `app.security_report()` detecta el desajuste: una política
de una sola operación cuyo privilegio falta se reporta como **política
inalcanzable** y aborta el despliegue.

---

## 3. Por qué NO se usa `FORCE ROW LEVEL SECURITY`

Es deliberado y conviene no "arreglarlo".

`FORCE` extiende RLS al dueño de la tabla. Las funciones `SECURITY DEFINER` del
proyecto (`app.audit`, `app.next_counter`, `app.sync_seats`,
`app.rate_limit_hit`, `create_tenant`, `accept_invitation`…) corren precisamente
como ese dueño. Con `FORCE`, sus escrituras **no fallarían: afectarían a cero
filas, en silencio**. Para una bitácora de auditoría ése es el peor modo de
fallo imaginable — todo parece funcionar y no se está registrando nada.

El aislamiento real lo dan las políticas sobre `authenticated` y `anon`, que son
los únicos roles con los que se conecta la aplicación, más los `REVOKE`
explícitos sobre las tablas sensibles.

---

## 4. Qué se cifra, qué no, y por qué

El cifrado es **a nivel de aplicación** (AES-256-GCM), no con `pgcrypto`. Con
`pgcrypto` la clave acaba en la propia base o en sus logs de consultas, así que
un backup robado lo revela todo. Cifrando en el servidor de aplicación, la clave
vive en el gestor de secretos del despliegue y la base sólo custodia texto que
no puede leer.

| Dato | Tratamiento | Motivo |
|---|---|---|
| Cédula / pasaporte | Cifrado + índice ciego HMAC + últimos 4 dígitos | Hay que poder buscar por documento sin guardarlo |
| Nota clínica (SOAP) | Cifrada entera como un JSON | Es el dato más sensible y no se consulta por contenido desde SQL |
| Mensajes de interconsulta | Cifrados | Discusión clínica sobre un paciente identificado |
| Nombre, fecha de nacimiento | En claro | Es la clave de búsqueda de todo el sistema; cifrarla obligaría a descifrar el padrón entero en cada consulta |
| CIE-10, signos vitales, alergias | En claro | Alimentan alertas, gráficas y búsquedas; cifrados, el producto no funciona |

Lo que queda en claro lo protegen RLS, el cifrado en reposo del disco de
Supabase y la auditoría de accesos.

### Ligadura al contexto (AAD)

Cada valor cifrado se liga criptográficamente a **dónde vive**: tabla, columna y
fila. Sin esto, quien pudiera escribir en la base podría copiar la cédula
cifrada del paciente A a la fila del paciente B, o mover una nota clínica entre
expedientes, sin romper el cifrado. Con AAD, ese movimiento hace que el
descifrado falle con un error explícito.

Está cubierto por pruebas en
[`src/lib/security/crypto.test.ts`](../src/lib/security/crypto.test.ts).

### Rotación de claves

`SANITI_ENCRYPTION_KEYS` es un JSON `{"1": "...", "2": "..."}` y cada fila
guarda su `key_version`. Se cifra con la activa y se sigue leyendo lo cifrado
con las anteriores.

**Nunca retire una versión mientras queden filas que la usen.** Compruebe antes:

```sql
select key_version, count(*) from clinical_notes group by key_version;
select key_version, count(*) from case_consult_messages group by key_version;
```

### Índice ciego

Es HMAC, no un hash pelado. Con SHA-256 a secas, el espacio de cédulas
ecuatorianas (10 dígitos) se recorre entero en segundos con una tabla
precomputada. La clave secreta lo hace inviable.

Va en su **propia** clave, distinta de las de cifrado: el índice viaja en las
consultas y aparece en planes de ejecución y logs de sentencias lentas, así que
se le supone más expuesto.

---

## 5. Mínimo necesario

Los permisos no cuelgan del rol directamente, sino de una matriz
`role_permissions` consultable en tiempo de ejecución. Lo importante es lo que
**no** puede cada rol:

- **Recepción** agenda citas y ve datos demográficos, pero **no tiene
  `clinical.read`**: no puede abrir una historia clínica. Como los datos
  clínicos viven en tablas separadas, basta RLS a nivel de tabla para
  garantizarlo.
- **Enfermería** registra pero **no firma** (`clinical.sign` es sólo de médicos).
- **Facturación** ve importes y citas, nunca contenido clínico.
- **Auditoría** sólo lee la bitácora. Y no consume asiento facturable: cobrar
  por el rol de auditoría desincentivaría justo lo que queremos que se use.

### Modelo de acceso por institución

`tenants.access_model` decide el alcance dentro de la clínica:

- `open` — cualquier clínico de la institución accede. Razonable en un
  consultorio de tres personas, donde un círculo de cuidado formal es burocracia
  sin beneficio.
- `care_team` — sólo el equipo asignado al paciente. El resto necesita
  break-glass.

### Break-glass

Un médico de guardia que recibe a un paciente inconsciente que no es suyo
necesita su historia **ahora**. Negársela puede matarlo; dársela en silencio
destruye la confidencialidad. La salida es darla, acotada y con nombre:

```sql
select public.break_glass('<patient_id>', 'Paciente inconsciente en emergencia, sin acompañante');
```

- Motivo obligatorio de 10 caracteres o más.
- Caduca a las 4 horas.
- Se audita **antes** de conceder nada, para que el rastro exista aunque la
  sesión se corte.
- Queda pendiente de revisión hasta que un responsable la cierre
  (`break_glass_grants.reviewed_at`). El cierre se hace desde
  `/i/{slug}/auditoria` y **exige una nota**: un circuito de revisión que se
  despacha con un botón «visto» no es un circuito de revisión. La nota, el
  revisor y la fecha entran en la propia bitácora, y una concesión ya revisada
  no se puede volver a cerrar.

Es una tabla y no una variable de sesión porque PostgREST usa un pool de
conexiones: una GUC no local sobreviviría a la petición y quedaría activa para
el siguiente usuario que reutilizara esa conexión. Sería exactamente la fuga que
intenta evitar.

---

## 6. La bitácora de auditoría

Tres capas la protegen:

1. **Sin políticas de escritura.** La única vía es `public.record_audit()` →
   `app.audit()`.
2. **Privilegios revocados.** Ni `service_role` puede `UPDATE`, `DELETE` o
   `TRUNCATE`.
3. **Encadenada por hash.** Cada fila sella la anterior de su institución:

   ```
   row_hash = sha256( prev_hash || campos_canónicos )
   ```

   Modificar o eliminar un evento rompe la cadena, y
   `app.verify_audit_chain(tenant_id)` señala el punto exacto. `npm run
   check:drift` lo verifica en todas las instituciones.

Un `pg_advisory_xact_lock` por institución serializa la cadena: sin él, dos
eventos concurrentes leerían el mismo `prev_hash` y crearían una bifurcación que
la verificación reportaría como manipulación.

**Se audita toda LECTURA de datos clínicos, no sólo las escrituras.** La pregunta
que hace una auditoría de protección de datos no es "¿quién modificó esto?" sino
"¿quién lo abrió?". Use `auditedRead()` de
[`src/lib/audit/index.ts`](../src/lib/audit/index.ts).

La tabla está particionada por mes para poder aplicar retención con `DROP
PARTITION` en lugar de un `DELETE` masivo, que además rompería la cadena. Hay
una partición `DEFAULT` como red: si faltara la del mes, el evento cae ahí en
vez de fallar el `INSERT`. Una auditoría que bloquea la atención médica es peor
que una auditoría en la partición equivocada.

Programe el mantenimiento de particiones:

```sql
select cron.schedule('audit-partitions', '0 3 1 * *',
  $$select app.ensure_audit_partitions(6)$$);
```

---

## 7. Inmutabilidad de lo firmado

Una nota firmada es un documento médico-legal. No se edita: se **enmienda** con
un registro nuevo que apunta al anterior. Lo impone
`app.block_signed_update()` en la base, no la interfaz. Firmar exige
`clinical.sign` y pasa por `public.sign_clinical_record()`.

Las tablas clínicas tampoco tienen política `DELETE`, y un trigger
`app.block_delete()` lo refuerza.

---

## 8. Seguridad del paciente: el cruce de alergias

No es seguridad informática, pero es la comprobación con más consecuencias del
sistema: un falso negativo aquí es una reacción alérgica evitable.

`public.verificar_alergias()` vive **en la base**, no en la aplicación, para que
cualquier camino que prescriba —la consulta, una receta suelta, un futuro flujo
por WhatsApp— consulte la misma verdad.

El paso que la hace funcionar es el primero: **la alergia se resuelve a su
propia familia antes de comparar**. Una alergia anotada como «Ibuprofeno» se
busca en el vademécum, se toman las claves del ibuprofeno —`{ibuprofeno, aine,
antiinflamatorio}`— y ese conjunto se cruza con el fármaco a prescribir. Sin ese
paso, «Naproxeno» nunca avisaría: no se parece a «Ibuprofeno» en ninguna
comparación de cadenas, y la reactividad cruzada entre AINE es real.

Casos cubiertos por pruebas
([`prescriptions.test.ts`](../src/lib/db/prescriptions.test.ts)): penicilina →
amoxicilina y cefalexina; ibuprofeno → naproxeno; sulfas → cotrimoxazol e
hidroclorotiazida; y cero falsos positivos en paracetamol, azitromicina,
omeprazol, losartán, metformina y loratadina.

### Dónde se pone la línea del bloqueo

Sólo un caso es infranqueable: **el mismo fármaco con alergia de riesgo vital**.
Prescribir en consulta externa el medicamento exacto que provocó una anafilaxia
no tiene escenario clínico que lo justifique.

Todo lo demás avisa y se puede asumir. No es laxitud: el médico sabe cosas que
el registro no dice, como que la «alergia a penicilina» anotada en la infancia
fue un exantema viral mal atribuido. Bloquear su criterio con un muro produce el
peor resultado posible — que abandone el sistema y vuelva a la receta de papel,
donde no hay aviso ninguno.

Asumir un aviso no es gratis: el evento de auditoría lo dice **en el resumen**,
no escondido en los metadatos, con el fármaco y la alergia concretos.

Un medicamento escrito fuera del vademécum se admite, pero **no hay cruce
posible** y la interfaz lo advierte en el propio renglón.

---

## 9. Consentimiento LOPDP aplicado en la base

Los datos de salud son categoría especial (LOPDP art. 7 y 9): exigen
consentimiento explícito, informado y revocable.

El consentimiento **no se comprueba en el código de envío**. Lo impone un
trigger sobre `notification_outbox`: ningún camino —ni un job, ni un script, ni
una llamada directa con la clave de servicio— puede enviar un mensaje a un
paciente que no lo autorizó.

Un envío sin consentimiento no se rechaza: se marca `sin_consentimiento` y se
conserva. Así queda constancia de qué se quiso enviar y por qué no salió, que es
justo lo que una auditoría necesita comprobar.

Revocar el consentimiento cancela automáticamente lo pendiente. Los
consentimientos no se editan ni se borran: revocar es insertar una declaración
nueva, de modo que queda el historial completo.

---

## 10. Cabeceras y sesión

En [`src/proxy.ts`](../src/proxy.ts):

- **CSP con nonce** y `strict-dynamic`.
- **`frame-ancestors 'none'`** — ninguna página debe poder embeberse: evita el
  clickjacking sobre botones que firman recetas o revocan consentimientos.
- **`Referrer-Policy: no-referrer`** — las URLs llevan identificadores de
  paciente y no deben filtrarse a ningún sitio externo.
- **`Cache-Control: no-store` en zonas privadas** — las clínicas comparten
  computadoras entre turnos; sin esto, el botón "atrás" muestra la historia del
  paciente anterior a quien se siente después.
- **`getUser()`, nunca `getSession()`** — `getSession()` lee la cookie sin
  validarla contra el servidor de autenticación y se dejaría engañar por un JWT
  manipulado.

El destino de `?siguiente=` se valida: aceptarlo tal cual permitiría enviar al
usuario recién autenticado a un dominio que imite SaniTi.

---

## 11. La clave de servicio

`SUPABASE_SERVICE_ROLE_KEY` **ignora RLS por completo**. Con ella se lee la
historia clínica de cualquier paciente de cualquier institución.

- Sólo en el servidor. Jamás con prefijo `NEXT_PUBLIC_`.
- Sólo en webhooks y jobs: el webhook de WhatsApp, el worker de recordatorios,
  los webhooks de facturación.
- **Nunca** en una Server Action ni en un Server Component que atienda a una
  persona. Ahí se pierde el aislamiento y con él toda la seguridad del sistema.
- Cada uso debe fijar por su cuenta el tenant que corresponde y auditar lo que
  haga, porque la base ya no lo hará por él.

---

## 12. Una postura que no es técnica

**Una suscripción vencida nunca bloquea la lectura ni la exportación de una
historia clínica.**

Un impago es un problema comercial; dejar a un médico sin acceso al expediente
de su paciente es un problema de seguridad del paciente. La morosidad restringe
la *creación* de datos nuevos y las funciones accesorias
(`app.tenant_write_allowed()`), jamás el acceso a lo ya registrado.

---

## Pendientes conocidos

Esta fundación no incluye todavía:

- Rotación efectiva de claves de cifrado. El esquema y el código la soportan
  (`key_version` por fila, `needsRotation()`); falta el job que recifre lo
  antiguo.
- **Aviso** sobre concesiones de break-glass sin revisar. Revisarlas ya se puede
  —y la pantalla de auditoría las lista destacadas—, pero nadie va a buscarlas:
  falta el correo o la notificación que le diga al responsable que hay una
  esperando.
- Copias de seguridad verificadas y ensayo de restauración.
- Endurecimiento de `auth`: caducidad de sesión, exigir MFA por institución,
  bloqueo temporal de cuenta tras N fallos (hoy sólo hay límite de intentos).

### Ya no están pendientes

Las políticas RLS **sí** están probadas contra una base real:
[`src/lib/db/rls.test.ts`](../src/lib/db/rls.test.ts) levanta tres instituciones
con usuarios de distintos roles, suplanta sus JWT y comprueba el comportamiento,
no la sintaxis. Cubre aislamiento entre clínicas, mínimo necesario por rol,
break-glass, inmutabilidad de lo firmado, detección de manipulación de la
bitácora, solapamiento de citas y la puerta del consentimiento.

Ejecútelas con `npm test` y el Postgres local levantado. El workflow
`verificar` las corre en cada push y en cada PR sobre una base recién creada,
con las mismas migraciones y claves de cifrado generadas por ejecución.

El **antivirus también está implementado y probado de punta a punta**: ClamAV
autoalojado (`docker-compose.clamav.yml`), worker que consume la cola
(`npm run scan`), y la puerta de descarga que sólo firma una URL si el archivo
está `limpio`. Verificado subiendo un archivo con la cadena EICAR: ClamAV lo
marca `infectado`, la descarga se deniega y queda el evento de auditoría.

El escáner de desarrollo **nunca da nada por limpio**: devuelve `error` con el
motivo. Un sustituto que aprobara archivos convertiría el antivirus en teatro y
se colaría a producción sin que nada fallara. Y en producción, si falta
`CLAMAV_HOST`, el arranque falla en lugar de degradarse en silencio.

CI levanta ClamAV como servicio y ejecuta el protocolo INSTREAM completo contra
un clamd con firmas reales. No siempre fue así: las pruebas llevaban un guardia
que debía omitirlas cuando el contenedor no estuviera, y estaba mal escrito en
las dos direcciones posibles —ejecutarlas siempre, que es como se descubrió, o
haberlas omitido siempre en verde, que era el desenlace peligroso—. La prueba de
que un antivirus inalcanzable devuelve `error` y no `limpio` vive ahora fuera
del bloque omitible, porque es justo la que tiene que correr donde no hay
ClamAV. El detalle está en `docs/ONBOARDING-AGENTES.md` §2.11.
