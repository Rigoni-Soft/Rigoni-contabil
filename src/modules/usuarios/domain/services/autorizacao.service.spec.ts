import { Usuario } from "@/modules/usuarios/domain/entities/usuario.entity";
import { Setor } from "@/modules/usuarios/domain/value-objects/setor.vo";

import { AutorizacaoService } from "./autorizacao.service";

function criarUsuario(papel: string, setor: string) {
  const resultado = Usuario.builder()
    .comId("11111111-1111-1111-1111-111111111111")
    .comNome("Teste")
    .comEmail("teste@rigonicontabil.local")
    .comPapel(papel)
    .comSetor(setor)
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

describe("AutorizacaoService", () => {
  const service = new AutorizacaoService();

  it("Admin acessa qualquer Setor", () => {
    const admin = criarUsuario("admin", "administrativo");
    const alvo = Setor.criar("simples_nacional");

    expect(alvo.ok && service.podeAcessarSetor(admin, alvo.value)).toBe(true);
  });

  it("Funcionário acessa só o próprio Setor", () => {
    const funcionario = criarUsuario("funcionario", "simples_nacional");
    const proprio = Setor.criar("simples_nacional");
    const outro = Setor.criar("financeiro");

    expect(proprio.ok && service.podeAcessarSetor(funcionario, proprio.value)).toBe(true);
    expect(outro.ok && service.podeAcessarSetor(funcionario, outro.value)).toBe(false);
  });

  it("Líder de setor acessa só o próprio Setor", () => {
    const lider = criarUsuario("lider_setor", "contabil");
    const outro = Setor.criar("financeiro");

    expect(outro.ok && service.podeAcessarSetor(lider, outro.value)).toBe(false);
  });
});
