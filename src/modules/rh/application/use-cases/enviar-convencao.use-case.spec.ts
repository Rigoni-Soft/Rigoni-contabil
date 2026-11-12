import type { ArmazenamentoDeConvencaoPort } from "@/modules/rh/application/ports/out/armazenamento-de-convencao.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { ExtratorDeRegrasPort } from "@/modules/rh/application/ports/out/extrator-de-regras.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { EnviarConvencao } from "@/modules/rh/application/use-cases/enviar-convencao.use-case";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { err, ok } from "@/shared/kernel/result";

const CLIENTE = "11111111-1111-4111-8111-111111111111";
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };
const PDF = Uint8Array.from(Buffer.from("%PDF-1.7 convenção"));

const ENTRADA = {
  clienteId: CLIENTE,
  arquivo: { nome: "cct-2026.pdf", bytes: PDF },
};

function montar(ator: AtorSessaoDto | null = LIDER) {
  const folha = {
    buscarCliente: jest.fn().mockResolvedValue(ok({ cnpj: "11444777009821", responsavelId: "x" })),
  } as unknown as jest.Mocked<FolhaDePontoRepository>;
  const convencoes: jest.Mocked<ConvencaoRepository> = {
    listar: jest.fn(),
    inserir: jest.fn().mockResolvedValue(ok(undefined)),
  };
  const armazenamento: jest.Mocked<ArmazenamentoDeConvencaoPort> = {
    enviar: jest.fn().mockResolvedValue(ok(undefined)),
    remover: jest.fn().mockResolvedValue(ok(undefined)),
  };
  const extrator: jest.Mocked<ExtratorDeRegrasPort> = {
    extrair: jest.fn().mockResolvedValue({
      lido: true,
      sindicato: " Comércio varejista de Cascavel ",
      vigenciaInicio: "2026-05-01",
      vigenciaFim: "2027-04-30",
      candidatas: [
        {
          chave: "extra_sabado",
          valor: 60,
          clausula: "Cláusula 12ª",
          trecho: "Horas extras aos sábados com adicional de 60%.",
        },
        { chave: "jornada_diaria", valor: 999, clausula: "Cláusula 3ª", trecho: "jornada de 8h" },
      ],
    }),
  };
  const auditoria: jest.Mocked<AuditoriaPort> = { registrar: jest.fn() };
  const erros: jest.Mocked<RegistroDeErrosPort> = { registrar: jest.fn() };
  const caso = new EnviarConvencao(
    { usuarioAtual: jest.fn().mockResolvedValue(ator) },
    folha,
    convencoes,
    armazenamento,
    extrator,
    auditoria,
    erros,
  );
  return { caso, folha, convencoes, armazenamento, extrator, auditoria, erros };
}

