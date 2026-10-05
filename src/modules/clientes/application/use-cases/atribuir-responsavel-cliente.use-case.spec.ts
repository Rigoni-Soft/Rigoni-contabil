import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/clientes/application/ports/out/auditoria.provider";
import type {
  ClienteQueryPort,
  ResponsavelOpcaoDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type { ResponsavelClienteRepository } from "@/modules/clientes/application/ports/out/responsavel-cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { AtribuirResponsavelCliente } from "./atribuir-responsavel-cliente.use-case";

const CLIENTE_ID = "11111111-1111-1111-1111-111111111111";
const FUNC_ID = "22222222-2222-2222-2222-222222222222";

function clienteBase(): Cliente {
  const resultado = Cliente.builder()
    .comId(CLIENTE_ID)
    .comEmpresa("Padaria Pão Quente Ltda")
    .comCnpj("11444777000161")
    .comRegime("simples_nacional")
    .comContratoSocialCaminho(null)
    .comAlteracoesContratuais([])
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "lider-1", papel: "lider_setor", setor: "simples_nacional" };
  async usuarioAtual() {
    return this.ator;
  }
}

class ClientesFalso implements ClienteRepository {
  cliente: Cliente | null = clienteBase();
  async criar(): Promise<Result<void, AppError>> {
    throw new Error("não usado");
  }
  async buscarPorId(): Promise<Result<Cliente | null, AppError>> {
    return ok(this.cliente);
  }
  async atualizarOperacional(): Promise<Result<void, AppError>> {
    throw new Error("não usado");
  }
}

class QueryFalsa implements Partial<ClienteQueryPort> {
  async listarResponsaveisElegiveis(): Promise<Result<ResponsavelOpcaoDto[], AppError>> {
    return ok([{ id: FUNC_ID, nome: "Funcionário SN" }]);
  }
}

class ResponsaveisFalso implements ResponsavelClienteRepository {
  chamadas: [string, string | null][] = [];
  falha = false;
  async atribuir(clienteId: string, responsavelId: string | null): Promise<Result<void, AppError>> {
    if (this.falha) return err(new ValidationError("falha"));
    this.chamadas.push([clienteId, responsavelId]);
    return ok(undefined);
  }
}

class AuditoriaFalsa implements AuditoriaPort {
  registros: RegistrarAcaoAuditoria[] = [];
  async registrar(input: RegistrarAcaoAuditoria) {
    this.registros.push(input);
  }
}

function montar() {
  const sessao = new SessaoFalsa();
  const clientes = new ClientesFalso();
  const responsaveis = new ResponsaveisFalso();
  const auditoria = new AuditoriaFalsa();
  const useCase = new AtribuirResponsavelCliente(
    sessao,
    clientes,
    new QueryFalsa() as ClienteQueryPort,
    responsaveis,
    auditoria,
  );
  return { sessao, clientes, responsaveis, auditoria, useCase };
}

describe("AtribuirResponsavelCliente", () => {
  it("Líder do SN atribui Funcionário do SN e audita sucesso", async () => {
    const { useCase, responsaveis, auditoria } = montar();

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });

    expect(r.ok).toBe(true);
    expect(responsaveis.chamadas).toEqual([[CLIENTE_ID, FUNC_ID]]);
    expect(auditoria.registros[0]).toMatchObject({
      acao: "cliente.atribuir-responsavel",
      alvo: "11444777000161",
      resultado: "sucesso",
    });
  });

  it("remove o Responsável com null", async () => {
    const { useCase, responsaveis } = montar();

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: null });

    expect(r.ok).toBe(true);
    expect(responsaveis.chamadas).toEqual([[CLIENTE_ID, null]]);
  });

  it.each([
    ["funcionario", "simples_nacional"],
    ["admin", "administrativo"],
    ["lider_setor", "financeiro"],
  ])("recusa %s do setor %s", async (papel, setor) => {
    const { useCase, sessao, responsaveis } = montar();
    sessao.ator = { id: "x", papel, setor };

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });

    expect(r.ok).toBe(false);
    expect(responsaveis.chamadas).toEqual([]);
  });

  it("recusa quem não é Funcionário do SN e audita falha", async () => {
    const { useCase, responsaveis, auditoria } = montar();

    const r = await useCase.execute({
      clienteId: CLIENTE_ID,
      responsavelId: "99999999-9999-9999-9999-999999999999",
    });

    expect(r.ok).toBe(false);
    expect(responsaveis.chamadas).toEqual([]);
    expect(auditoria.registros[0]?.resultado).toBe("falha");
  });

  it("devolve o erro e audita falha quando a gravação falha", async () => {
    const { useCase, responsaveis, auditoria } = montar();
    responsaveis.falha = true;

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });

    expect(r.ok).toBe(false);
    expect(auditoria.registros[0]?.resultado).toBe("falha");
  });

  it("recusa Cliente inexistente (ou invisível pro ator)", async () => {
    const { useCase, clientes } = montar();
    clientes.cliente = null;

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });

    expect(r.ok).toBe(false);
  });
});
