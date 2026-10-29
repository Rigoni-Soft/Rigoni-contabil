import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  NovaTransferencia,
  ResultadoTransferencia,
  RoteamentoDoCliente,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { RegistrarAcaoAuditoria } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { MensagemEnviada } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok } from "@/shared/kernel/result";

import { TransferirAtendimento } from "./transferir-atendimento.use-case";

const ATENDIMENTO: AtendimentoEmAndamento = {
  id: "at-1",
  clienteId: "cli-1",
  setor: "recepcao",
  funcionarioId: "func-origem",
  telefone: "5561988887777",
  chave: "61988887777",
  emAvisoDeInatividade: false,
};
const TRANSFERIDO = {
  status: "transferido" as const,
  destinatarioNome: null,
  origemNome: "Beto",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
};
const INPUT = { atendimentoId: "at-1", setorDestino: "contabil" as const, resumo: " DAS " };
const INPUT_SN = { ...INPUT, setorDestino: "simples_nacional" as const };

function montar(
  opcoes: {
    ator?: AtorSessaoDto | null;
    atendimento?: AtendimentoEmAndamento | null;
    resultados?: ResultadoTransferencia[];
    roteamento?: RoteamentoDoCliente | null;
    lider?: string | null;
    envioFalha?: boolean;
  } = {},
) {
  const ator =
    opcoes.ator === undefined
      ? { id: "func-origem", papel: "funcionario" as const, setor: "recepcao" as const }
      : opcoes.ator;
  const resultados = [...(opcoes.resultados ?? [TRANSFERIDO])];
  const transferencias: NovaTransferencia[] = [];
  const anexadas: string[] = [];
  const enviadas: MensagemEnviada[] = [];
  const auditadas: RegistrarAcaoAuditoria[] = [];
  const repo = {
    buscarEmAndamento: async () =>
      ok(opcoes.atendimento === undefined ? ATENDIMENTO : opcoes.atendimento),
    roteamentoDoCliente: async () =>
      ok(
        opcoes.roteamento === undefined
          ? { regime: "simples_nacional", responsavelId: null }
          : opcoes.roteamento,
      ),
    liderDoSetor: async () => ok(opcoes.lider === undefined ? "lider-sn" : opcoes.lider),
    transferir: async (t: NovaTransferencia) => {
      transferencias.push(t);
      return ok(resultados.shift() ?? TRANSFERIDO);
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new TransferirAtendimento(
    { usuarioAtual: async () => ator },
    repo,
    {
      registrar: async (a) => {
        auditadas.push(a);
      },
    },
    {
      execute: async ({ telefone, texto }) => {
        if (opcoes.envioFalha) return err(new ServicoExternoError("meta"));
        enviadas.push({ telefone, texto });
        anexadas.push(texto);
        return ok(undefined);
      },
    },
  );
  return { caso, transferencias, anexadas, enviadas, auditadas };
}

describe("TransferirAtendimento", () => {
  it("sem Responsável nem Líder no Setor, transfere para a espera do Setor e devolve o que o destino recebe", async () => {
    const { caso, transferencias } = montar({ lider: null });
    const r = await caso.execute(INPUT);
    expect(r).toEqual({
      ok: true,
      value: {
        destinatarioNome: null,
        contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
        origemSetor: "recepcao",
        origemNome: "Beto",
        resumo: "DAS",
      },
    });
    expect(transferencias).toHaveLength(1);
    expect(transferencias[0]).toMatchObject({
      atendimentoId: "at-1",
      origemFuncionarioId: "func-origem",
      setorOrigem: "recepcao",
      setorDestino: "contabil",
      dirigidoA: null,
      resumo: "DAS",
      ator: { id: "func-origem", setor: "recepcao" },
    });
  });

  it("avisa o cliente só para aguardar, sem posição, e guarda a Mensagem", async () => {
    const { caso, anexadas, enviadas } = montar();
    await caso.execute(INPUT);
    const texto = "Aguarde, já vamos atendê-lo.";
    expect(enviadas).toEqual([{ telefone: "5561988887777", texto }]);
    expect(anexadas).toEqual([texto]);
  });

  it("só o dono transfere: Líder do Setor, Líder de outro Setor, Admin e outro Funcionário não", async () => {
    const atores = [
      { id: "l", papel: "lider_setor" as const, setor: "recepcao" as const },
      { id: "l2", papel: "lider_setor" as const, setor: "contabil" as const },
      { id: "ad", papel: "admin" as const, setor: "administrativo" as const },
      { id: "x", papel: "funcionario" as const, setor: "recepcao" as const },
    ];
    for (const ator of atores) {
      const { caso, transferencias } = montar({ ator });
      const r = await caso.execute(INPUT);
      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
      expect(transferencias).toEqual([]);
    }
  });

  it("sem sessão: proibido", async () => {
    const r = await montar({ ator: null }).caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("Atendimento inexistente: não encontrado", async () => {
    const r = await montar({ atendimento: null }).caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });

  it("Atendimento em aviso de inatividade não é transferido, sem gravar", async () => {
    const { caso, transferencias } = montar({
      atendimento: { ...ATENDIMENTO, emAvisoDeInatividade: true },
    });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(transferencias).toEqual([]);
  });

  it("recusa o mesmo Setor e resumo vazio, sem gravar", async () => {
    const mesmo = montar();
    const r1 = await mesmo.caso.execute({ ...INPUT, setorDestino: "recepcao" });
    expect(!r1.ok && r1.error.code).toBe("VALIDATION_ERROR");
    const vazio = montar();
    const r2 = await vazio.caso.execute({ ...INPUT, resumo: "   " });
    expect(!r2.ok && r2.error.code).toBe("VALIDATION_ERROR");
    expect([...mesmo.transferencias, ...vazio.transferencias]).toEqual([]);
  });

  it("Atendimento que mudou até a gravação: não encontrado, sem avisar o cliente, audita falha", async () => {
    const { caso, enviadas, auditadas } = montar({ resultados: [{ status: "inexistente" }] });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(enviadas).toEqual([]);
    expect(auditadas).toEqual([
      {
        ator: "func-origem",
        setor: "recepcao",
        acao: "atendimento.transferir",
        alvo: "at-1",
        resultado: "falha",
      },
    ]);
  });

  it("transferido mas aviso falhou: estado inconsistente apontando o Atendimento, sem gravar Mensagem que o cliente não recebeu", async () => {
    const { caso, anexadas } = montar({ envioFalha: true });
    const r = await caso.execute(INPUT);
    expect(!r.ok && r.error).toMatchObject({ code: "INCONSISTENT_STATE", referenciaId: "at-1" });
    expect(anexadas).toEqual([]);
  });

  it("recusa resumo acima de 1000 caracteres, sem gravar; aceita exatamente 1000", async () => {
    const longo = montar();
    const r1 = await longo.caso.execute({ ...INPUT, resumo: "a".repeat(1001) });
    expect(!r1.ok && r1.error.code).toBe("VALIDATION_ERROR");
    expect(longo.transferencias).toEqual([]);

    const limite = montar();
    expect((await limite.caso.execute({ ...INPUT, resumo: "a".repeat(1000) })).ok).toBe(true);
  });

  describe("para qualquer Setor (a regra é do sistema)", () => {
    it("fica dirigido ao Responsável do Cliente naquele Setor", async () => {
      const { caso, transferencias } = montar({
        roteamento: { regime: "lucro_presumido", responsavelId: "resp-contabil" },
      });
      const r = await caso.execute(INPUT);
      expect(r.ok).toBe(true);
      expect(transferencias[0]).toMatchObject({
        setorDestino: "contabil",
        dirigidoA: "resp-contabil",
      });
    });

    it("sem Responsável fica dirigido ao Líder do Setor de destino", async () => {
      const { caso, transferencias } = montar({
        roteamento: { regime: "lucro_presumido", responsavelId: null },
        lider: "lider-contabil",
      });
      await caso.execute(INPUT);
      expect(transferencias[0]).toMatchObject({ dirigidoA: "lider-contabil" });
    });

    it("a Recepção é exceção: espera comum, mesmo com Líder", async () => {
      const { caso, transferencias } = montar({
        ator: { id: "func-origem", papel: "funcionario", setor: "contabil" },
        atendimento: { ...ATENDIMENTO, setor: "contabil" },
        lider: "lider-recepcao",
      });
      const r = await caso.execute({ ...INPUT, setorDestino: "recepcao" });
      expect(r.ok).toBe(true);
      expect(transferencias[0]).toMatchObject({ setorDestino: "recepcao", dirigidoA: null });
    });

    it("Atendimento sem Cliente identificado também vai ao Líder, sem recusar", async () => {
      const { caso, transferencias } = montar({
        atendimento: { ...ATENDIMENTO, clienteId: null },
        lider: "lider-contabil",
      });
      const r = await caso.execute(INPUT);
      expect(r.ok).toBe(true);
      expect(transferencias[0]).toMatchObject({ dirigidoA: "lider-contabil" });
    });
  });

  describe("para o Simples Nacional", () => {
    it("fica dirigido ao Responsável do Cliente", async () => {
      const { caso, transferencias } = montar({
        roteamento: { regime: "mei", responsavelId: "resp-1" },
      });
      const r = await caso.execute(INPUT_SN);
      expect(r.ok).toBe(true);
      expect(transferencias).toHaveLength(1);
      expect(transferencias[0]).toMatchObject({ dirigidoA: "resp-1" });
    });

    it("sem Responsável fica dirigido ao Líder do Setor", async () => {
      const { caso, transferencias } = montar();
      await caso.execute(INPUT_SN);
      expect(transferencias[0]).toMatchObject({ dirigidoA: "lider-sn" });
    });

    it("sem Responsável nem Líder fica na espera do Setor (sem destino)", async () => {
      const { caso, transferencias } = montar({ lider: null });
      await caso.execute(INPUT_SN);
      expect(transferencias[0]).toMatchObject({ dirigidoA: null });
    });

    it("destinatário que deixou de ser elegível no meio: erro, sem avisar o cliente", async () => {
      const { caso, enviadas } = montar({
        roteamento: { regime: "simples_nacional", responsavelId: "resp-1" },
        resultados: [{ status: "conflito" }],
      });
      const r = await caso.execute(INPUT_SN);
      expect(r.ok).toBe(false);
      expect(enviadas).toEqual([]);
    });

    it("recusa Cliente de outro Regime e Atendimento sem Cliente, sem gravar", async () => {
      const outroRegime = montar({ roteamento: { regime: "lucro_real", responsavelId: null } });
      const r1 = await outroRegime.caso.execute(INPUT_SN);
      expect(!r1.ok && r1.error.code).toBe("VALIDATION_ERROR");
      const semCliente = montar({ atendimento: { ...ATENDIMENTO, clienteId: null } });
      const r2 = await semCliente.caso.execute(INPUT_SN);
      expect(!r2.ok && r2.error.code).toBe("VALIDATION_ERROR");
      expect([...outroRegime.transferencias, ...semCliente.transferencias]).toEqual([]);
    });
  });
});
