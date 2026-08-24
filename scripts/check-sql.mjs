/**
 * Valida las migraciones con el parser real de PostgreSQL (libpg_query).
 *
 * Dos pasadas, porque una sola no basta:
 *   1. SQL de nivel superior. Para este parser el cuerpo `$$...$$` de una
 *      función es sólo un literal de texto, así que un error dentro de una
 *      función plpgsql pasaría desapercibido.
 *   2. Cuerpos plpgsql, extraídos y parseados aparte con parsePlPgSQL.
 *
 * No comprueba semántica (no sabe si una tabla existe), pero atrapa todo error
 * de sintaxis antes de que llegue a un despliegue.
 *
 *   node scripts/check-sql.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const { parse, parsePlPgSQL } = await import('libpg-query');

/**
 * Localiza cada `create function ... as $tag$ cuerpo $tag$` cuyo lenguaje sea
 * plpgsql y devuelve el CREATE completo, que es lo que parsePlPgSQL espera.
 */
function extractPlpgsqlFunctions(sql) {
  const found = [];
  const re = /create\s+(?:or\s+replace\s+)?function\b/gi;
  let m;

  while ((m = re.exec(sql)) !== null) {
    const start = m.index;
    // Delimitador con etiqueta: $$ o $tag$
    const dollar = /\$([A-Za-z_][A-Za-z0-9_]*)?\$/g;
    dollar.lastIndex = start;
    const open = dollar.exec(sql);
    if (!open) continue;

    const close = sql.indexOf(open[0], open.index + open[0].length);
    if (close === -1) continue;

    const end = close + open[0].length;
    const stmt = sql.slice(start, end);
    if (/language\s+plpgsql/i.test(stmt)) {
      found.push({
        stmt: stmt + ';',
        line: sql.slice(0, start).split('\n').length,
        name: stmt.match(/function\s+([\w.]+)/i)?.[1] ?? '(anónima)',
      });
    }
    re.lastIndex = end;
  }
  return found;
}

/**
 * libpg_query parsea plpgsql SIN acceso al catálogo, así que no puede saber que
 * `app.access_model` es un enum. Ante cualquier tipo no nativo asume que la
 * variable es compuesta, y una lista `SELECT ... INTO a, b` con una de esas
 * variables dispara este error. Verificado con un caso mínimo: `pg_catalog.text`
 * pasa y `app.lo_que_sea` falla, con el mismo cuerpo de función.
 *
 * Se degrada a aviso en lugar de silenciarlo: si alguna vez es un error real
 * —usar de verdad una variable de fila donde va un escalar— seguirá siendo
 * visible en la salida, sólo que sin tumbar el build por una falsa alarma.
 */
const PARSER_LIMITATIONS = [
  {
    match: /is not a scalar variable$/,
    why: 'tipo definido por el usuario en un SELECT INTO (el parser no tiene catálogo)',
  },
];

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
let failed = 0;
let warnings = 0;

function reportError(file, sql, err, offsetLine = 0) {
  console.error(`       ${err.message}`);
  const pos = err.cursorPosition;
  if (pos != null && pos > 0) {
    const upTo = sql.slice(0, pos);
    const line = upTo.split('\n').length + offsetLine;
    console.error(`       en ${file}:${line}`);
    console.error(`       > ${sql.split('\n')[line - offsetLine - 1]?.trim() ?? ''}`);
  }
}

for (const file of files) {
  const sql = readFileSync(join(DIR, file), 'utf8');
  const problems = [];

  try {
    const ast = await parse(sql);
    const count = ast?.stmts?.length ?? (Array.isArray(ast) ? ast.length : 0);

    const fns = extractPlpgsqlFunctions(sql);
    const soft = [];
    for (const fn of fns) {
      try {
        await parsePlPgSQL(fn.stmt);
      } catch (err) {
        const known = PARSER_LIMITATIONS.find((k) => k.match.test(err.message));
        if (known) soft.push({ err, fn, why: known.why });
        else problems.push({ err, fn });
      }
    }

    if (problems.length === 0) {
      console.log(
        `  ok   ${file.padEnd(28)} ${String(count).padStart(3)} sentencias, ` +
          `${String(fns.length).padStart(2)} funciones plpgsql`
      );
      for (const s of soft) {
        warnings++;
        console.log(`       aviso: ${s.fn.name} — ${s.err.message} (${s.why})`);
      }
    } else {
      failed++;
      console.error(`  FAIL ${file}  (${problems.length} función/es plpgsql)`);
      for (const p of problems) {
        console.error(`       · ${p.fn.name} (línea ~${p.fn.line})`);
        reportError(file, p.fn.stmt, p.err, p.fn.line - 1);
      }
    }
  } catch (err) {
    failed++;
    console.error(`  FAIL ${file}`);
    reportError(file, sql, err);
  }
}

const suffix = warnings > 0 ? ` (${warnings} aviso/s por límites del parser)` : '';
console.log(
  failed === 0
    ? `\nSintaxis correcta en ${files.length} migraciones (SQL y plpgsql)${suffix}.`
    : `\n${failed} de ${files.length} migraciones con errores${suffix}.`
);
process.exit(failed === 0 ? 0 : 1);
