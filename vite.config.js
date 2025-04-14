import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
//export default defineConfig({
//  plugins: [react()],
//})
export default defineConfig( {
    server: {
        proxy: {
            '/sonar': {
                target: 'https://sonarqube-qm.se.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/sonar/, '')
            }
        }
    },
    plugins: [react()],
});
