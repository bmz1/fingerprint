import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FingerprintSDK',
      fileName: (format) => `fingerprint-sdk.${format}.js`
    },
    rollupOptions: {
      external: [], // Add any external dependencies here
      output: {
        globals: {
          // Define global variable names for external dependencies
        }
      }
    }
  }
});
