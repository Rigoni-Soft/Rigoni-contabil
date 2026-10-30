import type {
  AlteracaoContratualInput,
  CriarClienteInput,
} from "@/modules/clientes/application/ports/in/criar-cliente.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/clientes/application/ports/out/auditoria.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { CriarCliente } from "./criar-cliente.use-case";

const erros: RegistroDeErrosPort = { registrar: jest.fn() };

const CNPJ_VALIDO = "11444777000161";

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "admin-1", papel: "admin", setor: "administrativo" };
  async usuarioAtual(): Promise<AtorSessaoDto | null> {
    return this.ator;
  }
}

class ClienteRepositoryFalso implements ClienteRepository {
  criado: Cliente | null = null;
  erroAoCriar = false;
  // Transação confirmada, resposta perdida: grava e devolve ResultadoIncertoError.
  respostaPerdida = false;
  reconciliacao: Result<Cliente | null, AppError> = ok(null);
  async criar(cliente: Cliente): Promise<Result<void, AppError>> {
    if (this.erroAoCriar) return err(new ValidationError("falha ao salvar"));
    if (this.respostaPerdida) return err(new ResultadoIncertoError("sem resposta"));
    this.criado = cliente;
    return ok(undefined);
  }
  async buscarPorId(): Promise<Result<Cliente | null, AppError>> {
    return this.reconciliacao;
  }
  async anexarAlteracaoContratual(): Promise<Result<void, AppError>> {
    throw new Error("não usado neste caso de uso");
  }
  async alteracaoContratualGravada(): Promise<Result<boolean, AppError>> {
    throw new Error("não usado neste caso de uso");
  }
  async atualizarOperacional(): Promise<Result<void, AppError>> {
    throw new Error("não usado neste caso de uso");
  }
}

class ArquivoStorageFalso implements ArquivoStoragePort {
  enviados: string[] = [];
  removidos: string[] = [];
  falharEm: string | null = null;
  falharAoRemover = false;
  async remover(caminhos: string[]): Promise<Result<void, AppError>> {
    if (this.falharAoRemover) return err(new ValidationError("falha ao remover"));
    this.removidos.push(...caminhos);
    return ok(undefined);
  }
  async enviar(caminho: string): Promise<Result<{ caminho: string }, AppError>> {
    if (this.falharEm && caminho.includes(this.falharEm)) {
      return err(new ValidationError("falha ao enviar arquivo"));
    }
    this.enviados.push(caminho);
    return ok({ caminho });
  }
}

class AuditoriaFalsa implements AuditoriaPort {
  registros: RegistrarAcaoAuditoria[] = [];
  async registrar(input: RegistrarAcaoAuditoria): Promise<void> {
    this.registros.push(input);
  }
}

function arquivo(nome: string): File {
  return new File(["conteúdo"], nome, { type: "application/pdf" });
}

const ALTERACAO_VALIDA: AlteracaoContratualInput = {
  numero: 1,
  data: "2026-02-01",
  arquivo: arquivo("alteracao-1.pdf"),
};

const INPUT_VALIDO: CriarClienteInput = {
  empresa: "Padaria Pão Quente Ltda",
  cnpj: CNPJ_VALIDO,
  regime: "simples_nacional",
  contratoSocial: arquivo("contrato-social.pdf"),
  alteracoesContratuais: [ALTERACAO_VALIDA],
};

