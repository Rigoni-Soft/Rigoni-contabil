import type { CadastroRhRepository } from "@/modules/clientes/application/ports/out/cadastro-rh.repository";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { EditarCadastroRhCliente } from "./editar-cadastro-rh-cliente.use-case";

const INPUT = {
  clienteId: "11111111-1111-1111-1111-111111111111",
  observacoes: "Folha no 5º dia útil.",
  contatos: [{ nome: "Maria", telefone: "11999990000", padrao: true }],
};

const sessaoDe = (papel: string, setor: string): SessaoPort => ({
  usuarioAtual: async () => ({ id: "u1", papel, setor }),
});

function montar(papel: string, setor: string, resultado: Result<void, AppError> = ok(undefined)) {
  const chamadas: unknown[][] = [];
  const repositorio: CadastroRhRepository = {
    atualizar: async (...args) => {
      chamadas.push(args);
      return resultado;
    },
  };
  return { caso: new EditarCadastroRhCliente(sessaoDe(papel, setor), repositorio), chamadas };
}

describe("EditarCadastroRhCliente", () => {
  it.each([
    ["funcionario", "rh"],
    ["lider_setor", "rh"],
    ["admin", "administrativo"],
  ])("%s de %s grava as observações do RH e os contatos", async (papel, setor) => {
    const { caso, chamadas } = montar(papel, setor);

    const r = await caso.execute(INPUT);

    expect(r.ok && r.value).toEqual({ clienteId: INPUT.clienteId });
    expect(chamadas).toEqual([[INPUT.clienteId, INPUT.observacoes, INPUT.contatos]]);
  });

  it.each([
    ["funcionario", "simples_nacional"],
    ["lider_setor", "financeiro"],
  ])("recusa %s de %s, que não é do RH", async (papel, setor) => {
    const { caso, chamadas } = montar(papel, setor);

    const r = await caso.execute(INPUT);

    expect(!r.ok && r.error).toBeInstanceOf(ForbiddenError);
    expect(chamadas).toHaveLength(0);
  });

  it("recusa contato sem nome ou sem telefone, sem gravar", async () => {
    const { caso, chamadas } = montar("funcionario", "rh");

    const semNome = await caso.execute({
      ...INPUT,
      contatos: [{ nome: " ", telefone: "11999990000", padrao: true }],
    });
    const semTelefone = await caso.execute({
      ...INPUT,
      contatos: [{ nome: "Maria", telefone: "", padrao: true }],
    });

    expect(semNome.ok).toBe(false);
    expect(semTelefone.ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("devolve o erro do repositório", async () => {
    const { caso } = montar("funcionario", "rh", err(new ForbiddenError("Sem permissão.")));

    const r = await caso.execute(INPUT);

    expect(r.ok).toBe(false);
  });
});
