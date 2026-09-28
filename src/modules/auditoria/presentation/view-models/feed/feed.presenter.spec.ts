import { registroAcaoParaView } from "@/modules/auditoria/presentation/view-models/feed/feed.presenter";

describe("registroAcaoParaView", () => {
  it("formata dataHora em pt-BR e preserva os demais campos", () => {
    const view = registroAcaoParaView({
      id: "1",
      ator: "admin-1",
      setor: "administrativo",
      acao: "usuario.criar",
      alvo: "usuário x",
      resultado: "sucesso",
      dataHora: "2026-09-25T12:00:00.000Z",
    });

    expect(view.dataHora).toBe(new Date("2026-09-25T12:00:00.000Z").toLocaleString("pt-BR"));
    expect(view).toMatchObject({ id: "1", acao: "usuario.criar", resultado: "sucesso" });
  });
});
