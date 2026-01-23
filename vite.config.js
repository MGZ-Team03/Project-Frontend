import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL; // 예: https://xxxx.execute-api.../Dev
  const wsTarget = env.VITE_WS_URL;   // 예: wss://yyyy.execute-api.../Dev

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      proxy: {
        // REST API (CORS 회피)
        ...(apiTarget
          ? {
              '/api': {
                target: apiTarget,
                changeOrigin: true,
                secure: true,
              },
            }
          : {}),
        // WebSocket (CORS/오프라인 메시지 감소 + 동일 오리진으로 연결)
        ...(wsTarget
          ? {
              '/Dev': {
                target: wsTarget,
                ws: true,
                changeOrigin: true,
                secure: true,
              },
            }
          : {}),
      },
    },
    define: {
      global: 'globalThis',
    },
  };
});
