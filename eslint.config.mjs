import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefactos generados, no código del proyecto. ESLint con configuración
    // plana no lee los .gitignore anidados, así que hay que nombrarlos aquí
    // aunque git ya los excluya.
    "supabase/.temp/**", // secretos y bundles que escribe `supabase start`
    ".graphify/**", // grafo de conocimiento, regenerable con `npm run graph`
    "src/lib/db/database.types.ts", // generado con `npm run db:types`
  ]),
]);

export default eslintConfig;
