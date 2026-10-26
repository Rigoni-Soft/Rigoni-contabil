import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { GuiaParcelaPgfnRepository } from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { RemoverGuiaParcelaPgfn } from "./remover-guia-parcela-pgfn.use-case";

const PARCELAMENTO_ID = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";
const CAMINHO = "c1/guias-pgfn/d2/202610-abc.pdf";
const INPUT = { parcelamentoId: PARCELAMENTO_ID, competencia: "202610" };

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "f-1", papel: "funcionario", setor: "simples_nacional" };
  async usuarioAtual() {
    return this.ator;
  }
}

function montar() {
  const sessao = new SessaoFalsa();
  const arquivo = jest
    .fn<Promise<Result<string | null, AppError>>, unknown[]>()
    .mockResolvedValue(ok(CAMINHO));
  const remover = jest
    .fn<Promise<Result<void, AppError>>, unknown[]>()
    .mockResolvedValue(ok(undefined));
  const removidos: string[] = [];
  const storage = {
    remover: jest.fn(async (caminhos: string[]) => {
      removidos.push(...caminhos);
      return ok(undefined) as Result<void, AppError>;
    }),
  } as unknown as ArquivoStoragePort & { remover: jest.Mock };
  const guias = { arquivo, remover } as unknown as GuiaParcelaPgfnRepository;
  return {
    sessao,
    arquivo,
    remover,
    storage,
    removidos,
    caso: new RemoverGuiaParcelaPgfn(sessao, guias, storage),
  };
}

describe("RemoverGuiaParcelaPgfn", () => {
  it("remove o registro da guia e apaga o objeto do Storage", async () => {
    const { caso, remover, removidos } = montar();

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: true, value: undefined });
    expect(remover).toHaveBeenCalledWith(PARCELAMENTO_ID, "202610");
    expect(removidos).toEqual([CAMINHO]);
  });

  it("sem permissão não remove nada", async () => {
    const { caso, sessao, remover, removidos } = montar();
    sessao.ator = { id: "f-2", papel: "funcionario", setor: "financeiro" };

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(ForbiddenError) });
    expect(remover).not.toHaveBeenCalled();
    expect(removidos).toEqual([]);
  });

  it("guia que não existe (ou a RLS esconde) é não encontrada", async () => {
    const { caso, arquivo, remover } = montar();
    arquivo.mockResolvedValue(ok(null));

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(NotFoundError) });
    expect(remover).not.toHaveBeenCalled();
  });

  it("banco recusa (guia já enviada): mantém o objeto", async () => {
    const { caso, remover, removidos } = montar();
    remover.mockResolvedValue(err(new ValidationError("Competência já enviada.")));

    const resultado = await caso.execute(INPUT);

    expect(resultado).toEqual({ ok: false, error: expect.any(ValidationError) });
    expect(removidos).toEqual([]);
  });

  it("resposta perdida do banco: só apaga o objeto se a leitura mostra a guia removida", async () => {
    const { caso, arquivo, remover, removidos } = montar();
    remover.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));
    arquivo.mockResolvedValueOnce(ok(CAMINHO)).mockResolvedValueOnce(ok(null));

    const resultado = await caso.execute(INPUT);

    expect(resultado.ok).toBe(true);
    expect(removidos).toEqual([CAMINHO]);
  });

  it("resposta perdida e a guia ainda lá: erro e o objeto fica", async () => {
    const { caso, remover, removidos } = montar();
    remover.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));

    const resultado = await caso.execute(INPUT);

    expect(resultado.ok).toBe(false);
    expect(removidos).toEqual([]);
  });

  it("falha ao apagar o objeto não desfaz a remoção do registro", async () => {
    const { caso, storage } = montar();
    storage.remover.mockResolvedValue(err(new ValidationError("falha")));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    const resultado = await caso.execute(INPUT);

    expect(resultado.ok).toBe(true);
  });
});
