import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import {
  DefinirConvencaoDoEmpregado,
  DefinirInterruptoresDoCliente,
} from "@/modules/rh/application/use-cases/definir-convencao-do-ponto.use-case";
import { ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };

function montar(ator: AtorSessaoDto | null) {
  const repositorio = {
    buscarCliente: jest.fn(async () => ok({ cnpj: "11444777000161", responsavelId: "func" })),
    buscarClienteDoEmpregado: jest.fn(async () => ok("c1")),
    definirInterruptores: jest.fn(async () => ok(undefined)),
    definirConvencaoDoEmpregado: jest.fn(async () => ok(undefined)),
  } as unknown as jest.Mocked<FolhaDePontoRepository>;
  const sessao = { usuarioAtual: async () => ator };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  return {
    repositorio,
    auditoria,
    interruptores: new DefinirInterruptoresDoCliente(sessao, repositorio, auditoria),
    ponteiro: new DefinirConvencaoDoEmpregado(sessao, repositorio, auditoria),
  };
}

describe("DefinirInterruptoresDoCliente", () => {
  it("o Responsável liga o banco de horas e o trabalho aos domingos", async () => {
    const { interruptores, repositorio } = montar(FUNC);

    const r = await interruptores.execute({
      clienteId: "c1",
      bancoDeHoras: true,
      trabalhoAosDomingos: false,
    });

    expect(r.ok).toBe(true);
    expect(repositorio.definirInterruptores).toHaveBeenCalledWith("c1", {
      bancoDeHoras: true,
      trabalhoAosDomingos: false,
    });
  });

  it("o Líder só lê: recusa e audita a tentativa", async () => {
    const { interruptores, repositorio, auditoria } = montar(LIDER);

    const r = await interruptores.execute({
      clienteId: "c1",
      bancoDeHoras: true,
      trabalhoAosDomingos: true,
    });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(repositorio.definirInterruptores).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "rh.cliente.interruptores", resultado: "falha" }),
    );
  });
});

describe("DefinirConvencaoDoEmpregado", () => {
  it("aponta o empregado para o sindicato, sem espaços nas pontas", async () => {
    const { ponteiro, repositorio } = montar(FUNC);

    const r = await ponteiro.execute({ empregadoId: "e1", sindicato: " Comércio " });

    expect(r.ok).toBe(true);
    expect(repositorio.definirConvencaoDoEmpregado).toHaveBeenCalledWith("e1", "Comércio");
  });

  it("nulo devolve o empregado à única convenção do Cliente", async () => {
    const { ponteiro, repositorio } = montar(FUNC);

    await ponteiro.execute({ empregadoId: "e1", sindicato: null });

    expect(repositorio.definirConvencaoDoEmpregado).toHaveBeenCalledWith("e1", null);
  });

  it("recusa sindicato em branco", async () => {
    const { ponteiro, repositorio } = montar(FUNC);

    const r = await ponteiro.execute({ empregadoId: "e1", sindicato: "  " });

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(repositorio.definirConvencaoDoEmpregado).not.toHaveBeenCalled();
  });

  it("recusa quem não é o Responsável do Cliente do empregado", async () => {
    const { ponteiro, repositorio } = montar(LIDER);

    const r = await ponteiro.execute({ empregadoId: "e1", sindicato: "Comércio" });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(repositorio.definirConvencaoDoEmpregado).not.toHaveBeenCalled();
  });
});
