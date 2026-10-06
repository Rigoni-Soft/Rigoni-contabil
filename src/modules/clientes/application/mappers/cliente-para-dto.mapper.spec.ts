import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";

import { clienteParaDto } from "./cliente-para-dto.mapper";

function clienteValido(): Cliente {
  const resultado = Cliente.builder()
    .comId("11111111-1111-1111-1111-111111111111")
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj("11444777000161")
    .comRegime("simples_nacional")
    .comContratoSocialCaminho("clientes/1/contrato-social/doc.pdf")
    .comAlteracoesContratuais([
      { data: "2026-02-01", arquivoCaminho: "clientes/1/alteracoes/0-doc.pdf" },
    ])
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

describe("clienteParaDto", () => {
  it("converte a entidade em DTO serializável", () => {
    const dto = clienteParaDto(clienteValido());

    expect(dto).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      empresa: "Padaria Pão Quente Ltda",
      cnpj: "11444777000161",
      regime: "simples_nacional",
      contratoSocialCaminho: "clientes/1/contrato-social/doc.pdf",
      alteracoesContratuais: [
        { data: "2026-02-01", arquivoCaminho: "clientes/1/alteracoes/0-doc.pdf" },
      ],
    });
  });
});
