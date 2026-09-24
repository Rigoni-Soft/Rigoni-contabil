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

  it("restaurar reconstitui a partir de dados persistidos", () => {
    const resultado = Usuario.builder()
      .restaurar({
        id: "11111111-1111-1111-1111-111111111111",
        nome: "Admin",
        email: "admin@rigonicontabil.local",
        papel: "admin",
        setor: "administrativo",
      })
      .build();

    expect(resultado.ok).toBe(true);
  });
});
