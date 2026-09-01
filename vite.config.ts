import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    // Preview local (Arena): permite servir um mock do Supabase na MESMA origem
    // do dev server, evitando CORS/bloqueio de porta no navegador. Só é ativado
    // com MOCK_SUPABASE_PROXY definido; produção não é afetada.
    ...(process.env.MOCK_SUPABASE_PROXY
      ? {
          proxy: {
            "/__sb": {
              target: process.env.MOCK_SUPABASE_PROXY,
              changeOrigin: true,
              rewrite: (p: string) => p.replace(/^\/__sb/, ""),
            },
          },
        }
      : {}),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
