import type { DiaDoPontoDto } from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type {
  LeitorDeCartaoPort,
  LeituraBruta,
} from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { LerCartaoDePonto } from "@/modules/rh/application/use-cases/ler-cartao-de-ponto.use-case";
import type { LeituraDoCartao } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const LIDER: AtorSessaoDto = { id: "lider", papel: "lider_setor", setor: "rh" };
const AGORA = new Date("2026-11-20T15:00:00Z");
const JPEG = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), tipo: "image/jpeg" as const };

const emMinutos = (horas: number, minutos = 0) => horas * 60 + minutos;
const dia = (n: number) => ({
  dia: n,
  batidas: [
    { entrada: emMinutos(8), saida: emMinutos(12) },
    { entrada: emMinutos(13), saida: emMinutos(17) },
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
  feriados?: string[];
  dias?: DiaDoPontoDto[];
}) {
  const JORNADA = [0, 525, 525, 525, 525, 525, 240];
  let quadro = (opcoes.quadro ?? []).map((e) => ({ jornada: JORNADA, ...e }));
  const repositorio = {
    buscarCliente: jest.fn(async () =>
      ok({ cnpj: "11444777000161", empresa: "Teste Ltda", responsavelId: "func" }),
    ),
    listarEmpregados: jest.fn(async () => ok(quadro)),
    buscarPadraoComissionados: jest.fn(async () => ok(false)),
    cadastrarEmpregado: jest.fn(async (_c: string, d: { nome: string }) => {
      quadro = [...quadro, { id: "novo", nome: d.nome, ativo: true, jornada: JORNADA }];
      return ok(undefined);
    }),
    listarFeriados: jest.fn(async () => ok(opcoes.feriados ?? [])),
    listarDias: jest.fn(async () => ok(opcoes.dias ?? [])),
    gravarCartao: jest.fn(async () => ok(undefined)),
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

    expect(r.ok && r.value).toMatchObject({
      empregadoId: "e1",
      cadastrado: false,
      dias: 2,
      mantidos: 0,
    });
    expect(repositorio.gravarCartao).toHaveBeenCalledTimes(1);
    expect(repositorio.gravarCartao).toHaveBeenCalledWith("e1", "2026-11-01", [
      expect.objectContaining({ data: "2026-11-02" }),
      expect.objectContaining({ data: "2026-11-03" }),
    ]);
    expect(repositorio.cadastrarEmpregado).not.toHaveBeenCalled();
  });

  it("ler o cartão depois de um atestado ou de um abono à mão não apaga o abono nem troca a batida digitada", async () => {
    const leitor = { ler: jest.fn(async () => lida(BOA)) };
    const { caso, repositorio } = montar({
      leitor,
      quadro: [{ id: "e1", nome: "Erick Santos", ativo: true }],
      dias: [
        { data: "2026-11-02", batidas: [], extra: null, abono: true },
        {
          data: "2026-11-03",
          batidas: [{ entrada: emMinutos(9), saida: emMinutos(18) }],
          extra: null,
          abono: false,
        },
      ],
    });

    const r = await caso.execute(entrada);

    expect(r.ok && r.value).toMatchObject({ dias: 0, mantidos: 2 });
    expect(repositorio.gravarCartao).toHaveBeenCalledWith("e1", "2026-11-01", []);
  });

  it("o dia lido que o cartão ainda não tem é preenchido, e o que já tem fica", async () => {
    const leitor = { ler: jest.fn(async () => lida(BOA)) };
    const { caso, repositorio } = montar({
      leitor,
      quadro: [{ id: "e1", nome: "Erick Santos", ativo: true }],
      dias: [{ data: "2026-11-02", batidas: [], extra: null, abono: true }],
    });

    const r = await caso.execute(entrada);

    expect(r.ok && r.value).toMatchObject({ dias: 1, mantidos: 1 });
    expect(repositorio.gravarCartao).toHaveBeenCalledWith("e1", "2026-11-01", [
      expect.objectContaining({ data: "2026-11-03" }),
    ]);
  });

  it("falta lida em dia que o RH já preencheu é mantida e não entra na contagem do resumo", async () => {
    const leitor = {
      ler: jest.fn(async () =>
        lida({
          nome: "Erick",
          dias: [
            { ...dia(2), batidas: [], faltou: true },
            { ...dia(3), batidas: [], faltou: true },
            dia(4),
          ],
        }),
      ),
    };
    const { caso } = montar({
      leitor,
      quadro: [{ id: "e1", nome: "Erick Santos", ativo: true }],
      dias: [{ data: "2026-11-02", batidas: [], extra: null, abono: true }],
    });

    const r = await caso.execute(entrada);

    expect(r.ok && r.value.faltas).toBe(1);
  });

  it("falha da gravação atômica devolve o erro e não conta dia nenhum como gravado", async () => {
    const leitor = { ler: jest.fn(async () => lida(BOA)) };
    const { caso, repositorio } = montar({
      leitor,
      quadro: [{ id: "e1", nome: "Erick Santos", ativo: true }],
    });
    repositorio.gravarCartao.mockResolvedValueOnce(err(new ValidationError("falhou no dia 3")));

    const r = await caso.execute(entrada);

    expect(!r.ok && r.error.message).toBe("falhou no dia 3");
  });

  it("anotação de atestado em dia sem carga (domingo) não grava o abono", async () => {
    const leitor = {
      ler: jest.fn(async () =>
        lida({
          nome: "Erick",
          dias: [
            { ...dia(1), batidas: [], atestado: true },
            { ...dia(2), atestado: false },
            { ...dia(3), batidas: [], atestado: true },
          ],
        }),
      ),
    };
    const { caso, repositorio } = montar({
      leitor,
      quadro: [{ id: "e1", nome: "Erick Santos", ativo: true }],
    });

    const r = await caso.execute(entrada);

    const datas = repositorio.gravarCartao.mock.calls[0][2].map((d) => d.data);
    expect(datas).toEqual(["2026-11-02", "2026-11-03"]);
    expect(r.ok && r.value.abonos).toBe(1);
  });

  it("anotação de atestado em feriado com carga também não vira abono: a regra é a mesma da tela", async () => {
    const leitor = {
      ler: jest.fn(async () =>
        lida({ nome: "Erick", dias: [{ ...dia(2), batidas: [], atestado: true }, dia(3)] }),
      ),
    };
    const { caso, repositorio } = montar({
      leitor,
      quadro: [{ id: "e1", nome: "Erick Santos", ativo: true }],
      feriados: ["2026-11-02"],
    });

    const r = await caso.execute(entrada);

    const datas = repositorio.gravarCartao.mock.calls[0][2].map((d) => d.data);
    expect(datas).toEqual(["2026-11-03"]);
    expect(r.ok && r.value.abonos).toBe(0);
  });

  it("leitura reprovada na validação cai na digitação, sem gravar, e registra só o motivo", async () => {
    const leitor = { ler: jest.fn(async () => lida({ nome: "NTE", dias: [dia(40)] })) };
    const { caso, repositorio, erros } = montar({ leitor });

    const r = await caso.execute(entrada);

    expect(!r.ok && r.error.message).toMatch(/à mão/);
    expect(repositorio.gravarCartao).not.toHaveBeenCalled();
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
    expect(erros.registrar).toHaveBeenCalledWith("rh.cartao.leitor_falhou", "Error");
  });

  it("leitor não leu: digitação manual, nada gravado", async () => {
    const { caso, repositorio } = montar({
      leitor: { ler: async () => ({ lido: false }) },
    });

    const r = await caso.execute(entrada);

    expect(!r.ok && r.error.message).toMatch(/à mão/);
    expect(repositorio.gravarCartao).not.toHaveBeenCalled();
  });

  it("empregado que não está no Quadro é cadastrado, com a Jornada do padrão das batidas", async () => {
    const { caso, repositorio } = montar({
      leitor: { ler: async () => lida(BOA) },
    });

    const r = await caso.execute(entrada);

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
    expect(repositorio.gravarCartao).not.toHaveBeenCalled();
  });

  it("só o Responsável do RH grava; o Líder é recusado antes de ler (a imagem nem sai)", async () => {
    const leitor = { ler: jest.fn(async () => lida(BOA)) };
    const { caso, auditoria } = montar({ ator: LIDER, leitor });

    expect((await caso.execute(entrada)).ok).toBe(false);
    expect(leitor.ler).not.toHaveBeenCalled();
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
      "arquivo que só começa como JPEG (2 bytes não bastam)",
      { imagem: { bytes: new Uint8Array([0xff, 0xd8, 0x00]), tipo: "image/jpeg" as const } },
    ],
    [
      "JPEG declarado como PNG",
      { imagem: { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), tipo: "image/png" as const } },
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
    const leitor = { ler: jest.fn(async () => lida(BOA)) };
    const { caso } = montar({ leitor });

    expect((await caso.execute({ ...entrada, ...troca })).ok).toBe(false);
    expect(leitor.ler).not.toHaveBeenCalled();
  });
});
