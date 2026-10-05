import type {
  AuditoriaPort,
  RegistrarAcaoAuditoria,
} from "@/modules/clientes/application/ports/out/auditoria.provider";
import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
  ResponsavelOpcaoDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { ResponsavelClienteRepository } from "@/modules/clientes/application/ports/out/responsavel-cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { AtribuirResponsavelCliente } from "./atribuir-responsavel-cliente.use-case";

const CLIENTE_ID = "11111111-1111-1111-1111-111111111111";
const FUNC_ID = "22222222-2222-2222-2222-222222222222";
const OUTRO_FUNC_ID = "33333333-3333-3333-3333-333333333333";

function cadastro(responsavelId: string | null): CadastroOperacionalClienteDto {
  return {
    id: CLIENTE_ID,
    empresa: "Padaria Pão Quente Ltda",
    cnpj: "11444777000161",
    regime: "simples_nacional",
    formaEnvio: "whatsapp",
    contatos: [],
    documentoObrigatorio: null,
    dasStatus: null,
    dataEnvioDas: null,
    temParcelamento: false,
    parcelamentoStatus: null,
    observacoesGerais: "",
    atividadeMes: { industria: false, comercio: false, servico: false },
    responsavelId,
    responsavelNome: null,
  };
}

class SessaoFalsa implements SessaoPort {
  ator: AtorSessaoDto | null = { id: "lider-1", papel: "lider_setor", setor: "simples_nacional" };
  async usuarioAtual() {
    return this.ator;
  }
}

class QueryFalsa implements Partial<ClienteQueryPort> {
  cliente: CadastroOperacionalClienteDto | null = cadastro(null);
  async buscarCadastroOperacional(): Promise<
    Result<CadastroOperacionalClienteDto | null, AppError>
  > {
    return ok(this.cliente);
  }
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
  const query = new QueryFalsa();
  const responsaveis = new ResponsaveisFalso();
  const auditoria = new AuditoriaFalsa();
  const useCase = new AtribuirResponsavelCliente(
    sessao,
    query as unknown as ClienteQueryPort,
    responsaveis,
    auditoria,
  );
  return { sessao, query, responsaveis, auditoria, useCase };
}

describe("AtribuirResponsavelCliente", () => {
  it("Líder do SN atribui Funcionário do SN e audita como atribuir", async () => {
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

  it("audita trocar quando já havia Responsável e remover quando vira null", async () => {
    const { useCase, query, auditoria } = montar();
    query.cliente = cadastro(OUTRO_FUNC_ID);

    await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });
    await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: null });

    expect(auditoria.registros.map((r) => r.acao)).toEqual([
      "cliente.trocar-responsavel",
      "cliente.remover-responsavel",
    ]);
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

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: OUTRO_FUNC_ID });

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

  it("Cliente inexistente (ou invisível pro ator) devolve NOT_FOUND com mensagem amigável", async () => {
    const { useCase, query } = montar();
    query.cliente = null;

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });

    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(!r.ok && r.error.message).toMatch(/Não encontramos este cliente/);
  });
});