describe("EnviarConvencao", () => {
  it("guarda o PDF, extrai as regras e grava o conjunto validado, com o que sobrou rejeitado", async () => {
    const { caso, convencoes, armazenamento } = montar();

    const r = await caso.execute(ENTRADA);

    expect(r.ok).toBe(true);
    const caminho = armazenamento.enviar.mock.calls[0][0];
    expect(caminho).toMatch(new RegExp(`^${CLIENTE}/[0-9a-f-]{36}\\.pdf$`));
    expect(convencoes.inserir).toHaveBeenCalledWith({
      clienteId: CLIENTE,
      sindicato: "Comércio varejista de Cascavel",
      vigenciaInicio: "2026-05-01",
      vigenciaFim: "2027-04-30",
      arquivoCaminho: caminho,
      arquivoNome: "cct-2026.pdf",
      regras: {
        versao: 1,
        aplicadas: [
          {
            chave: "extra_sabado",
            valor: 60,
            clausula: "Cláusula 12ª",
            trecho: "Horas extras aos sábados com adicional de 60%.",
          },
        ],
        rejeitadas: [{ chave: "jornada_diaria", motivo: "fora_do_trecho" }],
      },
    });
  });

  it("o Admin também sobe a convenção", async () => {
    const { caso } = montar({ id: "adm", papel: "admin", setor: "sn" });
    expect((await caso.execute(ENTRADA)).ok).toBe(true);
  });

  it.each([
    ["Funcionário do RH", { id: "f", papel: "funcionario", setor: "rh" }],
    ["Líder de outro setor", { id: "l", papel: "lider_setor", setor: "sn" }],
    ["sem sessão", null],
  ])("recusa %s, audita a tentativa e não guarda nada", async (_nome, ator) => {
    const { caso, armazenamento, extrator, auditoria } = montar(ator);

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(armazenamento.enviar).not.toHaveBeenCalled();
    expect(extrator.extrair).not.toHaveBeenCalled();
    if (ator) {
      expect(auditoria.registrar).toHaveBeenCalledWith({
        ator: ator.id,
        setor: ator.setor,
        acao: "rh.convencao.enviar",
        alvo: "11444777009821",
        resultado: "falha",
      });
    }
  });

  it("recusa Cliente inexistente", async () => {
    const { caso, folha } = montar();
    folha.buscarCliente.mockResolvedValue(ok(null));

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });

  it.each([
    [
      "arquivo que não é PDF",
      { arquivo: { nome: "a.pdf", bytes: Uint8Array.from(Buffer.from("MZ")) } },
    ],
    [
      "nome do arquivo com mais de 255 caracteres",
      { arquivo: { nome: "a".repeat(256), bytes: PDF } },
    ],
    ["arquivo vazio", { arquivo: { nome: "a.pdf", bytes: new Uint8Array() } }],
    [
      "arquivo acima de 10 MB",
      { arquivo: { nome: "a.pdf", bytes: new Uint8Array(10 * 1024 * 1024 + 1).fill(37) } },
    ],
  ])("recusa %s antes de guardar", async (_nome, troca) => {
    const { caso, armazenamento } = montar();

    const r = await caso.execute({ ...ENTRADA, ...troca });

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(armazenamento.enviar).not.toHaveBeenCalled();
  });

  it.each([
    ["sem sindicato", { sindicato: "  " }],
    ["vigência invertida", { vigenciaInicio: "2027-05-01", vigenciaFim: "2027-04-30" }],
    ["data inexistente", { vigenciaInicio: "2026-02-31" }],
  ])("tira o PDF do armazenamento e não grava quando a extração vem %s", async (_nome, troca) => {
    const { caso, extrator, armazenamento, convencoes } = montar();
    const lida = await extrator.extrair(PDF);
    extrator.extrair.mockResolvedValue({ ...lida, ...troca } as typeof lida);

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.message).toBe(
      "Não foi possível identificar o sindicato e a vigência no PDF.",
    );
    expect(armazenamento.remover).toHaveBeenCalledWith(armazenamento.enviar.mock.calls[0][0]);
    expect(convencoes.inserir).not.toHaveBeenCalled();
  });

  it("tira o PDF do armazenamento e não grava quando a extração falha", async () => {
    const { caso, extrator, armazenamento, convencoes } = montar();
    extrator.extrair.mockResolvedValue({ lido: false });

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(armazenamento.remover).toHaveBeenCalledWith(armazenamento.enviar.mock.calls[0][0]);
    expect(convencoes.inserir).not.toHaveBeenCalled();
  });

  it("tira o PDF do armazenamento e não grava quando o extrator lança (#219)", async () => {
    const { caso, extrator, armazenamento, convencoes } = montar();
    extrator.extrair.mockRejectedValue(new Error("timeout"));

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("PERSISTENCIA_ERROR");
    expect(armazenamento.remover).toHaveBeenCalledWith(armazenamento.enviar.mock.calls[0][0]);
    expect(convencoes.inserir).not.toHaveBeenCalled();
  });

  it("tira o PDF do armazenamento quando gravar a convenção falha", async () => {
    const { caso, convencoes, armazenamento } = montar();
    convencoes.inserir.mockResolvedValue(err(new PersistenciaError("falhou")));

    const r = await caso.execute(ENTRADA);

    expect(r.ok).toBe(false);
    expect(armazenamento.remover).toHaveBeenCalledWith(armazenamento.enviar.mock.calls[0][0]);
  });

  it("registra o PDF órfão quando nem a remoção dá certo", async () => {
    const { caso, convencoes, armazenamento, erros } = montar();
    convencoes.inserir.mockResolvedValue(err(new PersistenciaError("falhou")));
    armazenamento.remover.mockResolvedValue(err(new PersistenciaError("bucket fora")));

    await caso.execute(ENTRADA);

    expect(erros.registrar).toHaveBeenCalledWith(
      "rh.convencao.arquivo_orfao",
      armazenamento.enviar.mock.calls[0][0],
      "bucket fora",
    );
  });

  it("não segue adiante quando o armazenamento falha", async () => {
    const { caso, armazenamento, extrator } = montar();
    armazenamento.enviar.mockResolvedValue(err(new PersistenciaError("sem disco")));

    const r = await caso.execute(ENTRADA);

    expect(r.ok).toBe(false);
    expect(extrator.extrair).not.toHaveBeenCalled();
  });
});
