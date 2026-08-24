import postgres from 'postgres';
import { randomUUID } from 'node:crypto';

/**
 * Utilidades para probar las políticas RLS contra el Postgres local.
 *
 * Lo que se prueba aquí NO es el código de la aplicación: es la base de datos.
 * Toda la seguridad de SaniTi descansa en que una consulta hecha con el rol
 * `authenticated` y el JWT de un médico de la clínica A no pueda devolver una
 * fila de la clínica B, por mal escrita que esté. Eso sólo se comprueba
 * hablando con Postgres.
 *
 * La suplantación reproduce lo que hace PostgREST en producción: fija el rol
 * `authenticated` y la GUC `request.jwt.claims`, de donde `auth.uid()` saca el
 * identificador del usuario.
 */

export const CONEXION =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/** Conexión de superusuario: ignora RLS. Sólo para preparar y limpiar datos. */
export function admin() {
  return postgres(CONEXION, { max: 2, onnotice: () => {} });
}

export type Suplantacion = {
  userId: string;
  /** Institución activa; se publica en el claim app_metadata.active_tenant_id. */
  tenantId?: string;
};

/**
 * Ejecuta `fn` como el usuario indicado, con el rol `authenticated`.
 *
 * Todo ocurre dentro de una transacción que SIEMPRE se revierte, así que las
 * pruebas no se ensucian entre sí ni dejan residuos en la base. Para escribir
 * datos que deban persistir, use la conexión de administración.
 */
export async function comoUsuario<T>(
  sql: postgres.Sql,
  { userId, tenantId }: Suplantacion,
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    ...(tenantId ? { app_metadata: { active_tenant_id: tenantId } } : {}),
  });

  let resultado: T;
  const CENTINELA = 'saniti_rollback_intencionado';

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`set local role authenticated`);
      await tx.unsafe(`select set_config('request.jwt.claims', $1, true)`, [claims]);
      resultado = await fn(tx);
      // Revertir es la única forma de dejar la base igual que antes sin tener
      // que deshacer a mano cada escritura que haya hecho la prueba.
      throw new Error(CENTINELA);
    });
  } catch (err) {
    if (!(err instanceof Error) || err.message !== CENTINELA) throw err;
  }

  return resultado!;
}

/** Igual que comoUsuario, pero confirma los cambios. */
export async function comoUsuarioPersistente<T>(
  sql: postgres.Sql,
  { userId, tenantId }: Suplantacion,
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    ...(tenantId ? { app_metadata: { active_tenant_id: tenantId } } : {}),
  });

  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role authenticated`);
    await tx.unsafe(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    return fn(tx);
  }) as Promise<T>;
}

/**
 * Crea un usuario en auth.users; el trigger on_auth_user_created hace el perfil.
 *
 * Las columnas de token van a cadena vacía y no a NULL: GoTrue las lee en
 * cadenas de Go no anulables, y con NULL el ingreso falla con un 500 opaco
 * ("converting NULL to string is unsupported") antes de comparar la contraseña.
 * Estas pruebas suplantan el JWT y no pasan por GoTrue, pero se dejan bien
 * puestas para que una prueba futura que sí autentique no herede el problema.
 */
export async function crearUsuario(
  sql: postgres.Sql,
  nombre: string,
  correo = `${randomUUID()}@prueba.saniti.ec`
): Promise<string> {
  const id = randomUUID();
  await sql`
    insert into auth.users (
      id, instance_id, aud, role, email, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new,
      email_change_token_current, email_change, phone_change,
      phone_change_token, reauthentication_token
    )
    values (
      ${id}, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', ${correo}, ${sql.json({ full_name: nombre })}, now(), now(),
      '', '', '', '', '', '', '', ''
    )
  `;
  return id;
}

export type Institucion = {
  id: string;
  slug: string;
  owner: string;
};

/** Crea una institución con su propietario ya activo. */
export async function crearInstitucion(
  sql: postgres.Sql,
  nombre: string,
  opciones: { accessModel?: 'open' | 'care_team' } = {}
): Promise<Institucion> {
  const owner = await crearUsuario(sql, `Propietario de ${nombre}`);
  const slug = `t${randomUUID().slice(0, 8)}`;

  const [fila] = await sql<{ id: string }[]>`
    insert into public.tenants (legal_name, slug, kind, access_model)
    values (${nombre}, ${slug}, 'clinica', ${opciones.accessModel ?? 'open'})
    returning id
  `;

  await sql`
    insert into public.memberships (tenant_id, profile_id, role, status, accepted_at)
    values (${fila.id}, ${owner}, 'owner', 'active', now())
  `;

  return { id: fila.id, slug, owner };
}

/** Añade un miembro con el rol indicado y devuelve su identificador. */
export async function agregarMiembro(
  sql: postgres.Sql,
  tenantId: string,
  rol: string,
  nombre: string
): Promise<string> {
  const id = await crearUsuario(sql, nombre);
  await sql`
    insert into public.memberships (tenant_id, profile_id, role, status, accepted_at)
    values (${tenantId}, ${id}, ${sql.unsafe(`'${rol}'::app.member_role`)}, 'active', now())
  `;
  return id;
}

/**
 * Elimina una institución y todo lo que cuelga de ella.
 *
 * No es trivial a propósito: `patients`, `encounters` y las demás tablas
 * clínicas referencian a `tenants` con ON DELETE RESTRICT, y los triggers
 * `*_no_delete` impiden borrar registros clínicos. Ese es justo el diseño que
 * se quiere en producción —una institución no arrastra consigo las historias
 * clínicas de sus pacientes— y por eso limpiar en una prueba requiere pedirlo
 * explícitamente.
 *
 * `session_replication_role = replica` suspende los triggers de usuario y las
 * comprobaciones de clave ajena durante la limpieza. Es el mecanismo estándar
 * para esto y sólo puede usarlo un superusuario, así que no abre ninguna vía
 * desde la aplicación.
 */
export async function limpiarInstitucion(sql: postgres.Sql, tenantId: string): Promise<void> {
  await sql.unsafe('set session_replication_role = replica');
  try {
    // Se descubren las tablas por su columna tenant_id en lugar de listarlas:
    // así la limpieza sigue siendo correcta cuando se añadan tablas nuevas.
    const tablas = await sql<{ relname: string }[]>`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
                         and a.attname = 'tenant_id'
                         and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relispartition
    `;

    for (const { relname } of tablas) {
      await sql.unsafe(`delete from public.${relname} where tenant_id = $1`, [tenantId]);
    }
    await sql`delete from public.tenants where id = ${tenantId}`;
  } finally {
    await sql.unsafe('set session_replication_role = default');
  }
}

/** Elimina usuarios de auth.users; el perfil cae por cascada. */
export async function eliminarUsuarios(sql: postgres.Sql, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql`delete from auth.users where id = any(${sql.array(ids)}::uuid[])`;
}

/** Crea un paciente y devuelve su identificador. */
export async function crearPaciente(
  sql: postgres.Sql,
  tenantId: string,
  nombre: string,
  apellido: string
): Promise<string> {
  const [fila] = await sql<{ id: string }[]>`
    insert into public.patients (tenant_id, record_number, given_name, family_name, birth_date)
    values (${tenantId}, app.next_counter(${tenantId}, 'record_number'),
            ${nombre}, ${apellido}, '1985-04-12')
    returning id
  `;
  return fila.id;
}
