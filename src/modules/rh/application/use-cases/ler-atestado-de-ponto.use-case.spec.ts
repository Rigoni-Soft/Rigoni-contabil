import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type {
  AtestadoBruto,
  LeitorDeAtestadoPort,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { LerAtestadoDePonto } from "@/modules/rh/application/use-cases/ler-atestado-de-ponto.use-case";
import type { AtestadoLido } from "@/modules/rh/domain/services/atestado.service";
import { ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const AGORA = new Date("2026-11-20T15:00:00Z");
const JPEG = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), tipo: "image/jpeg" as const };
// Segunda a sexta 8h45, sábado 4h, domingo folga.
const JORNADA = [0, 525, 525, 525, 525, 525, 240];
const DIA_COM_BATIDA = {
  data: "2026-08-27",
  batidas: [{ entrada: 510, saida: 1020 }],
  extra: null,
  abono: false,
};

const lido = (a: Partial<AtestadoLido> = {}): AtestadoBruto => ({
  lido: true,
  atestado: {
    nome: "Roberto Carlos Von Scharten",
    tipo: "atestado",
    de: "2026-08-23",
    ate: "2026-08-24",
    ...a,
  },
});

function montar(opcoes: {
  leitor: LeitorDeAtestadoPort;
  ativo?: boolean;
  nome?: string;
  dias?: unknown[];
  ator?: AtorSessaoDto | null;
}) {
  const quadro = [
    { id: "e1", nome: opcoes.nome ?? "Roberto", ativo: opcoes.ativo ?? true, jornada: JORNADA },
  ];
  const repositorio = {
    buscarClienteDoEmpregado: jest.fn(async () => ok("c1")),
    buscarCliente: jest.fn(async () =>
      ok({ cnpj: "11444777000161", empresa: "Teste Ltda", responsavelId: "func" }),
    ),
    listarEmpregados: jest.fn(async () => ok(quadro)),
    listarDias: jest.fn(async () => ok(opcoes.dias ?? [])),
    salvarDia: jest.fn(async () => ok(undefined)),
  } as unknown as jest.Mocked<FolhaDePontoRepository>;
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const erros = { registrar: jest.fn() };
  const caso = new LerAtestadoDePonto(
    { usuarioAtual: async () => (opcoes.ator === undefined ? FUNC : opcoes.ator) },
    repositorio,
    auditoria,
    { agora: () => AGORA },
    opcoes.leitor,
    erros,
  );
  return { caso, repositorio, erros };
}

const entrada = { empregadoId: "e1", imagem: JPEG };

describe("LerAtestadoDePonto", () => {
  it("atestado abona o dia de trabalho vazio coberto; o domingo sem carga fica de fora", async () => {
    const { caso, repositorio } = montar({ leitor: { lerAtestado: async () => lido() } });

    const r = await caso.execute(entrada);

    expect(r.ok && r.value).toEqual({ tipo: "atestado", abonados: 1 });
    expect(repositorio.salvarDia).toHaveBeenCalledTimes(1);
    expect(repositorio.salvarDia).toHaveBeenCalledWith("e1", {
      data: "2026-08-24",
      batidas: [],
      extra: null,
      abono: true,
    });
  });

  it("declaração abona só o horário: o dia com batida mantém as batidas e ganha o Abono", async () => {
    const { caso, repositorio } = montar({
      leitor: {
        lerAtestado: async () => lido({ tipo: "declaracao", de: "2026-08-27", ate: null }),
      },
      dias: [DIA_COM_BATIDA],
    });

    const r = await caso.execute(entrada);

    expect(r.ok && r.value.abonados).toBe(1);
    expect(repositorio.salvarDia).toHaveBeenCalledWith("e1", { ...DIA_COM_BATIDA, abono: true });
  });

  it("nada a abonar (declaração em dia sem batida) é erro com o motivo, sem gravar", async () => {
    const { caso, repositorio } = montar({
      leitor: { lerAtestado: async () => lido({ tipo: "declaracao", de: "2026-08-27" }) },
    });

    const r = await caso.execute(entrada);

    expect(!r.ok && r.error.message).toMatch(/nenhum dia/i);
    expect(repositorio.salvarDia).not.toHaveBeenCalled();
  });

  it("nome do atestado que não confere com o empregado do cartão: não abona", async () => {
    const { caso, repositorio } = montar({
      leitor: { lerAtestado: async () => lido({ nome: "Lauro Beatriz Tavares" }) },
    });

    const r = await caso.execute(entrada);

    expect(!r.ok && r.error.message).toMatch(/não confere/);
    expect(repositorio.salvarDia).not.toHaveBeenCalled();
  });

  it("empregado desligado não recebe abono", async () => {
    const { caso, repositorio } = montar({
      leitor: { lerAtestado: async () => lido() },
      ativo: false,
    });

    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(repositorio.salvarDia).not.toHaveBeenCalled();
  });

  it("leitura que não leu ou reprovou na validação cai no abono manual, sem gravar", async () => {
    for (const leitura of [
      { lido: false } as AtestadoBruto,
      lido({ nome: null }),
      lido({ de: "2026-12-30", ate: "2026-12-31" }),
    ]) {
      const { caso, repositorio } = montar({ leitor: { lerAtestado: async () => leitura } });
      const r = await caso.execute(entrada);
      expect(!r.ok && r.error.message).toMatch(/à mão/);
      expect(repositorio.salvarDia).not.toHaveBeenCalled();
    }
  });

  it("leitor que lança é abono manual", async () => {
    const { caso, erros } = montar({
      leitor: {
        lerAtestado: async () => {
          throw new Error("rede");
        },
      },
    });

    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(erros.registrar).toHaveBeenCalledWith("rh.atestado.leitor_falhou", expect.any(String));
  });

  it("recusa foto que não é imagem e quem não é o Responsável do RH, sem chamar o leitor", async () => {
    const lerAtestado = jest.fn(async () => lido());
    const sem = montar({ leitor: { lerAtestado } });
    const naoImagem = await sem.caso.execute({
      ...entrada,
      imagem: { bytes: new Uint8Array([1, 2]), tipo: "image/png" },
    });
    expect(naoImagem.ok).toBe(false);

    const alheio = montar({ leitor: { lerAtestado }, ator: { ...FUNC, id: "outro" } });
    expect((await alheio.caso.execute(entrada)).ok).toBe(false);
    expect(lerAtestado).not.toHaveBeenCalled();
  });
});
