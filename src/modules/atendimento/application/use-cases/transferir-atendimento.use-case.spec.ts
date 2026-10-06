import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  FuncionarioDoSetor,
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
};
const TRANSFERIDO = {
  status: "transferido" as const,
  naFila: false,
  destinatarioNome: "Ana",
  origemNome: "Beto",
  contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
};
const INPUT = { atendimentoId: "at-1", setorDestino: "contabil" as const, resumo: " DAS " };
const INPUT_SN = { ...INPUT, setorDestino: "simples_nacional" as const };

function montar(
  opcoes: {
    ator?: AtorSessaoDto | null;
    atendimento?: AtendimentoEmAndamento | null;
    funcionarios?: FuncionarioDoSetor[];
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
    funcionariosDoSetor: async () =>
      ok(opcoes.funcionarios ?? [{ id: "func-destino", atendimentosNoMes: 0, livre: true }]),
    transferir: async (t: NovaTransferencia) => {
      transferencias.push(t);
      return ok(resultados.shift() ?? TRANSFERIDO);
    },
    anexarMensagem: async (_chave: string, m: { texto: string }) => {
      anexadas.push(m.texto);
      return ok({ anexada: true });
    },
  } as unknown as AtendimentoRepositoryPort;
  const caso = new TransferirAtendimento(
    { usuarioAtual: async () => ator },
    repo,
    {
      enviar: async (m) => {
        if (opcoes.envioFalha) return err(new ServicoExternoError("meta"));
        enviadas.push(m);
        return ok(undefined);
      },
      enviarDocumento: async () => ok(undefined),
    },
    {
      registrar: async (a) => {
        auditadas.push(a);
      },
    },
  );
  return { caso, transferencias, anexadas, enviadas, auditadas };
}

describe("TransferirAtendimento", () => {
  it("transfere ao Funcionário menos carregado e devolve o que o destino recebe", async () => {
    const { caso, transferencias } = montar({
      funcionarios: [
        { id: "a", atendimentosNoMes: 5, livre: true },
        { id: "b", atendimentosNoMes: 2, livre: true },
        { id: "c", atendimentosNoMes: 0, livre: false },
      ],
    });
    const r = await caso.execute(INPUT);
    expect(r).toEqual({
      ok: true,
      value: {
        destinatarioNome: "Ana",
        naFila: false,
        contato: { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" },
        origemSetor: "recepcao",
        origemNome: "Beto",
        resumo: "DAS",
      },
    });
    expect(transferencias[0]).toMatchObject({
      atendimentoId: "at-1",
      origemFuncionarioId: "func-origem",
      setorDestino: "contabil",
      funcionarioDestinoId: "b",
      enfileirarSeOcupado: false,
      resumo: "DAS",
      ator: { id: "func-origem", setor: "recepcao" },
    });
  });

  it("avisa o cliente nomeando o Setor e o atendente, e guarda a Mensagem", async () => {
    const { caso, anexadas, enviadas } = montar();
    await caso.execute(INPUT);
    const texto =
      "Estamos transferindo você para o setor Contábil, com Ana. Aguarde um instante, por favor.";
    expect(enviadas).toEqual([{ telefone: "5561988887777", texto }]);
    expect(anexadas).toEqual([texto]);
  });

  it("sem Funcionário livre transfere sem atribuição e o aviso nomeia só o Setor", async () => {
    const { caso, transferencias, enviadas } = montar({
      funcionarios: [],
      resultados: [{ ...TRANSFERIDO, destinatarioNome: null }],
    });
    await caso.execute(INPUT);
    expect(transferencias[0].funcionarioDestinoId).toBeNull();
    expect(enviadas[0].texto).toBe("Você está na fila do setor Contábil. Aguarde, por favor.");
  });

  it("relista e tenta de novo no conflito; esgotadas as tentativas transfere sem atribuição", async () => {
    const conflito: ResultadoTransferencia = { status: "conflito" };
    const { caso, transferencias } = montar({ resultados: [conflito, conflito, conflito] });
    const r = await caso.execute(INPUT);
    expect(r.ok).toBe(true);
    expect(transferencias.map((t) => t.funcionarioDestinoId)).toEqual([
      "func-destino",
      "func-destino",
      "func-destino",
      null,
    ]);
  });

  it("Líder do Setor do Atendimento e Admin transferem; outro Funcionário não", async () => {
    const lider = { id: "l", papel: "lider_setor" as const, setor: "recepcao" as const };
    const admin = { id: "ad", papel: "admin" as const, setor: "administrativo" as const };
    const outro = { id: "x", papel: "funcionario" as const, setor: "recepcao" as const };
    expect((await montar({ ator: lider }).caso.execute(INPUT)).ok).toBe(true);
    expect((await montar({ ator: admin }).caso.execute(INPUT)).ok).toBe(true);
    const negado = montar({ ator: outro });
    const r = await negado.caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(negado.transferencias).toEqual([]);
  });

  it("Líder de outro Setor não transfere", async () => {
    const r = await montar({
      ator: { id: "l", papel: "lider_setor" as const, setor: "contabil" as const },
    }).caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("sem sessão: proibido", async () => {
    const r = await montar({ ator: null }).caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("Atendimento inexistente: não encontrado", async () => {
    const r = await montar({ atendimento: null }).caso.execute(INPUT);
    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
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

  describe("para o Simples Nacional", () => {
    it("vai direto ao Responsável do Cliente, ignorando o Balanceamento", async () => {
      const { caso, transferencias } = montar({
        roteamento: { regime: "mei", responsavelId: "resp-1" },
        funcionarios: [{ id: "livre", atendimentosNoMes: 0, livre: true }],
      });
      const r = await caso.execute(INPUT_SN);
      expect(r.ok).toBe(true);
      expect(transferencias).toHaveLength(1);
      expect(transferencias[0]).toMatchObject({
        funcionarioDestinoId: "resp-1",
        enfileirarSeOcupado: true,
      });
    });

    it("sem Responsável vai ao Líder do Setor", async () => {
      const { caso, transferencias } = montar();
      await caso.execute(INPUT_SN);
      expect(transferencias[0]).toMatchObject({
        funcionarioDestinoId: "lider-sn",
        enfileirarSeOcupado: true,
      });
    });

    it("sem Responsável nem Líder fica na fila do Setor (sem destino)", async () => {
      const { caso, transferencias } = montar({ lider: null });
      await caso.execute(INPUT_SN);
      expect(transferencias[0]).toMatchObject({ funcionarioDestinoId: null });
    });

    it("destino ocupado: entra na fila dele e o aviso diz isso", async () => {
      const { caso, enviadas } = montar({
        roteamento: { regime: "simples_nacional", responsavelId: "resp-1" },
        resultados: [{ ...TRANSFERIDO, naFila: true }],
      });
      const r = await caso.execute(INPUT_SN);
      expect(r.ok && r.value.naFila).toBe(true);
      expect(enviadas[0].texto).toBe(
        "Você está na fila de atendimento de Ana no setor Simples Nacional. Aguarde, por favor.",
      );
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
