import { test as setup } from "@playwright/test";

// Preview da Vercel tem Deployment Protection — sem o bypass, qualquer
// request (inclusive os do próprio navegador no e2e) recebe a página de
// autenticação da Vercel em vez do app. Roda uma vez antes da suíte
// (dependencies: ["bypass"] no projeto "chromium") e salva o cookie
// resultante pra reusar em todos os testes.
setup("libera a Deployment Protection do preview", async ({ page }) => {
  const origem = new URL(process.env.BASE_URL!).origin;
  await page.route(`${origem}/**`, (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET!,
        "x-vercel-set-bypass-cookie": "true",
      },
    }),
  );
  await page.goto("/");
  await page.context().storageState({ path: "e2e/.auth/bypass.json" });
});
