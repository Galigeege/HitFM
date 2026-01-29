import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_BASE_URL': JSON.stringify(env.GEMINI_BASE_URL),
      'process.env.GEMINI_MODEL': JSON.stringify(env.GEMINI_MODEL),
      'process.env.GEMINI_TTS_MODEL': JSON.stringify(env.GEMINI_TTS_MODEL),
      'process.env.RAPIDAPI_KEY': JSON.stringify(env.RAPIDAPI_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
