import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT ?? "8800";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts", // o padrão do Playwright (test|spec) não pega *.e2e.ts
  use: { baseURL: `http://localhost:${PORT}` },
  // Serial, não paralelo: todos os testes batem no mesmo Supabase local e no
  // mesmo `next dev` — rodar em paralelo gera falso negativo (rate limit de
  // login do GoTrue, condições de corrida de estado compartilhado), não ganho
  // real de velocidade nessa escala de suíte.
  workers: 1,
  // Sobe o Next sozinho — reproduzível sem precisar de outro terminal com `yarn dev`
  // já de pé. Supabase local continua pré-requisito externo (`npx supabase start`),
  // como as integrações também exigem.
  webServer: {
    command: "yarn dev",
    env: { PORT }, // não usar `PORT=x comando` inline: cmd.exe (Windows) não entende essa sintaxe
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
