import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "8800";
const remoto = !!process.env.BASE_URL;
const precisaBypass = remoto && !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts", // o padrão do Playwright (test|spec) não pega *.e2e.ts
  use: { baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}` },
  // Serial, não paralelo: todos os testes batem no mesmo Supabase local e no
  // mesmo `next dev` — rodar em paralelo gera falso negativo (rate limit de
  // login do GoTrue, condições de corrida de estado compartilhado), não ganho
  // real de velocidade nessa escala de suíte.
  workers: 1,
  // Sobe o Next sozinho só quando roda local — contra um preview da Vercel
  // (BASE_URL setado) o deploy já está de pé, não tem o que subir aqui.
  webServer: remoto
    ? undefined
    : {
        command: "yarn dev",
        env: { PORT }, // não usar `PORT=x comando` inline: cmd.exe (Windows) não entende essa sintaxe
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
  projects: [
    // Setup que troca os cookies de Deployment Protection da Vercel antes dos
    // testes reais — só existe quando o preview exige bypass (VERCEL_AUTOMATION_BYPASS_SECRET).
    ...(precisaBypass ? [{ name: "bypass", testMatch: /bypass\.setup\.ts/ }] : []),
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(precisaBypass ? { storageState: "e2e/.auth/bypass.json" } : {}),
      },
      dependencies: precisaBypass ? ["bypass"] : [],
    },
  ],
});
