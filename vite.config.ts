import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
      '@gameplay': resolve(__dirname, 'src/gameplay'),
      '@rendering': resolve(__dirname, 'src/rendering'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@characters': resolve(__dirname, 'src/characters'),
      '@netcode': resolve(__dirname, 'src/netcode'),
      '@audio': resolve(__dirname, 'src/audio'),
      '@scenes': resolve(__dirname, 'src/scenes'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@input': resolve(__dirname, 'src/input'),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
})
