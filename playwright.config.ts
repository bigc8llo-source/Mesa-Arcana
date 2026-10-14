import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1400, height: 860 },
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM || undefined,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    // modo demonstração: sem variáveis do Supabase
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
  },
})
