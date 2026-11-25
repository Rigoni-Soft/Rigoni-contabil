import { test as setup } from "@playwright/test";

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
