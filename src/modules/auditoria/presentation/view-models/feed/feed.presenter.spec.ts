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

    expect(view.dataHora).toBe("25/09/2026, 09:00:00");
    expect(view).toMatchObject({ id: "1", acao: "usuario.criar", resultado: "sucesso" });
  });

  it("um instante que é dia seguinte em UTC mostra o dia correto em São Paulo, perto da virada", () => {
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
