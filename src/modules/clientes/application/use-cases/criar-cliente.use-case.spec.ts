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
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { CriarCliente } from "./criar-cliente.use-case";

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
  async criar(cliente: Cliente): Promise<Result<void, AppError>> {
    if (this.erroAoCriar) return err(new ValidationError("falha ao salvar"));
    this.criado = cliente;
    return ok(undefined);
  }
}

class ArquivoStorageFalso implements ArquivoStoragePort {
  enviados: string[] = [];
  falharEm: string | null = null;
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
  it("Admin cadastra o Cliente: envia os arquivos, salva e registra sucesso na auditoria", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.cliente.empresa).toBe("Padaria Pão Quente Ltda");
      expect(resultado.value.cliente.cnpj).toBe(CNPJ_VALIDO);
      expect(resultado.value.cliente.alteracoesContratuais).toHaveLength(1);
    }
    expect(clientes.criado?.cnpj.digitos).toBe(CNPJ_VALIDO);
    expect(storage.enviados).toEqual(
      expect.arrayContaining([
        expect.stringContaining("contrato-social"),
        expect.stringContaining("alteracoes-contratuais"),
      ]),
    );
    expect(auditoria.registros).toEqual([
      expect.objectContaining({
        ator: "admin-1",
        setor: "administrativo",
        acao: "cliente.criar",
        alvo: CNPJ_VALIDO,
        resultado: "sucesso",
      }),
    ]);
  });

  it("Cadastra sem nenhuma alteração contratual", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria).execute({
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

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria).execute(
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
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
  });

  it("devolve erro e registra falha na auditoria quando o envio do contrato social falha", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    storage.falharEm = "contrato-social";
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(false);
    expect(clientes.criado).toBeNull();
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("devolve erro e registra falha na auditoria quando o envio de uma alteração contratual falha", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    storage.falharEm = "alteracoes-contratuais";
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(false);
    expect(clientes.criado).toBeNull();
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("devolve erro e registra falha na auditoria quando o CNPJ é inválido", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria).execute({
      ...INPUT_VALIDO,
      cnpj: "123",
    });

    expect(resultado.ok).toBe(false);
    expect(clientes.criado).toBeNull();
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("devolve erro e registra falha na auditoria quando salvar o Cliente falha", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    clientes.erroAoCriar = true;
    const storage = new ArquivoStorageFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new CriarCliente(sessao, clientes, storage, auditoria).execute(
      INPUT_VALIDO,
    );

    expect(resultado.ok).toBe(false);
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });
});
