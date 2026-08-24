import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/lib/testing/setup-env.ts'],
    // Las pruebas de RLS comparten una única base local: en paralelo se pisarían
    // los datos de prueba entre archivos.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      // `server-only` lanza al importarse fuera de un Server Component.
      'server-only': fileURLToPath(new URL('./src/lib/testing/empty-module.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
