import { RegistroAcao } from "@/modules/auditoria/domain/entities/registro-acao.entity";

const DATA_HORA = new Date("2026-09-25T12:00:00.000Z");

describe("RegistroAcaoBuilder", () => {
  it("constrói um RegistroAcao válido", () => {
    const resultado = RegistroAcao.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comAtor("11111111-1111-1111-1111-111111111111")
      .comSetor("administrativo")
      .comAcao("usuario.criar")
      .comAlvo("usuário jessica@rigonicontabil.local")
      .comResultado("sucesso")
      .comDataHora(DATA_HORA)
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.acao).toBe("usuario.criar");
      expect(resultado.value.resultado.ehSucesso()).toBe(true);
      expect(resultado.value.dataHora).toEqual(DATA_HORA);
    }
  });

  it("acumula erros de ator, setor, ação e alvo vazios e resultado inválido", () => {
    const resultado = RegistroAcao.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comAtor("")
      .comSetor("")
      .comAcao("")
      .comAlvo("")
      .comResultado("parcial")
      .comDataHora(DATA_HORA)
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(Object.keys(resultado.error.fields ?? {})).toEqual(
        expect.arrayContaining(["ator", "setor", "acao", "alvo", "resultado"]),
      );
    }
  });

  it("restaurar reconstitui a partir de dados persistidos", () => {
    const resultado = RegistroAcao.builder()
      .restaurar({
        id: "22222222-2222-2222-2222-222222222222",
        ator: "11111111-1111-1111-1111-111111111111",
        setor: "administrativo",
        acao: "usuario.criar",
        alvo: "usuário jessica@rigonicontabil.local",
        resultado: "sucesso",
        dataHora: DATA_HORA.toISOString(),
      })
      .build();

    expect(resultado.ok).toBe(true);
  });
});
