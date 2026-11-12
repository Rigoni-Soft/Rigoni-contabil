import type { ConvencaoDto } from "@/modules/rh/application/dtos/convencao.dto";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { ObterConvencoesDoCliente } from "@/modules/rh/application/use-cases/obter-convencoes-do-cliente.use-case";
import { ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };

const CONVENCAO: ConvencaoDto = {
  id: "cv1",
  sindicato: "Comércio",
  vigenciaInicio: "2026-05-01",
  vigenciaFim: "2027-04-30",
  arquivoNome: "cct.pdf",
  enviadaEm: "2026-11-11",
  regras: { versao: 1, aplicadas: [], rejeitadas: [] },
};

function montar(ator: AtorSessaoDto | null, cliente = { cnpj: "1", responsavelId: "func" }) {
  const folha = {
    buscarCliente: jest.fn(async () => ok(cliente)),
    buscarInterruptores: jest.fn(async () =>
      ok({ bancoDeHoras: false, trabalhoAosDomingos: true }),
    ),
    listarEmpregados: jest.fn(async () =>
      ok([
        { id: "e1", nome: "Ana", jornada: [], comissionado: false, ativo: true },
        { id: "e2", nome: "Bia", jornada: [], comissionado: false, ativo: true },
        { id: "e3", nome: "Inativa", jornada: [], comissionado: false, ativo: false },
      ]),
    ),
    listarConvencaoDosEmpregados: jest.fn(async () =>
      ok([{ empregadoId: "e2", sindicato: "Comércio" }]),
    ),
  } as unknown as jest.Mocked<FolhaDePontoRepository>;
  const convencoes: jest.Mocked<ConvencaoRepository> = {
    listar: jest.fn().mockResolvedValue(ok([CONVENCAO])),
    inserir: jest.fn(),
  };
  return {
    folha,
    caso: new ObterConvencoesDoCliente({ usuarioAtual: async () => ator }, folha, convencoes),
  };
}

describe("ObterConvencoesDoCliente", () => {
  it("devolve o histórico, os interruptores e o sindicato de cada empregado ativo", async () => {
    const { caso } = montar(LIDER);

    const r = await caso.execute({ clienteId: "c1" });

    expect(r.ok && r.value).toEqual({
      clienteId: "c1",
      convencoes: [CONVENCAO],
      interruptores: { bancoDeHoras: false, trabalhoAosDomingos: true },
      empregados: [
        { id: "e1", nome: "Ana", convencaoSindicato: null },
        { id: "e2", nome: "Bia", convencaoSindicato: "Comércio" },
      ],
      podeEnviar: true,
      podeEditar: false,
    });
  });

  it("o Responsável do RH edita, mas não envia convenção", async () => {
    const { caso } = montar(FUNC);

    const r = await caso.execute({ clienteId: "c1" });

    expect(r.ok && [r.value.podeEnviar, r.value.podeEditar]).toEqual([false, true]);
  });

  it("o Funcionário que não é o Responsável só lê", async () => {
    const { caso } = montar(FUNC, { cnpj: "1", responsavelId: "outro" });

    const r = await caso.execute({ clienteId: "c1" });

    expect(r.ok && [r.value.podeEnviar, r.value.podeEditar]).toEqual([false, false]);
  });

  it.each([
    ["de outro setor", { id: "x", papel: "funcionario", setor: "sn" }],
    ["sem sessão", null],
  ])("recusa quem está %s", async (_nome, ator) => {
    const { caso } = montar(ator);

    const r = await caso.execute({ clienteId: "c1" });

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
  });

  it("recusa Cliente fora da vista", async () => {
    const { caso, folha } = montar(LIDER);
    folha.buscarCliente.mockResolvedValue(ok(null));

    const r = await caso.execute({ clienteId: "c1" });

    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
  });
});
