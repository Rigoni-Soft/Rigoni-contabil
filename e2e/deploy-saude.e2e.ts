import { expect, test } from "@playwright/test";

// Rotas que só existem no deploy (cron e webhook): provam que estão publicadas e protegidas.
// Não enviam nenhum segredo, então nada é executado nem alterado.
test.describe("Rotas de job e webhook no deploy", () => {
  for (const job of ["encerramento", "lembretes", "parcelamento"]) {
    test(`/api/jobs/${job} recusa chamada sem o segredo do agendador @smoke`, async ({
      request,
    }) => {
      const semHeader = await request.get(`/api/jobs/${job}`);
      expect(semHeader.status()).toBe(401);

      const errado = await request.get(`/api/jobs/${job}`, {
        headers: { authorization: "Bearer segredo-errado" },
      });
      expect(errado.status()).toBe(401);
    });
  }

  test("webhook do WhatsApp recusa verificação com token errado e POST sem assinatura @smoke", async ({
    request,
  }) => {
    const semParametros = await request.get("/api/webhooks/whatsapp");
    expect(semParametros.status()).toBe(400);

    const tokenErrado = await request.get(
      "/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=x&hub.verify_token=errado",
    );
    expect(tokenErrado.status()).toBe(403);

    const semAssinatura = await request.post("/api/webhooks/whatsapp", { data: {} });
    expect(semAssinatura.status()).toBe(403);
  });
});
