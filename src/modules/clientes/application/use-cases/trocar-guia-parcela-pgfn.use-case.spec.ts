import type { TrocarGuiaParcelaPgfnInput } from "@/modules/clientes/application/ports/in/trocar-guia-parcela-pgfn.provider";
import type { ArquivoInspecionavelPort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  GuiaParcelaPgfnRepository,
  ParcelamentoDaGuia,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { LeitorDeGuiaDeParcelaPort } from "@/modules/clientes/application/ports/out/leitor-de-guia-de-parcela.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { TrocarGuiaParcelaPgfn } from "./trocar-guia-parcela-pgfn.use-case";

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const PARCELAMENTO_ID = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";
const CAMINHO_ANTIGO = `${CLIENTE_ID}/guias-pgfn/${PARCELAMENTO_ID}/202610-antigo.pdf`;
const PARCELAMENTO: ParcelamentoDaGuia = {
  clienteId: CLIENTE_ID,
  origem: "pgfn",
  cnpj: "10690529000138",
  codigo: "150141670",
};
const LIDA_CONFERINDO = {
  lido: true,
  cnpj: "10.690.529/0001-38",
  contaNegociacao: "150141670",
  competencia: "202610",
  vencimento: "2026-11-30",
  valorCentavos: 26289,
} as const;

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "f-1", papel: "funcionario", setor: "simples_nacional" };
  async usuarioAtual() {
    return this.ator;
  }
}

class StorageFalso implements ArquivoInspecionavelPort {
  enviados: string[] = [];
  removidos: string[] = [];
  async enviar(caminho: string): Promise<Result<{ caminho: string }, AppError>> {
    this.enviados.push(caminho);
    return ok({ caminho });
  }
  async inspecionar() {
    return ok({ tipoMime: "application/pdf", tamanho: 1000 });
  }
  async remover(caminhos: string[]): Promise<Result<void, AppError>> {
    this.removidos.push(...caminhos);
    return ok(undefined);
  }
}

const INPUT: TrocarGuiaParcelaPgfnInput = {
  parcelamentoId: PARCELAMENTO_ID,
  competencia: "202610",
  arquivo: new File(["pdf"], "guia.pdf", { type: "application/pdf" }),
  pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
};

function montar(leitura: Awaited<ReturnType<LeitorDeGuiaDeParcelaPort["ler"]>> = LIDA_CONFERINDO) {
  const sessao = new SessaoFalsa();
  const substituir = jest
    .fn<Promise<Result<void, AppError>>, unknown[]>()
    .mockResolvedValue(ok(undefined));
  const confirmar = jest
    .fn<Promise<Result<void, AppError>>, unknown[]>()
    .mockResolvedValue(ok(undefined));
  const gravada = jest
    .fn<Promise<Result<boolean, AppError>>, unknown[]>()
    .mockResolvedValue(ok(false));
  const guias = {
    parcelamento: async () => ok(PARCELAMENTO),
    arquivo: async () => ok<string | null>(CAMINHO_ANTIGO),
    substituir,
    confirmar,
    gravada,
  } as unknown as GuiaParcelaPgfnRepository;
  const storage = new StorageFalso();
  return {
    sessao,
    substituir,
    confirmar,
    gravada,
    storage,
    caso: new TrocarGuiaParcelaPgfn(sessao, guias, storage, { ler: async () => leitura }),
  };
}

describe("TrocarGuiaParcelaPgfn", () => {
  it("sobe o PDF novo, troca na guia, volta a confirmar e apaga o objeto antigo", async () => {
    const { caso, substituir, confirmar, storage } = montar();

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({
      ok: true,
      value: { competencia: "202610", contaNegociacao: "150141670", estado: "confirmada" },
    });
    expect(storage.enviados).toHaveLength(1);
    expect(storage.enviados[0]).toMatch(
      new RegExp(`^${CLIENTE_ID}/guias-pgfn/${PARCELAMENTO_ID}/202610-[0-9a-f-]{36}\.pdf$`),
    );
    expect(substituir).toHaveBeenCalledWith(
      PARCELAMENTO_ID,
      "202610",
      { contaNegociacao: "150141670", arquivoCaminho: storage.enviados[0] },
      null,
    );
    expect(confirmar).toHaveBeenCalledWith(PARCELAMENTO_ID, "202610");
    expect(storage.removidos).toEqual([CAMINHO_ANTIGO]);
  });

  it("sem permissão não lê, não sobe nem troca nada", async () => {
    const { caso, sessao, substituir, storage } = montar();
    sessao.ator = { id: "f-2", papel: "funcionario", setor: "financeiro" };

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(ForbiddenError) });
    expect(storage.enviados).toEqual([]);
    expect(substituir).not.toHaveBeenCalled();
  });

  it("recusa o PDF de outra competência, sem tocar no Storage", async () => {
    const { caso, substituir, storage } = montar({ ...LIDA_CONFERINDO, competencia: "202611" });

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(ValidationError) });
    expect(resultado.ok === false && resultado.error.message).toMatch(/outra competência/i);
    expect(storage.enviados).toEqual([]);
    expect(substituir).not.toHaveBeenCalled();
  });

  it("recusa o PDF com CNPJ de outra empresa, sem tocar no Storage", async () => {
    const { caso, substituir, storage } = montar({
      ...LIDA_CONFERINDO,
      cnpj: "11.222.333/0001-81",
    });

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(ValidationError) });
    expect(storage.enviados).toEqual([]);
    expect(substituir).not.toHaveBeenCalled();
  });

  it("PDF que não conferiu volta a guia a confirmar, com o motivo, e não confirma", async () => {
    const { caso, confirmar } = montar({ lido: false });

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({
      ok: true,
      value: {
        competencia: "202610",
        contaNegociacao: "150141670",
        estado: "a_confirmar",
        motivo: "Não consegui ler o PDF: confira a guia à mão.",
      },
    });
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("banco recusa a troca (guia já enviada): apaga o PDF novo e mantém o antigo", async () => {
    const { caso, substituir, storage } = montar();
    substituir.mockResolvedValue(err(new ValidationError("Competência já enviada.")));

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(ValidationError) });
    expect(storage.removidos).toEqual([storage.enviados[0]]);
    expect(storage.removidos).not.toContain(CAMINHO_ANTIGO);
  });

  it("resposta perdida do banco, mas a troca gravou: segue e apaga só o antigo", async () => {
    const { caso, substituir, gravada, storage } = montar();
    substituir.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));
    gravada.mockResolvedValue(ok(true));

    const resultado = await caso.execute(INPUT);

    expect(resultado.ok).toBe(true);
    expect(gravada).toHaveBeenCalledWith(PARCELAMENTO_ID, "202610", storage.enviados[0]);
    expect(storage.removidos).toEqual([CAMINHO_ANTIGO]);
  });

  it("resposta perdida sem prova da gravação: não apaga nenhum dos dois arquivos", async () => {
    const { caso, substituir, storage } = montar();
    substituir.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(EstadoInconsistenteError) });
    expect(storage.removidos).toEqual([]);
  });
});
