import { defineConfig } from "vite";
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    build: {
        target: "ES2022",
    },
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    // Treat perspective-viewer elements as custom elements
                    isCustomElement: (tag) => tag.startsWith('perspective-')
                }
            }
        }),
        tailwindcss()
    ],
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        }
    }
});
