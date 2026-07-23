import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Cada test sintetiza el stack completo, lo que bundlea 6 Lambdas con
    // esbuild. En runners de CI (más lentos, sin caché previa) el primer
    // synth() de cada archivo puede tardar bastante más que en local — el
    // timeout por defecto de Vitest (5s) no alcanza.
    testTimeout: 60_000,
  },
});
