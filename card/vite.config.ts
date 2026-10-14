import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    target: 'es2022',
    lib: {
      entry: fileURLToPath(new URL('./src/ha-tty7-card.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'ha-tty7-card.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
    sourcemap: false,
    emptyOutDir: true,
  },
  test: { environment: 'jsdom', include: ['test/**/*.test.ts'], restoreMocks: true },
});
