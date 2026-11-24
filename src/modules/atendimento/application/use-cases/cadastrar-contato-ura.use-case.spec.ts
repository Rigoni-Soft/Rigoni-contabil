import type { ResultadoCadastroContatoUra } from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { ContatoUraPort } from "@/modules/atendimento/application/ports/out/contato-ura.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { CadastrarContatoUra } from "./cadastrar-contato-ura.use-case";

const ATENDIMENTO: AtendimentoEmAndamento = {
  id: "at-1",
  clienteId: null,
  setor: "recepcao",
  funcionarioId: "func-1",
  telefone: "5561988887777",
  chave: "61988887777",
};
const DONO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "recepcao" };

function montar(
  opcoes: {
    ator?: AtorSessaoDto | null;
    atendimento?: AtendimentoEmAndamento | null;
    resultado?: ResultadoCadastroContatoUra;
  } = {},
) {
  const ator = opcoes.ator === undefined ? DONO : opcoes.ator;
  const atendimento = opcoes.atendimento === undefined ? ATENDIMENTO : opcoes.atendimento;
  const cadastros: unknown[] = [];
  const repositorio = {
    buscarEmAndamento: async () => ok(atendimento),
  } as unknown as AtendimentoRepositoryPort;
  const contatos: ContatoUraPort = {
    clientePorCnpj: async () => ok(null),
    cadastrar: async (input) => {
      cadastros.push(input);
      return ok(opcoes.resultado ?? { status: "criado", contatoId: "ct-1", nome: input.nome });
    },
  };
  const sessao = { usuarioAtual: async () => ator };
  return {
    cadastrar: new CadastrarContatoUra(sessao, repositorio, contatos),
    cadastros,
  };
}

const ENTRADA = { atendimentoId: "at-1", clienteId: "cli-1", nome: "  Maria  ", email: null };

describe("CadastrarContatoUra", () => {
  it("cadastra o contato do Cliente confirmado com o nome aparado", async () => {
    const { cadastrar, cadastros } = montar();
    const r = await cadastrar.execute(ENTRADA);
    expect(r).toEqual({ ok: true, value: { status: "criado", contatoId: "ct-1", nome: "Maria" } });
    expect(cadastros).toEqual([
      { atendimentoId: "at-1", clienteId: "cli-1", nome: "Maria", email: null },
    ]);
  });

  it("devolve o contato existente do mesmo Cliente sem criar outro", async () => {
    const existente = { status: "existente", contatoId: "ct-9", nome: "Joana" } as const;
    const r = await montar({ resultado: existente }).cadastrar.execute(ENTRADA);
    expect(r).toEqual({ ok: true, value: existente });
  });

  it("repassa a recusa do número que já é de outro Cliente", async () => {
    const r = await montar({ resultado: { status: "em_outro_cliente" } }).cadastrar.execute(
      ENTRADA,
    );
    expect(r).toEqual({ ok: true, value: { status: "em_outro_cliente" } });
  });

  it("recusa nome em branco sem chamar o banco", async () => {
    const { cadastrar, cadastros } = montar();
    const r = await cadastrar.execute({ ...ENTRADA, nome: "   " });
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(cadastros).toEqual([]);
  });

  it("recusa e-mail inválido", async () => {
    const r = await montar().cadastrar.execute({ ...ENTRADA, email: "sem-arroba" });
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
  });

  it("e-mail em branco vira sem e-mail", async () => {
    const { cadastrar, cadastros } = montar();
    await cadastrar.execute({ ...ENTRADA, email: "  " });
    expect(cadastros).toEqual([expect.objectContaining({ email: null })]);
  });

  it("só o dono do Atendimento da Recepção cadastra", async () => {
    for (const ator of [
      { ...DONO, id: "func-2" },
      { id: "l", papel: "lider_setor" as const, setor: "recepcao" as const },
      { id: "func-1", papel: "funcionario" as const, setor: "rh" as const },
    ]) {
      const { cadastrar, cadastros } = montar({ ator });
      const r = await cadastrar.execute(ENTRADA);
      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
      expect(cadastros).toEqual([]);
    }
  });

  it("sem sessão nega e Atendimento inexistente não é encontrado", async () => {
    const semSessao = await montar({ ator: null }).cadastrar.execute(ENTRADA);
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    const inexistente = await montar({ atendimento: null }).cadastrar.execute(ENTRADA);
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");
  });

  it("falha do banco devolve o erro", async () => {
    const { cadastrar } = montar();
    const falha = new ServicoExternoError("falhou");
    const caso = new CadastrarContatoUra(
      { usuarioAtual: async () => DONO },
      { buscarEmAndamento: async () => ok(ATENDIMENTO) } as unknown as AtendimentoRepositoryPort,
      { clientePorCnpj: async () => ok(null), cadastrar: async () => err(falha) },
    );
    expect(await caso.execute(ENTRADA)).toEqual({ ok: false, error: falha });
    expect(cadastrar).toBeDefined();
  });
});