describe("CriarCliente", () => {
  it("Admin cadastra o Cliente: envia os arquivos e salva (a auditoria de sucesso é do banco)", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria, erros).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.cliente.empresa).toBe("Padaria Pão Quente Ltda");
      expect(resultado.value.cliente.cnpj).toBe(CNPJ_VALIDO);
      expect(resultado.value.cliente.alteracoesContratuais).toHaveLength(1);
    }
    expect(clientes.criado?.cnpj.valor).toBe(CNPJ_VALIDO);
    expect(storage.enviados).toEqual(
      expect.arrayContaining([
        expect.stringContaining("contrato-social"),
        expect.stringContaining("alteracoes-contratuais"),
      ]),
    );
    // A auditoria de sucesso é do banco (trigger), não do caso de uso.
    expect(auditoria.registros).toEqual([]);
    expect(storage.removidos).toEqual([]);
  });

  it("grava o e-mail informado e devolve no DTO", async () => {
    const clientes = new ClienteRepositoryFalso();

    const resultado = await new CriarCliente(
      new SessaoFalsa(),
      clientes,
      new ArquivoStorageFalso(),
      new AuditoriaFalsa(),
      erros,
    ).execute({ ...INPUT_VALIDO, email: "financeiro@padaria.com.br" });

    expect(resultado.ok && resultado.value.cliente.email).toBe("financeiro@padaria.com.br");
    expect(clientes.criado?.email?.valor).toBe("financeiro@padaria.com.br");
  });

  it("e-mail inválido: rejeita antes de salvar", async () => {
    const clientes = new ClienteRepositoryFalso();

    const resultado = await new CriarCliente(
      new SessaoFalsa(),
      clientes,
      new ArquivoStorageFalso(),
      new AuditoriaFalsa(),
      erros,
    ).execute({ ...INPUT_VALIDO, email: "sem-arroba" });

    expect(resultado.ok).toBe(false);
    expect(clientes.criado).toBeNull();
  });

  it("cadastra sem contrato social (campo opcional, decisão de produto 2026-09-29)", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria, erros).execute({
      ...INPUT_VALIDO,
      contratoSocial: undefined,
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value.cliente.contratoSocialCaminho).toBeNull();
    expect(clientes.criado?.contratoSocialCaminho).toBeNull();
    expect(storage.enviados).not.toEqual(
      expect.arrayContaining([expect.stringContaining("contrato-social")]),
    );
  });

  it("Cadastra sem nenhuma alteração contratual", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria, erros).execute({
      ...INPUT_VALIDO,
      alteracoesContratuais: [],
    });

    expect(resultado.ok).toBe(true);
    expect(clientes.criado?.alteracoesContratuais).toEqual([]);
  });

  it("nega quando quem chama não é Admin", async () => {
    const sessao = new SessaoFalsa();
    sessao.ator = { id: "func-1", papel: "funcionario", setor: "simples_nacional" };
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria, erros).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
    expect(clientes.criado).toBeNull();
    expect(auditoria.registros).toEqual([]);
  });

  it("nega sem sessão", async () => {
    const sessao = new SessaoFalsa();
    sessao.ator = null;

    const resultado = await new CriarCliente(
      sessao,
      new ClienteRepositoryFalso(),
      new ArquivoStorageFalso(),
      new AuditoriaFalsa(),
      erros,
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
  });

  async function falhando(opcoes: {
    storage?: (s: ArquivoStorageFalso) => void;
    clientes?: (c: ClienteRepositoryFalso) => void;
    input?: Partial<CriarClienteInput>;
  }) {
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();
    opcoes.storage?.(storage);
    opcoes.clientes?.(clientes);
    const resultado = await new CriarCliente(
      new SessaoFalsa(),
      clientes,
      storage,
      auditoria,
      erros,
    ).execute({ ...INPUT_VALIDO, ...opcoes.input });
    return { resultado, clientes, storage, auditoria };
  }

  it("falha no contrato social: nada foi enviado, nada a remover, falha auditada", async () => {
    const { resultado, clientes, storage, auditoria } = await falhando({
      storage: (s) => (s.falharEm = "contrato-social"),
    });

    expect(resultado.ok).toBe(false);
    expect(clientes.criado).toBeNull();
    expect(storage.enviados).toEqual([]);
    expect(storage.removidos).toEqual([]);
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("falha na segunda alteração: contrato e primeira alteração são removidos", async () => {
    const { resultado, storage, auditoria } = await falhando({
      storage: (s) => (s.falharEm = "2-alteracao-2"),
      input: {
        alteracoesContratuais: [
          ALTERACAO_VALIDA,
          { numero: 2, data: "2026-03-01", arquivo: arquivo("alteracao-2.pdf") },
        ],
      },
    });

    expect(resultado.ok).toBe(false);
    expect(storage.enviados).toHaveLength(2);
    expect(storage.removidos.sort()).toEqual([...storage.enviados].sort());
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("grava o arquivo da alteração com o nº no caminho", async () => {
    const { resultado, storage } = await falhando({ input: { empresa: "" } });

    expect(resultado.ok).toBe(false);
    expect(storage.enviados).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/alteracoes-contratuais/1-alteracao-1.pdf"),
      ]),
    );
  });

  it.each([
    ["repetido", [ALTERACAO_VALIDA, { ...ALTERACAO_VALIDA, arquivo: arquivo("outra.pdf") }]],
    ["zero", [{ ...ALTERACAO_VALIDA, numero: 0 }]],
  ])("nº %s: rejeita e remove o que já foi enviado", async (_nome, alteracoes) => {
    const { resultado, storage } = await falhando({ input: { alteracoesContratuais: alteracoes } });

    expect(resultado.ok).toBe(false);
    expect(storage.removidos.sort()).toEqual([...storage.enviados].sort());
  });

  it("CNPJ inválido: rejeita antes de qualquer upload", async () => {
    const { resultado, storage, auditoria } = await falhando({ input: { cnpj: "123" } });

    expect(resultado.ok).toBe(false);
    expect(storage.enviados).toEqual([]);
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("builder falha depois dos uploads (Empresa vazia): todos os objetos são removidos", async () => {
    const { resultado, clientes, storage } = await falhando({ input: { empresa: "" } });

    expect(resultado.ok).toBe(false);
    expect(clientes.criado).toBeNull();
    expect(storage.enviados).toHaveLength(2);
    expect(storage.removidos.sort()).toEqual([...storage.enviados].sort());
  });

  it("banco rejeita o Cliente (ex.: CNPJ duplicado): todos os objetos são removidos", async () => {
    const { resultado, storage, auditoria } = await falhando({
      clientes: (c) => (c.erroAoCriar = true),
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ValidationError);
    expect(storage.removidos.sort()).toEqual([...storage.enviados].sort());
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("falha da própria compensação vira EstadoInconsistenteError, observável e auditada", async () => {
    const erroLog = jest.mocked(erros.registrar).mockClear();
    const { resultado, auditoria } = await falhando({
      clientes: (c) => (c.erroAoCriar = true),
      storage: (s) => (s.falharAoRemover = true),
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(EstadoInconsistenteError);
    expect(auditoria.registros).toEqual([
      expect.objectContaining({ resultado: "falha_compensacao" }),
    ]);
    expect(erroLog).toHaveBeenCalledWith(expect.stringContaining("caminhos="), expect.any(String));
  });

  describe("resposta perdida da gravação (resultado incerto)", () => {
    function executar(clientes: ClienteRepositoryFalso, storage = new ArquivoStorageFalso()) {
      const caso = new CriarCliente(
        new SessaoFalsa(),
        clientes,
        storage,
        new AuditoriaFalsa(),
        erros,
      );
      return { storage, resultado: caso.execute(INPUT_VALIDO) };
    }

    it("Cliente já gravado: sucesso e nenhum arquivo removido", async () => {
      const clientes = new ClienteRepositoryFalso();
      clientes.respostaPerdida = true;
      clientes.reconciliacao = ok({} as Cliente);

      const { storage, resultado } = executar(clientes);

      expect((await resultado).ok).toBe(true);
      expect(storage.removidos).toEqual([]);
    });

    it("leitura vazia (commit pode vir depois): mantém os arquivos e sinaliza estado inconsistente", async () => {
      const clientes = new ClienteRepositoryFalso();
      clientes.respostaPerdida = true;
      clientes.reconciliacao = ok(null);

      const { storage, resultado } = executar(clientes);

      const final = await resultado;
      expect(!final.ok && final.error).toBeInstanceOf(EstadoInconsistenteError);
      expect(storage.removidos).toEqual([]);
    });

    it("reconciliação falha: mantém os arquivos e sinaliza estado inconsistente", async () => {
      const clientes = new ClienteRepositoryFalso();
      clientes.respostaPerdida = true;
      clientes.reconciliacao = err(new ValidationError("leitura falhou"));

      const { storage, resultado } = executar(clientes);

      const final = await resultado;
      expect(!final.ok && final.error).toBeInstanceOf(EstadoInconsistenteError);
      expect(storage.removidos).toEqual([]);
    });
  });
});
