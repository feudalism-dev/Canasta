import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const assetRev = readFileSync(new URL('./public/asset-rev.txt', import.meta.url), 'utf8')
  .trim()
  .split(/\s+/)[0] || '0'

// GitHub project pages: https://<user>.github.io/Canasta/
export default defineConfig({
  plugins: [react()],
  base: '/Canasta/',
  define: {
    __CANASTA_ASSET_REV__: JSON.stringify(assetRev),
  },
})
