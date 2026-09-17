import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,
      include: ['src/**/*.ts', 'src/**/*.tsx']
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ShowAndTellReact',
      fileName: (format) => {
        if (format === 'es') return 'index.esm.js';
        return `index.${format}.js`;
      },
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'show-and-tell'
      ],
      output: {
        banner: "'use client';\n",
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'show-and-tell': 'ShowAndTell'
        }
      },
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      }
    },
    sourcemap: true,
    minify: 'esbuild'
  }
});
