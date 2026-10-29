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
    parcelamentos: [],
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
  // Responsável atual do Cliente num Setor fora do SN.
  doSetor: ResponsavelOpcaoDto | null = null;
  setoresListados: string[] = [];
  async listarResponsaveisElegiveis(
    setor: string,
  ): Promise<Result<ResponsavelOpcaoDto[], AppError>> {
    this.setoresListados.push(setor);
    return ok([{ id: FUNC_ID, nome: "Funcionário do Setor" }]);
  }
  async buscarResponsavelDoSetor(): Promise<Result<ResponsavelOpcaoDto | null, AppError>> {
    return ok(this.doSetor);
  }
}

class ResponsaveisFalso implements ResponsavelClienteRepository {
  chamadas: [string, string, string | null][] = [];
  falha = false;
  async atribuir(
    clienteId: string,
    setor: string,
    responsavelId: string | null,
  ): Promise<Result<void, AppError>> {
    if (this.falha) return err(new ValidationError("falha"));
    this.chamadas.push([clienteId, setor, responsavelId]);
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
  it("Líder do SN atribui Funcionário do SN; o sucesso é auditado pelo banco, não pelo caso de uso", async () => {
    const { useCase, responsaveis, auditoria } = montar();

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });

    expect(r.ok).toBe(true);
    expect(responsaveis.chamadas).toEqual([[CLIENTE_ID, "simples_nacional", FUNC_ID]]);
    expect(auditoria.registros).toEqual([]);
  });

  it("falha de gravação audita a ação certa: atribuir, trocar ou remover", async () => {
    const { useCase, query, responsaveis, auditoria } = montar();
    responsaveis.falha = true;

    await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });
    query.cliente = cadastro(OUTRO_FUNC_ID);
    await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });
    await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: null });

    expect(auditoria.registros.map((r) => [r.acao, r.resultado])).toEqual([
      ["cliente.atribuir-responsavel", "falha"],
      ["cliente.trocar-responsavel", "falha"],
      ["cliente.remover-responsavel", "falha"],
    ]);
    expect(auditoria.registros[0]).toMatchObject({ alvo: "11444777000161" });
  });

  it("reatribuir o mesmo Responsável (ou remover sem ter) não grava nem audita", async () => {
    const { useCase, query, responsaveis, auditoria } = montar();
    query.cliente = cadastro(FUNC_ID);

    const igual = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });
    query.cliente = cadastro(null);
    const semNada = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: null });

    expect(igual.ok && semNada.ok).toBe(true);
    expect(responsaveis.chamadas).toEqual([]);
    expect(auditoria.registros).toEqual([]);
  });

  it.each([
    ["funcionario", "simples_nacional"],
    ["admin", "administrativo"],
    ["lider_setor", "recepcao"],
  ])("recusa %s do setor %s", async (papel, setor) => {
    const { useCase, sessao, responsaveis } = montar();
    sessao.ator = { id: "x", papel, setor };

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });

    expect(r.ok).toBe(false);
    expect(responsaveis.chamadas).toEqual([]);
  });

  it("Líder de Setor fora do SN atribui, troca e remove no próprio Setor, lendo o atual de cliente_responsaveis", async () => {
    const { useCase, sessao, query, responsaveis, auditoria } = montar();
    sessao.ator = { id: "lider-fin", papel: "lider_setor", setor: "financeiro" };

    await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });
    query.doSetor = { id: FUNC_ID, nome: "Funcionário do Setor" };
    const igual = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: FUNC_ID });
    await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: null });

    expect(igual.ok).toBe(true);
    expect(responsaveis.chamadas).toEqual([
      [CLIENTE_ID, "financeiro", FUNC_ID],
      [CLIENTE_ID, "financeiro", null],
    ]);
    expect(query.setoresListados).toEqual(["financeiro"]);
    expect(auditoria.registros).toEqual([]);
  });

  it("Líder de Setor fora do SN recusa quem não é Funcionário do Setor e audita a falha", async () => {
    const { useCase, sessao, responsaveis, auditoria } = montar();
    sessao.ator = { id: "lider-fin", papel: "lider_setor", setor: "financeiro" };

    const r = await useCase.execute({ clienteId: CLIENTE_ID, responsavelId: OUTRO_FUNC_ID });

    expect(r.ok).toBe(false);
    expect(responsaveis.chamadas).toEqual([]);
    expect(auditoria.registros[0]).toMatchObject({
      acao: "cliente.atribuir-responsavel",
      setor: "financeiro",
      resultado: "falha",
    });
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
