import type { AnexarAlteracaoContratualInput } from "@/modules/clientes/application/ports/in/anexar-alteracao-contratual.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { AnexarAlteracaoContratual } from "./anexar-alteracao-contratual.use-case";

const erros: RegistroDeErrosPort = { registrar: jest.fn() };

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "admin-1", papel: "admin", setor: "administrativo" };
  async usuarioAtual(): Promise<AtorSessaoDto | null> {
    return this.ator;
  }
}

class ArquivoStorageFalso implements ArquivoStoragePort {
  enviados: string[] = [];
  removidos: string[] = [];
  falharAoRemover = false;
  async enviar(caminho: string): Promise<Result<{ caminho: string }, AppError>> {
    this.enviados.push(caminho);
    return ok({ caminho });
  }
  async remover(caminhos: string[]): Promise<Result<void, AppError>> {
    if (this.falharAoRemover) return err(new ValidationError("falha ao remover"));
    this.removidos.push(...caminhos);
    return ok(undefined);
  }
}

const INPUT: AnexarAlteracaoContratualInput = {
  clienteId: CLIENTE_ID,
  numero: 2,
  data: "2026-02-01",
  arquivo: new File(["conteúdo"], "alteracao.pdf", { type: "application/pdf" }),
};

function montar() {
  const sessao = new SessaoFalsa();
  const anexar = jest
    .fn<Promise<Result<void, AppError>>, [string, AlteracaoContratual]>()
    .mockResolvedValue(ok(undefined));
  const gravada = jest
    .fn<Promise<Result<boolean, AppError>>, [string, number, string]>()
    .mockResolvedValue(ok(false));
  const clientes = {
    anexarAlteracaoContratual: anexar,
    alteracaoContratualGravada: gravada,
  } as unknown as ClienteRepository;
  const storage = new ArquivoStorageFalso();
  return {
    sessao,
    anexar,
    gravada,
    storage,
    caso: new AnexarAlteracaoContratual(sessao, clientes, storage, erros),
  };
}

describe("AnexarAlteracaoContratual", () => {
  it("Admin anexa: sobe o arquivo e grava a alteração com o caminho enviado", async () => {
    const { caso, anexar, storage } = montar();

    const resultado = await caso.execute(INPUT);

    expect(resultado.ok).toBe(true);
    expect(storage.enviados).toEqual([`${CLIENTE_ID}/alteracoes-contratuais/2-alteracao.pdf`]);
    const [clienteId, alteracao] = anexar.mock.calls[0];
    expect(clienteId).toBe(CLIENTE_ID);
    expect(alteracao.numero).toBe(2);
    expect(alteracao.arquivoCaminho).toBe(storage.enviados[0]);
    expect(storage.removidos).toEqual([]);
  });

  it.each(["lider_setor", "funcionario"])(
    "%s é recusado antes de qualquer upload",
    async (papel) => {
      const { caso, sessao, storage } = montar();
      sessao.ator = { id: "u-1", papel, setor: "simples_nacional" };

      const resultado = await caso.execute(INPUT);

      expect(resultado).toMatchObject({ ok: false, error: expect.any(ForbiddenError) });
      expect(storage.enviados).toEqual([]);
    },
  );

  it("falha da gravação remove o arquivo recém-subido e devolve o erro original", async () => {
    const { caso, anexar, storage } = montar();
    anexar.mockResolvedValue(err(new ValidationError("Já existe a alteração nº 2 deste Cliente.")));

    const resultado = await caso.execute(INPUT);

    expect(resultado).toMatchObject({
      ok: false,
      error: { message: "Já existe a alteração nº 2 deste Cliente." },
    });
    expect(storage.removidos).toEqual(storage.enviados);
  });

  it("remoção que também falha vira estado inconsistente, não o erro original", async () => {
    const { caso, anexar, storage } = montar();
    anexar.mockResolvedValue(err(new ValidationError("falha ao gravar")));
    storage.falharAoRemover = true;

    const resultado = await caso.execute(INPUT);

    expect(resultado).toMatchObject({ ok: false, error: expect.any(EstadoInconsistenteError) });
  });

  describe("resposta perdida da gravação (resultado incerto)", () => {
    it("alteração já gravada: sucesso e arquivo preservado", async () => {
      const { caso, anexar, gravada, storage } = montar();
      anexar.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));
      gravada.mockResolvedValue(ok(true));

      const resultado = await caso.execute(INPUT);

      expect(resultado.ok).toBe(true);
      expect(gravada).toHaveBeenCalledWith(
        CLIENTE_ID,
        2,
        `${CLIENTE_ID}/alteracoes-contratuais/2-alteracao.pdf`,
      );
      expect(storage.removidos).toEqual([]);
    });

    it("leitura vazia (commit pode vir depois): mantém o arquivo e sinaliza estado inconsistente", async () => {
      const { caso, anexar, storage } = montar();
      anexar.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));

      const resultado = await caso.execute(INPUT);

      expect(!resultado.ok && resultado.error).toBeInstanceOf(EstadoInconsistenteError);
      expect(storage.removidos).toEqual([]);
    });

    it("reconciliação falha: mantém o arquivo e sinaliza estado inconsistente", async () => {
      const { caso, anexar, gravada, storage } = montar();
      anexar.mockResolvedValue(err(new ResultadoIncertoError("sem resposta")));
      gravada.mockResolvedValue(err(new ValidationError("leitura falhou")));

      const resultado = await caso.execute(INPUT);

      expect(!resultado.ok && resultado.error).toBeInstanceOf(EstadoInconsistenteError);
      expect(storage.removidos).toEqual([]);
    });
  });
});
