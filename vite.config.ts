import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub project pages: https://<user>.github.io/Canasta/
export default defineConfig({
  plugins: [react()],
  base: '/Canasta/',
})
