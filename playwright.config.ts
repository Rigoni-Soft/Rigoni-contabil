import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "8800";
const remoto = !!process.env.BASE_URL;
const precisaBypass = remoto && !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/support/global-setup.ts",
  testMatch: "**/*.e2e.ts", // o padrão do Playwright (test|spec) não pega *.e2e.ts
  // Contra o preview cada ação passa por rede, função serverless (cold start) e Supabase remoto:
  // os 5 s/30 s do dev local estouram por latência, não por defeito. O trace guarda a tela das falhas.
  timeout: remoto ? 60_000 : 30_000,
  expect: { timeout: remoto ? 15_000 : process.env.CI ? 10_000 : 5_000 },
  // No CI o `next dev` compila rota por demanda e engasga sob carga (ECONNRESET): uma nova tentativa
  // absorve esse ruído sem esconder defeito real, que falha de novo e continua vermelho.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: remoto ? "retain-on-failure" : "off",
    // Num deploy com mensageria real, este cabeçalho (mesmo valor de E2E_ADAPTER_SECRET no Preview)
    // faz o app usar o adapter falso nas requisições da suíte: nada vai à Meta.
    extraHTTPHeaders: process.env.E2E_ADAPTER_SECRET
      ? { "x-e2e-adapter-falso": process.env.E2E_ADAPTER_SECRET }
      : undefined,
  },
  // Serial, não paralelo: todos os testes batem no mesmo Supabase local e no
  // mesmo `next dev` — rodar em paralelo gera falso negativo (rate limit de
  // login do GoTrue, condições de corrida de estado compartilhado), não ganho
  // real de velocidade nessa escala de suíte.
  workers: 1,
  // Teto da suíte contra o preview: abaixo do timeout do job, para o relatório ainda ser publicado.
  globalTimeout: remoto ? 25 * 60_000 : undefined,
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
        // Gravação de áudio (#80): microfone falso e permissão já dada, sem prompt nem hardware.
        permissions: ["microphone"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
        ...(precisaBypass ? { storageState: "e2e/.auth/bypass.json" } : {}),
      },
      dependencies: precisaBypass ? ["bypass"] : [],
    },
  ],
});
