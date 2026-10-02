import { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";

describe("UsuarioBuilder", () => {
  it("constrói um Usuario válido", () => {
    const resultado = Usuario.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comNome("Jéssica Souza")
      .comEmail("jessica@rigonicontabil.local")
      .comPapel("funcionario")
      .comSetor("simples_nacional")
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.nome).toBe("Jéssica Souza");
      expect(resultado.value.papel.valor).toBe("funcionario");
      expect(resultado.value.setor.slug).toBe("simples_nacional");
    }
  });

  it("acumula erros de nome vazio, papel e setor inválidos", () => {
    const resultado = Usuario.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comNome("")
      .comEmail("x@x.com")
      .comPapel("gerente")
      .comSetor("patriki")
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(Object.keys(resultado.error.fields ?? {})).toEqual(
        expect.arrayContaining(["nome", "papel", "setor"]),
      );
    }
  });

  it("rejeita quando um campo obrigatório nunca teve seu setter chamado (devolutiva #55, ponto 03)", () => {
    const resultado = Usuario.builder().comId("11111111-1111-1111-1111-111111111111").build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(Object.keys(resultado.error.fields ?? {})).toEqual(
        expect.arrayContaining(["nome", "email", "papel", "setor"]),
      );
    }
  });

  it("preserva a mensagem específica de papel/setor inválidos em vez do genérico 'obrigatório'", () => {
    const resultado = Usuario.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comNome("Jéssica Souza")
      .comEmail("jessica@rigonicontabil.local")
      .comPapel("gerente")
      .comSetor("patriki")
      .build();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.fields?.papel).not.toEqual(["obrigatório"]);
      expect(resultado.error.fields?.setor).not.toEqual(["obrigatório"]);
    }
  });

  it("restaurar reconstitui a partir de dados persistidos", () => {
    const resultado = Usuario.builder()
      .restaurar({
        id: "11111111-1111-1111-1111-111111111111",
        nome: "Admin",
        email: "admin@rigonicontabil.local",
        papel: "admin",
        setor: "administrativo",
        senhaTrocadaEm: "2026-01-01T00:00:00.000Z",
        senhaProvisoriaExpiraEm: "2026-01-03T00:00:00.000Z",
      })
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.precisaTrocarSenha()).toBe(false);
  });

  it("sem comSenhaProvisoriaExpiraEm, um cadastro novo (#30) recebe 48h de validade por padrão", () => {
    const antes = Date.now();
    const resultado = Usuario.builder()
      .comId("11111111-1111-1111-1111-111111111111")
      .comNome("Jéssica Souza")
      .comEmail("jessica@rigonicontabil.local")
      .comPapel("funcionario")
      .comSetor("simples_nacional")
      .build();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.precisaTrocarSenha()).toBe(true);
      expect(resultado.value.senhaProvisoriaVencida(new Date())).toBe(false);
      expect(resultado.value.senhaProvisoriaVencida(new Date(antes + 49 * 60 * 60 * 1000))).toBe(
        true,
      );
    }
  });
});
