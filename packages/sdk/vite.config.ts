import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,
      include: ['src/**/*.ts']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ShowAndTell',
      fileName: (format) => {
        if (format === 'iife') return 'show-and-tell.min.js';
        if (format === 'es') return 'show-and-tell.esm.js';
        return `show-and-tell.${format}.js`;
      },
      formats: ['iife', 'es', 'cjs']
    },
    rollupOptions: {
      output: {
        exports: 'named',
        extend: true
      }
    },
    sourcemap: true,
    minify: 'esbuild'
  }
});
