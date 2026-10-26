import type { AnexarGuiaParcelaPgfnInput } from "@/modules/clientes/application/ports/in/anexar-guia-parcela-pgfn.provider";
import type { ArquivoInspecionavelPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  GuiaParcelaPgfnRepository,
  ParcelamentoDaGuia,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { AnexarGuiaParcelaPgfn } from "./anexar-guia-parcela-pgfn.use-case";

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const PARCELAMENTO_ID = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "f-1", papel: "funcionario", setor: "simples_nacional" };
  async usuarioAtual() {
    return this.ator;
  }
}

class StorageFalso implements ArquivoInspecionavelPort {
  enviados: string[] = [];
  removidos: string[] = [];
  falharAoRemover = false;
  objeto: { tipoMime: string; tamanho: number } | null = {
    tipoMime: "application/pdf",
    tamanho: 1000,
  };
  async enviar(caminho: string): Promise<Result<{ caminho: string }, AppError>> {
    this.enviados.push(caminho);
    return ok({ caminho });
  }
  async inspecionar() {
    return ok(this.objeto);
  }
  async remover(caminhos: string[]): Promise<Result<void, AppError>> {
    if (this.falharAoRemover) return err(new ValidationError("falha ao remover"));
    this.removidos.push(...caminhos);
    return ok(undefined);
  }
}

const INPUT: AnexarGuiaParcelaPgfnInput = {
  parcelamentoId: PARCELAMENTO_ID,
  competencia: "202610",
  contaNegociacao: " 123456 ",
  arquivo: new File(["pdf"], "guia.pdf", { type: "application/pdf" }),
};

function montar(
  parcelamento: ParcelamentoDaGuia | null = { clienteId: CLIENTE_ID, origem: "pgfn" },
) {
  const sessao = new SessaoFalsa();
  const anexar = jest
    .fn<Promise<Result<void, AppError>>, unknown[]>()
    .mockResolvedValue(ok(undefined));
  const gravada = jest
    .fn<Promise<Result<boolean, AppError>>, unknown[]>()
    .mockResolvedValue(ok(false));
  const guias = {
    parcelamento: async () => ok(parcelamento),
    anexar,
    gravada,
  } as unknown as GuiaParcelaPgfnRepository;
  const storage = new StorageFalso();
  return {
    sessao,
    anexar,
    gravada,
    storage,
    caso: new AnexarGuiaParcelaPgfn(sessao, guias, storage),
  };
}

describe("AnexarGuiaParcelaPgfn", () => {
  it("sobe o PDF no prefixo do Parcelamento e grava a guia a confirmar", async () => {
    const { caso, anexar, storage } = montar();

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({
      ok: true,
      value: { competencia: "202610", contaNegociacao: "123456", estado: "a_confirmar" },
    });
    expect(storage.enviados).toHaveLength(1);
    expect(storage.enviados[0]).toMatch(
      new RegExp(`^${CLIENTE_ID}/guias-pgfn/${PARCELAMENTO_ID}/202610-[0-9a-f-]{36}\\.pdf$`),
    );
    expect(anexar).toHaveBeenCalledWith(PARCELAMENTO_ID, {
      competencia: "202610",
      contaNegociacao: "123456",
      arquivoCaminho: storage.enviados[0],
    });
    expect(storage.removidos).toEqual([]);
  });

  it.each([
    ["Funcionário de outro Setor", { id: "f-2", papel: "funcionario", setor: "financeiro" }],
    ["sem sessão", null],
  ])("%s é recusado antes de qualquer upload", async (_nome, ator) => {
    const { caso, sessao, storage } = montar();
    sessao.ator = ator;

    expect(await caso.execute(INPUT)).toMatchObject({
      ok: false,
      error: expect.any(ForbiddenError),
    });
    expect(storage.enviados).toEqual([]);
  });

  it("Parcelamento inexistente ou escondido pela RLS: não encontrado, sem upload", async () => {
    const { caso, storage } = montar(null);

    expect(await caso.execute(INPUT)).toMatchObject({
      ok: false,
      error: expect.any(NotFoundError),
    });
    expect(storage.enviados).toEqual([]);
  });

  it.each(["receita_federal", null] as const)(
    "Parcelamento de origem %p não recebe guia",
    async (origem) => {
      const { caso, storage } = montar({ clienteId: CLIENTE_ID, origem });

      expect(await caso.execute(INPUT)).toMatchObject({
        ok: false,
        error: expect.any(ValidationError),
      });
      expect(storage.enviados).toEqual([]);
    },
  );

  it("competência inválida é recusada antes do upload", async () => {
    const { caso, storage } = montar();

    const resultado = await caso.execute({ ...INPUT, competencia: "202613" });

    expect(resultado).toMatchObject({ ok: false, error: expect.any(ValidationError) });
    expect(storage.enviados).toEqual([]);
  });

  it.each([
    ["outro tipo", { tipoMime: "image/png", tamanho: 10 }],
    ["mais de 4 MB", { tipoMime: "application/pdf", tamanho: 4 * 1024 * 1024 + 1 }],
    ["objeto ausente", null],
  ])("Storage com %s: recusa e apaga o objeto, sem gravar", async (_nome, objeto) => {
    const { caso, anexar, storage } = montar();
    storage.objeto = objeto;

    expect(await caso.execute(INPUT)).toMatchObject({
      ok: false,
      error: expect.any(ValidationError),
    });
    expect(anexar).not.toHaveBeenCalled();
    expect(storage.removidos).toEqual(storage.enviados);
  });

  it("recusa do banco (segundo anexo, competência enviada) apaga o objeto e devolve o motivo", async () => {
    const { caso, anexar, storage } = montar();
    anexar.mockResolvedValue(
      err(new ValidationError("Já existe guia anexada para esta competência.")),
    );

    const resultado = await caso.execute(INPUT);

    expect(resultado).toMatchObject({
      ok: false,
      error: { message: "Já existe guia anexada para esta competência." },
    });
    expect(storage.removidos).toEqual(storage.enviados);
  });

  it("remoção que também falha vira estado inconsistente", async () => {
    const { caso, anexar, storage } = montar();
    anexar.mockResolvedValue(err(new ValidationError("falha")));
    storage.falharAoRemover = true;
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await caso.execute(INPUT)).toMatchObject({
      ok: false,
      error: expect.any(EstadoInconsistenteError),
    });
  });

  describe("resposta perdida da gravação", () => {
    it("guia já gravada com o nosso arquivo: sucesso e arquivo preservado", async () => {
      const { caso, anexar, gravada, storage } = montar();
      anexar.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));
      gravada.mockResolvedValue(ok(true));

      expect((await caso.execute(INPUT)).ok).toBe(true);
      expect(gravada).toHaveBeenCalledWith(PARCELAMENTO_ID, "202610", storage.enviados[0]);
      expect(storage.removidos).toEqual([]);
    });

    it("sem prova da gravação: mantém o arquivo e pede conferência", async () => {
      const { caso, anexar, storage } = montar();
      anexar.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));

      expect(await caso.execute(INPUT)).toMatchObject({
        ok: false,
        error: expect.any(EstadoInconsistenteError),
      });
      expect(storage.removidos).toEqual([]);
    });
  });
});
