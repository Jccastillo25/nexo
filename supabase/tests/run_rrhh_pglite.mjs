import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Solo motor WASM en memoria. Nunca recibe una URL ni credenciales remotas.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = process.argv.slice(2);
if (!files.length) throw new Error('Indica los archivos SQL en orden');
const db = await PGlite.create({ extensions: { pgcrypto } });
try {
  for (const file of files) {
    const resolved = path.resolve(root, file);
    if (!resolved.startsWith(root + path.sep) || !file.endsWith('.sql')) throw new Error('Ruta SQL inválida');
    await db.exec(await readFile(resolved, 'utf8'));
    console.log(`OK ${file}`);
  }
} catch {
  // Los errores SQL pueden incluir valores de credenciales: nunca imprimirlos.
  console.error('FALLO SQL local; revisar aserciones sin volcar argumentos ni valores');
  process.exitCode = 1;
} finally { await db.close(); }
