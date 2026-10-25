import { defineConfig, loadEnv } from 'vite';

// In dev, serve api/chat.js like Vercel does in production, with GEMINI_API_KEY read from .env.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  return {
    plugins: [
      {
        name: 'local-api',
        configureServer(server) {
          server.middlewares.use('/api/chat', async (req, res) => {
            const { default: handler } = await server.ssrLoadModule('/api/chat.js');
            handler(req, res);
          });
        },
      },
    ],
  };
});
