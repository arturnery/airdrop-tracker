import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Conexão com o Neon.
 *
 * O `import "server-only"` no topo é deliberado: no App Router não existe
 * fronteira física entre cliente e servidor, e um import acidental deste
 * módulo num Client Component empacotaria a DATABASE_URL no bundle do
 * navegador. Com server-only isso vira erro de build. Ver ARCHITECTURE.md §8.
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export { schema };
