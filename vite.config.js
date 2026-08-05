import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // vitest: اختبارات المنطق النقي فقط (loyaltyMath) — بيئة node بلا DOM
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})