import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { GuiasFiscaisPort } from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
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
const CONTRATO = { tipo: "contrato" as const, numero: null };
const ALTERACAO = { tipo: "alteracao" as const, numero: 3 };

type Opcoes = {
  ator?: AtorSessaoDto | null;
  atendimento?: AtendimentoEmAndamento | null;
  falhaEnvio?: boolean;
  falhaRegistro?: boolean;
  falhaFinalizar?: boolean;
  veredito?: "registrada" | "encerrada" | "sem_autoridade";
  guia?: "ok" | "sem_autorizacao" | "lanca";
};

function montar({
  ator = FUNCIONARIO,
  atendimento = ATENDIMENTO,
  falhaEnvio = false,
  falhaRegistro = false,
  falhaFinalizar = false,
  veredito = "registrada",
  guia = "ok",
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
        { ...CONTRATO, data: null, caminho: "a/contrato.pdf" },
        { ...ALTERACAO, data: "2026-03-01", caminho: "a/alteracao.pdf" },
        // Mesma data da nº 3: só o nº distingue as duas.
        { tipo: "alteracao", numero: 2, data: "2026-03-01", caminho: "a/alteracao-2.pdf" },
      ]),
    linkTemporario: async (caminho: string) => ok(`https://link/${caminho}`),
  } as unknown as DocumentosContratuaisPort;
  const guias: GuiasFiscaisPort = {
    buscar: async () => {
      if (guia === "lanca") throw new Error("boom");
      if (guia === "sem_autorizacao") return err(new ForbiddenError("sem procuração"));
      return ok({ nomeArquivo: "guia.pdf", pdfBase64: "UERG" });
    },
  };
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
      guias,
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

  it("duas alterações na mesma data: envia a de nº escolhido, não a primeira da data", async () => {
    const { caso, enviados } = montar();
    const r = await caso.execute({
      atendimentoId: "at-1",
      documento: { tipo: "alteracao", numero: 2 },
    });
    expect(r.ok).toBe(true);
    expect(enviados).toEqual([
      expect.objectContaining({
        url: "https://link/a/alteracao-2.pdf",
        nomeArquivo: "Alteração nº 2 - 01/03/2026.pdf",
      }),
    ]);
  });

  it.each([
    ["das", "Guia de imposto"],
    ["parcelamento", "Guia de parcelamento"],
    ["cnd", "CND"],
  ] as const)(
    "guia %s: busca no provedor fiscal, envia o PDF, registra a Mensagem e audita",
    async (tipo, rotulo) => {
      const { caso, enviados, registradas, finalizadas, auditadas } = montar();
      const r = await caso.execute({ atendimentoId: "at-1", documento: { tipo, numero: null } });
      expect(r.ok).toBe(true);
      expect(enviados).toEqual([
        {
          telefone: "5561988887777",
          nomeArquivo: "guia.pdf",
          pdfBase64: "UERG",
          chaveIdempotencia: "m-1",
        },
      ]);
      expect(registradas).toEqual([["at-1", FUNCIONARIO, `Enviou ao cliente: ${rotulo}`]]);
      expect(finalizadas).toEqual([{ id: "m-1", entregue: true }]);
      expect(auditadas).toEqual([expect.objectContaining({ resultado: "sucesso" })]);
    },
  );

  it("guia sem autorização fiscal do Cliente: devolve o erro, audita a falha e não registra nem envia nada", async () => {
    const { caso, enviados, registradas, auditadas } = montar({ guia: "sem_autorizacao" });
    const r = await caso.execute({
      atendimentoId: "at-1",
      documento: { tipo: "das", numero: null },
    });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(registradas).toEqual([]);
    expect(enviados).toEqual([]);
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha", alvo: "at-1" })]);
  });

  it("falha inesperada do provedor fiscal vira erro de serviço externo, é auditada e logada só com a mensagem", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { caso, enviados, registradas, auditadas } = montar({ guia: "lanca" });
    const r = await caso.execute({
      atendimentoId: "at-1",
      documento: { tipo: "cnd", numero: null },
    });
    expect(!r.ok && r.error).toBeInstanceOf(ServicoExternoError);
    expect(registradas).toEqual([]);
    expect(enviados).toEqual([]);
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
    // Só a mensagem, nunca o objeto de erro (poderia levar o CNPJ ao log).
    expect(log).toHaveBeenCalledWith("Falha inesperada ao buscar a guia cnd:", "boom");
    log.mockRestore();
  });

  it("documento que o Cliente não tem também audita a falha", async () => {
    const { caso, auditadas } = montar();
    const r = await caso.execute({
      atendimentoId: "at-1",
      documento: { tipo: "alteracao", numero: 99 },
    });
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(auditadas).toEqual([expect.objectContaining({ resultado: "falha" })]);
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
      documento: { tipo: "alteracao", numero: 99 },
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
