import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type {
  LeitorDeCartaoPort,
  LeituraBruta,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { LerCartaoDePonto } from "@/modules/rh/application/use-cases/ler-cartao-de-ponto.use-case";
import type { LeituraDoCartao } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import { ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };
const AGORA = new Date("2026-11-20T15:00:00Z");
const JPEG = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), tipo: "image/jpeg" as const };

const h = (hh: number, mm = 0) => hh * 60 + mm;
const dia = (n: number) => ({
  dia: n,
  batidas: [
    { entrada: h(8), saida: h(12) },
    { entrada: h(13), saida: h(17) },
  ],
  extra: null,
  atestado: false,
  faltou: false,
});
const BOA: LeituraDoCartao = { nome: "Erick", dias: [dia(2), dia(3)] };
const lida = (leitura: LeituraDoCartao): LeituraBruta => ({ lido: true, leitura });

function montar(opcoes: {
  ator?: AtorSessaoDto | null;
  leitor: LeitorDeCartaoPort;
  quadro?: { id: string; nome: string; ativo: boolean }[];
}) {
  let quadro = opcoes.quadro ?? [];
  const repositorio = {
    buscarCliente: jest.fn(async () =>
      ok({ cnpj: "11444777000161", empresa: "Teste Ltda", responsavelId: "func" }),
    ),
    listarEmpregados: jest.fn(async () => ok(quadro)),
    buscarPadraoComissionados: jest.fn(async () => ok(false)),
    cadastrarEmpregado: jest.fn(async (_c: string, d: { nome: string }) => {
      quadro = [...quadro, { id: "novo", nome: d.nome, ativo: true }];
      return ok(undefined);
    }),
    iniciarCartao: jest.fn(async () => ok(undefined)),
    salvarDia: jest.fn(async () => ok(undefined)),
  } as unknown as jest.Mocked<FolhaDePontoRepository>;
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const erros = { registrar: jest.fn() };
  const caso = new LerCartaoDePonto(
    { usuarioAtual: async () => (opcoes.ator === undefined ? FUNC : opcoes.ator) },
    repositorio,
    auditoria,
    { agora: () => AGORA },
    opcoes.leitor,
    erros,
  );
  return { caso, repositorio, auditoria, erros };
}

const entrada = { clienteId: "c1", competencia: "2026-11", quinzena: 1 as const, imagem: JPEG };

describe("LerCartaoDePonto", () => {
  it("o leitor leu e a validação passou: grava o cartão no empregado do quadro", async () => {
    const leitor = { ler: jest.fn(async () => lida(BOA)) };
    const { caso, repositorio } = montar({
      leitor,
      quadro: [{ id: "e1", nome: "Erick Santos", ativo: true }],
    });

    const r = await caso.execute(entrada);

    expect(r.ok && r.value).toMatchObject({ empregadoId: "e1", cadastrado: false, dias: 2 });
    expect(repositorio.iniciarCartao).toHaveBeenCalledWith("e1", "2026-11-01");
    expect(repositorio.salvarDia).toHaveBeenCalledTimes(2);
    expect(repositorio.cadastrarEmpregado).not.toHaveBeenCalled();
  });

  it("leitura reprovada na validação cai na digitação, sem gravar, e registra só o motivo", async () => {
    const leitor = { ler: jest.fn(async () => lida({ nome: "NTE", dias: [dia(40)] })) };
    const { caso, repositorio, erros } = montar({ leitor });

    const r = await caso.execute(entrada);

    expect(!r.ok && r.error.message).toMatch(/à mão/);
    expect(repositorio.salvarDia).not.toHaveBeenCalled();
    expect(erros.registrar).toHaveBeenCalledWith("rh.cartao.leitura_reprovada", expect.any(String));
  });

  it("leitor que lança é digitação manual", async () => {
    const leitor = {
      ler: jest.fn(async () => {
        throw new Error("rede");
      }),
    };
    const { caso, erros } = montar({ leitor });

    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(erros.registrar).toHaveBeenCalledWith("rh.cartao.leitor_falhou", expect.any(String));
  });

  it("leitor não leu: digitação manual, nada gravado", async () => {
    const { caso, repositorio } = montar({
      leitor: { ler: async () => ({ lido: false }) },
    });

    const r = await caso.execute(entrada);

    expect(!r.ok && r.error.message).toMatch(/à mão/);
    expect(repositorio.iniciarCartao).not.toHaveBeenCalled();
    expect(repositorio.salvarDia).not.toHaveBeenCalled();
  });

  it("empregado que não está no Quadro é cadastrado, com a Jornada do padrão das batidas", async () => {
    const { caso, repositorio } = montar({
      leitor: { ler: async () => lida(BOA) },
    });

    const r = await caso.execute(entrada);

    // 02/11/2026 é segunda; 03/11, terça: 8h por dia.
    expect(repositorio.cadastrarEmpregado).toHaveBeenCalledWith("c1", {
      nome: "Erick",
      jornada: [0, 480, 480, 0, 0, 0, 0],
      comissionado: false,
    });
    expect(r.ok && r.value).toMatchObject({ empregadoId: "novo", cadastrado: true });
  });

  it("nome que casa com mais de um empregado não é adivinhado", async () => {
    const { caso, repositorio } = montar({
      leitor: { ler: async () => lida(BOA) },
      quadro: [
        { id: "e1", nome: "Erick Santos", ativo: true },
        { id: "e2", nome: "Erick Lima", ativo: true },
      ],
    });

    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(repositorio.salvarDia).not.toHaveBeenCalled();
  });

  it("só o Responsável do RH grava; o Líder é recusado antes de ler (a imagem nem sai)", async () => {
    const ocr = { ler: jest.fn(async () => lida(BOA)) };
    const { caso, auditoria } = montar({ ator: LIDER, leitor: ocr });

    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(ocr.ler).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "rh.ponto.ler-cartao", resultado: "falha" }),
    );
  });

  it.each([
    ["mês futuro", { competencia: "2027-01" }],
    [
      "arquivo que não é imagem",
      { imagem: { bytes: new Uint8Array([1, 2, 3]), tipo: "image/jpeg" as const } },
    ],
    [
      "imagem grande demais",
      {
        imagem: {
          bytes: new Uint8Array(4 * 1024 * 1024 + 1).fill(0xff),
          tipo: "image/jpeg" as const,
        },
      },
    ],
  ])("recusa %s sem chamar o leitor", async (_, troca) => {
    const ocr = { ler: jest.fn(async () => lida(BOA)) };
    const { caso } = montar({ leitor: ocr });

    expect((await caso.execute({ ...entrada, ...troca })).ok).toBe(false);
    expect(ocr.ler).not.toHaveBeenCalled();
  });
});
