import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { ContatoUraPort } from "@/modules/atendimento/application/ports/out/contato-ura.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { BuscarClienteParaContatoUra } from "./buscar-cliente-para-contato-ura.use-case";

const CNPJ = "11444777000161";
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
    cliente?: { id: string; empresa: string; cnpj: string } | null;
  } = {},
) {
  const ator = opcoes.ator === undefined ? DONO : opcoes.ator;
  const atendimento = opcoes.atendimento === undefined ? ATENDIMENTO : opcoes.atendimento;
  const buscas: string[] = [];
  const auditadas: RegistrarAcaoAuditoria[] = [];
  const auditoria: AuditoriaPort = { registrar: async (acao) => void auditadas.push(acao) };
  const repositorio = {
    buscarEmAndamento: async () => ok(atendimento),
  } as unknown as AtendimentoRepositoryPort;
  const contatos = {
    clientePorCnpj: async (cnpj: string) => {
      buscas.push(cnpj);
      return ok(
        opcoes.cliente === undefined
          ? { id: "cli-1", empresa: "Padaria Ltda", cnpj: CNPJ }
          : opcoes.cliente,
      );
    },
  } as unknown as ContatoUraPort;
  const sessao = { usuarioAtual: async () => ator };
  return {
    buscar: new BuscarClienteParaContatoUra(sessao, repositorio, contatos, auditoria),
    buscas,
    auditadas,
  };
}

describe("BuscarClienteParaContatoUra", () => {
  it("devolve o Cliente do CNPJ normalizado para a Recepção confirmar", async () => {
    const { buscar, buscas } = montar();
    const r = await buscar.execute({ atendimentoId: "at-1", cnpj: "11.444.777/0001-61" });
    expect(r).toEqual({ ok: true, value: { id: "cli-1", empresa: "Padaria Ltda", cnpj: CNPJ } });
    expect(buscas).toEqual([CNPJ]);
  });

  it("CNPJ inválido é recusado sem consultar", async () => {
    const { buscar, buscas } = montar();
    const r = await buscar.execute({ atendimentoId: "at-1", cnpj: "123" });
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(buscas).toEqual([]);
  });

  it("CNPJ sem Cliente não é encontrado", async () => {
    const r = await montar({ cliente: null }).buscar.execute({ atendimentoId: "at-1", cnpj: CNPJ });
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });

  it("quem não é o dono da Recepção não consulta Clientes", async () => {
    const { buscar, buscas } = montar({ ator: { ...DONO, id: "func-2" } });
    const r = await buscar.execute({ atendimentoId: "at-1", cnpj: CNPJ });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(buscas).toEqual([]);
  });

  it("audita a busca que achou o Cliente, com o CNPJ como alvo", async () => {
    const { buscar, auditadas } = montar();
    await buscar.execute({ atendimentoId: "at-1", cnpj: "11.444.777/0001-61" });
    expect(auditadas).toEqual([
      {
        ator: "func-1",
        setor: "recepcao",
        acao: "contato.buscar-cliente-ura",
        alvo: CNPJ,
        resultado: "sucesso",
      },
    ]);
  });

  it("audita como falha o CNPJ sem Cliente (a busca CNPJ a CNPJ aparece na trilha)", async () => {
    const { buscar, auditadas } = montar({ cliente: null });
    await buscar.execute({ atendimentoId: "at-1", cnpj: CNPJ });
    expect(auditadas).toEqual([expect.objectContaining({ alvo: CNPJ, resultado: "falha" })]);
  });

  it("não audita CNPJ inválido nem quem não pode consultar", async () => {
    const invalido = montar();
    await invalido.buscar.execute({ atendimentoId: "at-1", cnpj: "123" });
    const semPermissao = montar({ ator: { ...DONO, id: "func-2" } });
    await semPermissao.buscar.execute({ atendimentoId: "at-1", cnpj: CNPJ });
    expect(invalido.auditadas).toEqual([]);
    expect(semPermissao.auditadas).toEqual([]);
  });

  it("Atendimento já ligado a um Cliente aceita esse mesmo Cliente", async () => {
    const { buscar } = montar({ atendimento: { ...ATENDIMENTO, clienteId: "cli-1" } });
    const r = await buscar.execute({ atendimentoId: "at-1", cnpj: CNPJ });
    expect(r.ok && r.value.id).toBe("cli-1");
  });

  it("Atendimento já ligado a um Cliente recusa outro Cliente e audita a falha", async () => {
    const { buscar, auditadas } = montar({ atendimento: { ...ATENDIMENTO, clienteId: "cli-9" } });
    const r = await buscar.execute({ atendimentoId: "at-1", cnpj: CNPJ });
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });
});
