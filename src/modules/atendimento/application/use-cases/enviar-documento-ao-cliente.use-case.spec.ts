import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { EnviarDocumentoAoCliente } from "./enviar-documento-ao-cliente.use-case";

const ATENDIMENTO: AtendimentoEmAndamento = {
  id: "at-1",
  clienteId: "cli-1",
  setor: "contabil",
  funcionarioId: "func-1",
  telefone: "5561988887777",
  chave: "61988887777",
  emAvisoDeInatividade: false,
};
const FUNCIONARIO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };
const CONTRATO = { tipo: "contrato" as const, data: null };
const ALTERACAO = { tipo: "alteracao" as const, data: "2026-03-01" };

type Opcoes = {
  ator?: AtorSessaoDto | null;
  atendimento?: AtendimentoEmAndamento | null;
  falhaEnvio?: boolean;
  falhaRegistro?: boolean;
  falhaFinalizar?: boolean;
  veredito?: "registrada" | "encerrada" | "sem_autoridade";
};

function montar({
  ator = FUNCIONARIO,
  atendimento = ATENDIMENTO,
  falhaEnvio = false,
  falhaRegistro = false,
  falhaFinalizar = false,
  veredito = "registrada",
}: Opcoes = {}) {
  const enviados: unknown[] = [];
  const registradas: unknown[] = [];
  const finalizadas: unknown[] = [];
  const auditadas: unknown[] = [];
  const repo = {
    buscarEmAndamento: async () => ok(atendimento),
    registrarMensagemDoFuncionario: async (...args: unknown[]) => {
      registradas.push(args);
      if (falhaRegistro) return err(new ServicoExternoError("banco"));
      return ok(veredito === "registrada" ? { status: veredito, id: "m-1" } : { status: veredito });
    },
    finalizarEntregaDoFuncionario: async (id: string, entregue: boolean) => {
      finalizadas.push({ id, entregue });
      return falhaFinalizar ? err(new ServicoExternoError("banco")) : ok(undefined);
    },
  } as unknown as AtendimentoRepositoryPort;
  const documentos = {
    listar: async () =>
      ok([
        { ...CONTRATO, numero: null, caminho: "a/contrato.pdf" },
        { ...ALTERACAO, numero: 3, caminho: "a/alteracao.pdf" },
      ]),
    linkTemporario: async (caminho: string) => ok(`https://link/${caminho}`),
  } as unknown as DocumentosContratuaisPort;
  const envio = {
    enviarDocumento: async (d: unknown) => {
      enviados.push(d);
      return falhaEnvio ? err(new ServicoExternoError("meta")) : ok(undefined);
    },
  } as unknown as EnvioMensagemPort;
  const auditoria: AuditoriaPort = { registrar: async (a) => void auditadas.push(a) };
  return {
    enviados,
    registradas,
    finalizadas,
    auditadas,
    caso: new EnviarDocumentoAoCliente(
      { usuarioAtual: async () => ator },
      repo,
      documentos,
      envio,
      auditoria,
    ),
  };
}

describe("EnviarDocumentoAoCliente", () => {
  it("envia o documento ao telefone do Atendimento, registra a Mensagem de quem enviou e audita", async () => {
    const { caso, enviados, registradas, auditadas } = montar();
    const r = await caso.execute({ atendimentoId: "at-1", documento: ALTERACAO });
    expect(r.ok).toBe(true);
    expect(enviados).toEqual([
      {
        telefone: "5561988887777",
        url: "https://link/a/alteracao.pdf",
        nomeArquivo: "Alteração nº 3 - 01/03/2026.pdf",
        chaveIdempotencia: "m-1",
      },
    ]);
    expect(registradas).toEqual([
      ["at-1", FUNCIONARIO, "Enviou ao cliente: Alteração nº 3 - 01/03/2026"],
    ]);
    expect(auditadas).toEqual([
      {
        ator: "func-1",
        setor: "contabil",
        acao: "atendimento.enviar_documento",
        alvo: "at-1",
        resultado: "sucesso",
      },
    ]);
  });

  it("o Líder do Setor envia em nome do Atendimento; outro Funcionário não", async () => {
    const outro = montar({ ator: { ...FUNCIONARIO, id: "func-2" } });
    const negado = await outro.caso.execute({ atendimentoId: "at-1", documento: CONTRATO });
    expect(!negado.ok && negado.error.code).toBe("FORBIDDEN");
    expect(outro.enviados).toEqual([]);

    const lider = montar({ ator: { id: "lid", papel: "lider_setor", setor: "contabil" } });
    expect((await lider.caso.execute({ atendimentoId: "at-1", documento: CONTRATO })).ok).toBe(
      true,
    );
    expect(lider.registradas).toEqual([
      [
        "at-1",
        { id: "lid", papel: "lider_setor", setor: "contabil" },
        "Enviou ao cliente: Contrato social",
      ],
    ]);
  });

  it("recusa sem sessão, Atendimento que não está em andamento, sem Cliente e documento que o Cliente não tem", async () => {
    const semSessao = await montar({ ator: null }).caso.execute({
      atendimentoId: "at-1",
      documento: CONTRATO,
    });
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");

    const inexistente = await montar({ atendimento: null }).caso.execute({
      atendimentoId: "at-1",
      documento: CONTRATO,
    });
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");

    const semCliente = await montar({
      atendimento: { ...ATENDIMENTO, clienteId: null },
    }).caso.execute({ atendimentoId: "at-1", documento: CONTRATO });
    expect(!semCliente.ok && semCliente.error.code).toBe("VALIDATION_ERROR");

    const naoTem = await montar().caso.execute({
      atendimentoId: "at-1",
      documento: { tipo: "alteracao", data: "2020-01-01" },
    });
    expect(!naoTem.ok && naoTem.error.code).toBe("NOT_FOUND");
  });

  it("falha do envio fecha a Mensagem como falha (não a apaga) e audita a falha", async () => {
    const { caso, finalizadas, auditadas } = montar({ falhaEnvio: true });
    const r = await caso.execute({ atendimentoId: "at-1", documento: CONTRATO });
    expect(r.ok).toBe(false);
    expect(finalizadas).toEqual([{ id: "m-1", entregue: false }]);
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("falha ao fechar a linha depois do aceite não vira erro (fica pendente)", async () => {
    const { caso, enviados } = montar({ falhaFinalizar: true });
    const r = await caso.execute({ atendimentoId: "at-1", documento: CONTRATO });
    expect(r.ok).toBe(true);
    expect(enviados).toHaveLength(1);
  });

  it("falha ao registrar não envia nada (a Mensagem entra antes de sair)", async () => {
    const { caso, enviados } = montar({ falhaRegistro: true });
    const r = await caso.execute({ atendimentoId: "at-1", documento: CONTRATO });
    expect(r.ok).toBe(false);
    expect(enviados).toEqual([]);
  });

  it("fechamento ou perda de autoridade durante a operação: nada é enviado", async () => {
    const fechado = montar({ veredito: "encerrada" });
    const a = await fechado.caso.execute({ atendimentoId: "at-1", documento: CONTRATO });
    expect(!a.ok && a.error.code).toBe("NOT_FOUND");
    expect(fechado.enviados).toEqual([]);

    const semAutoridade = montar({ veredito: "sem_autoridade" });
    const b = await semAutoridade.caso.execute({ atendimentoId: "at-1", documento: CONTRATO });
    expect(!b.ok && b.error.code).toBe("FORBIDDEN");
    expect(semAutoridade.enviados).toEqual([]);
  });
});
