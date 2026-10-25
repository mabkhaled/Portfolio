import { defineConfig, loadEnv } from 'vite';

// In dev, serve the api/ functions like Vercel does in production, with GEMINI_API_KEY read from .env.
const API = ['chat', 'speak'];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  return {
    plugins: [
      {
        name: 'local-api',
        configureServer(server) {
          for (const name of API) {
            server.middlewares.use(`/api/${name}`, async (req, res) => {
              const { default: handler } = await server.ssrLoadModule(`/api/${name}.js`);
              handler(req, res);
            });
          }
        },
      },
    ],
  };
});
