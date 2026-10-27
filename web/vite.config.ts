import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, el proxy de Vite hace lo mismo que nginx.conf en la demo:
// GeoServer queda en el mismo origen (sin CORS) y las credenciales del editor
// se agregan acá, solo en /wfst, sin llegar al navegador.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const geoserver = `http://localhost:${env.GEOSERVER_PORT || 8080}`;
  const editor = btoa(`${env.GEOSERVER_EDITOR_USER || 'editor'}:${env.GEOSERVER_EDITOR_PASSWORD || 'editor'}`);
  // El navegador manda las cookies de otras apps en localhost y GeoServer rechaza
  // encabezados tan grandes (400). GeoServer no las necesita: se sacan.
  const sinCookies: ProxyOptions['configure'] = proxy =>
    proxy.on('proxyReq', req => req.removeHeader('cookie'));

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/geoserver': { target: geoserver, changeOrigin: true, configure: sinCookies },
        '/wfst': {
          target: geoserver,
          changeOrigin: true,
          configure: sinCookies,
          rewrite: () => '/geoserver/tpi/wfs',
          headers: { Authorization: `Basic ${editor}` },
        },
      },
    },
  };
});
