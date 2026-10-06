import type { EditarCadastroOperacionalClienteInput } from "@/modules/clientes/application/ports/in/editar-cadastro-operacional-cliente.provider";
import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/clientes/application/ports/out/auditoria.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { EditarCadastroOperacionalCliente } from "./editar-cadastro-operacional-cliente.use-case";

const CNPJ_VALIDO = "11444777000161";
const CLIENTE_ID = "11111111-1111-1111-1111-111111111111";

function clienteBase(regime = "simples_nacional"): Cliente {
  const resultado = Cliente.builder()
    .comId(CLIENTE_ID)
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj(CNPJ_VALIDO)
    .comRegime(regime)
    .comContratoSocialCaminho(null)
    .comAlteracoesContratuais([])
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "func-sn-1", papel: "funcionario", setor: "simples_nacional" };
  async usuarioAtual(): Promise<AtorSessaoDto | null> {
    return this.ator;
  }
}

class ClienteRepositoryFalso implements ClienteRepository {
  cliente: Cliente | null = clienteBase();
  atualizado: Cliente | null = null;
  erroAoAtualizar = false;
  async criar(): Promise<Result<void, AppError>> {
    throw new Error("não usado neste caso de uso");
  }
  async buscarPorId(): Promise<Result<Cliente | null, AppError>> {
    return ok(this.cliente);
  }
  async atualizarOperacional(cliente: Cliente): Promise<Result<void, AppError>> {
    if (this.erroAoAtualizar) return err(new ValidationError("falha ao atualizar"));
    this.atualizado = cliente;
    return ok(undefined);
  }
}

class AuditoriaFalsa implements AuditoriaPort {
  registros: RegistrarAcaoAuditoria[] = [];
  async registrar(input: RegistrarAcaoAuditoria): Promise<void> {
    this.registros.push(input);
  }
}

const INPUT_VALIDO: EditarCadastroOperacionalClienteInput = {
  clienteId: CLIENTE_ID,
  formaEnvio: "email",
  contatos: [{ nome: "Maria", telefone: "11999990000", padrao: true }],
  documentoObrigatorio: "positivo",
  dasStatus: "pronto",
  dataEnvioDas: null,
  temParcelamento: false,
  parcelamentoStatus: null,
  observacoesGerais: "Cliente pontual.",
  atividadeMes: { industria: false, comercio: true, servico: false },
};

describe("EditarCadastroOperacionalCliente", () => {
  it("Funcionário do setor Simples Nacional edita e salva; o sucesso é auditado pelo banco (não pelo caso de uso)", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new EditarCadastroOperacionalCliente(
      sessao,
      clientes,
      auditoria,
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
    expect(clientes.atualizado?.formaEnvio.valor).toBe("email");
    expect(clientes.atualizado?.contatos).toHaveLength(1);
    expect(auditoria.registros).toEqual([]);
  });

  it("Admin também edita", async () => {
    const sessao = new SessaoFalsa();
    sessao.ator = { id: "admin-1", papel: "admin", setor: "administrativo" };
    const clientes = new ClienteRepositoryFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new EditarCadastroOperacionalCliente(
      sessao,
      clientes,
      auditoria,
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(true);
  });

  it("nega Funcionário de outro Setor", async () => {
    const sessao = new SessaoFalsa();
    sessao.ator = { id: "func-fin-1", papel: "funcionario", setor: "financeiro" };
    const clientes = new ClienteRepositoryFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new EditarCadastroOperacionalCliente(
      sessao,
      clientes,
      auditoria,
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toBeInstanceOf(ForbiddenError);
    expect(clientes.atualizado).toBeNull();
    expect(auditoria.registros).toEqual([]);
  });

  it("nega sem sessão", async () => {
    const sessao = new SessaoFalsa();
    sessao.ator = null;
    const clientes = new ClienteRepositoryFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new EditarCadastroOperacionalCliente(
      sessao,
      clientes,
      auditoria,
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
  });

  it("devolve erro quando o Cliente não existe", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    clientes.cliente = null;
    const auditoria = new AuditoriaFalsa();

    const resultado = await new EditarCadastroOperacionalCliente(
      sessao,
      clientes,
      auditoria,
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
  });

  it("devolve erro e registra falha na auditoria quando salvar falha", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    clientes.erroAoAtualizar = true;
    const auditoria = new AuditoriaFalsa();

    const resultado = await new EditarCadastroOperacionalCliente(
      sessao,
      clientes,
      auditoria,
    ).execute(INPUT_VALIDO);

    expect(resultado.ok).toBe(false);
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it("devolve erro de validação quando os dados de entrada são inválidos (ex.: 2 contatos padrão)", async () => {
    const sessao = new SessaoFalsa();
    const clientes = new ClienteRepositoryFalso();
    const auditoria = new AuditoriaFalsa();

    const resultado = await new EditarCadastroOperacionalCliente(
      sessao,
      clientes,
      auditoria,
    ).execute({
      ...INPUT_VALIDO,
      contatos: [
        { nome: "Maria", telefone: "11999990000", padrao: true },
        { nome: "João", telefone: "11988880000", padrao: true },
      ],
    });

    expect(resultado.ok).toBe(false);
    expect(clientes.atualizado).toBeNull();
    expect(auditoria.registros).toEqual([expect.objectContaining({ resultado: "falha" })]);
  });

  it.each(["lucro_presumido", "lucro_real"])(
    "Cliente de Regime %s não tem Cadastro operacional SN: rejeita sem gravar e audita a falha",
    async (regime) => {
      const repositorio = new ClienteRepositoryFalso();
      repositorio.cliente = clienteBase(regime);
      const auditoria = new AuditoriaFalsa();
      const caso = new EditarCadastroOperacionalCliente(new SessaoFalsa(), repositorio, auditoria);

      const r = await caso.execute(INPUT_VALIDO);

      expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
      expect(repositorio.atualizado).toBeNull();
      expect(auditoria.registros).toEqual([
        expect.objectContaining({ acao: "cliente.editar-operacional", resultado: "falha" }),
      ]);
    },
  );

  it.each(["simples_nacional", "mei"])("Cliente de Regime %s é editado", async (regime) => {
    const repositorio = new ClienteRepositoryFalso();
    repositorio.cliente = clienteBase(regime);
    const caso = new EditarCadastroOperacionalCliente(
      new SessaoFalsa(),
      repositorio,
      new AuditoriaFalsa(),
    );

    expect((await caso.execute(INPUT_VALIDO)).ok).toBe(true);
    expect(repositorio.atualizado).not.toBeNull();
  });
});
