import { registroAcaoParaView } from "@/modules/auditoria/presentation/view-models/feed/feed.presenter";

describe("registroAcaoParaView", () => {
  it("formata dataHora em pt-BR no timezone de negócio (América/São Paulo), preservando os demais campos", () => {
    const view = registroAcaoParaView({
      id: "1",
      ator: "admin-1",
      setor: "administrativo",
      acao: "usuario.criar",
      alvo: "usuário x",
      resultado: "sucesso",
      dataHora: "2026-09-25T12:00:00.000Z",
    });

    // 12:00 UTC = 09:00 em São Paulo (UTC-3) — literal explícito, não deriva
    // do timezone de quem roda o teste (devolutiva PR #60, bloqueador 02:
    // a asserção antiga comparava com a própria chamada não-determinística).
    expect(view.dataHora).toBe("25/09/2026, 09:00:00");
    expect(view).toMatchObject({ id: "1", acao: "usuario.criar", resultado: "sucesso" });
  });

  it("um instante que é dia seguinte em UTC mostra o dia correto em São Paulo, perto da virada", () => {
    // 2026-09-30T02:30 UTC é 2026-09-29 23:30 em São Paulo — mesmo instante
    // que listar-registros.use-case.spec.ts prova estar dentro do filtro
    // "só 29/09" (devolutiva PR #60, bloqueador 02: exibição e filtro
    // precisam concordar sobre a que dia um registro pertence).
    const view = registroAcaoParaView({
      id: "2",
      ator: "admin-1",
      setor: "administrativo",
      acao: "usuario.criar",
      alvo: "usuário x",
      resultado: "sucesso",
      dataHora: "2026-09-30T02:30:00.000Z",
    });

    expect(view.dataHora).toBe("29/09/2026, 23:30:00");
  });
});
