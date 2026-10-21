import type { AnexarAlteracaoContratualInput } from "@/modules/clientes/application/ports/in/anexar-alteracao-contratual.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AlteracaoContratual } from "@/modules/clientes/domain/value-objects/alteracao-contratual.vo";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { AnexarAlteracaoContratual } from "./anexar-alteracao-contratual.use-case";

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "admin-1", papel: "admin", setor: "administrativo" };
  async usuarioAtual(): Promise<AtorSessaoDto | null> {
    return this.ator;
  }
}

class ClienteRepositoryFalso implements ClienteRepository {
  anexada: { clienteId: string; alteracao: AlteracaoContratual } | null = null;
  erroAoAnexar: AppError | null = null;
  async anexarAlteracaoContratual(
    clienteId: string,
    alteracao: AlteracaoContratual,
  ): Promise<Result<void, AppError>> {
    if (this.erroAoAnexar) return err(this.erroAoAnexar);
    this.anexada = { clienteId, alteracao };
    return ok(undefined);
  }
  async criar(): Promise<Result<void, AppError>> {
    throw new Error("não usado neste caso de uso");
  }
  async buscarPorId(): Promise<Result<Cliente | null, AppError>> {
    throw new Error("não usado neste caso de uso");
  }
  async atualizarOperacional(): Promise<Result<void, AppError>> {
    throw new Error("não usado neste caso de uso");
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
  const clientes = new ClienteRepositoryFalso();
  const storage = new ArquivoStorageFalso();
  return {
    sessao,
    clientes,
    storage,
    caso: new AnexarAlteracaoContratual(sessao, clientes, storage),
  };
}

describe("AnexarAlteracaoContratual", () => {
  it("Admin anexa: sobe o arquivo e grava a alteração com o caminho enviado", async () => {
    const { caso, clientes, storage } = montar();

    const resultado = await caso.execute(INPUT);

    expect(resultado.ok).toBe(true);
    expect(storage.enviados).toEqual([`${CLIENTE_ID}/alteracoes-contratuais/2-alteracao.pdf`]);
    expect(clientes.anexada?.clienteId).toBe(CLIENTE_ID);
    expect(clientes.anexada?.alteracao.numero).toBe(2);
    expect(clientes.anexada?.alteracao.arquivoCaminho).toBe(storage.enviados[0]);
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
    const { caso, clientes, storage } = montar();
    clientes.erroAoAnexar = new ValidationError("Já existe a alteração nº 2 deste Cliente.");

    const resultado = await caso.execute(INPUT);

    expect(resultado).toMatchObject({
      ok: false,
      error: { message: "Já existe a alteração nº 2 deste Cliente." },
    });
    expect(storage.removidos).toEqual(storage.enviados);
  });

  it("remoção que também falha vira estado inconsistente, não o erro original", async () => {
    const { caso, clientes, storage } = montar();
    clientes.erroAoAnexar = new ValidationError("falha ao gravar");
    storage.falharAoRemover = true;
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    const resultado = await caso.execute(INPUT);

    expect(resultado).toMatchObject({ ok: false, error: expect.any(EstadoInconsistenteError) });
  });
});
