import type {
  DiaDaFolhaDto,
  FolhaDePontoDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type { GeradorDePdfDoCartaoPort } from "@/modules/rh/application/ports/out/gerador-de-pdf-do-cartao.provider";
import type { AtorSessaoDto } from "@/modules/rh/application/ports/out/sessao.provider";
import { BaixarPdfDoCartao } from "@/modules/rh/application/use-cases/baixar-pdf-do-cartao.use-case";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok } from "@/shared/kernel/result";

const FUNC: AtorSessaoDto = { id: "func", papel: "funcionario", setor: "rh" };
const ENTRADA = { clienteId: "c1", empregadoId: "e1", competencia: "2026-11" };
const ZERO = {
  normaisMin: 525,
  extras: [{ percentual: 50, minutos: 15 }],
  bancoDeHorasMin: 0,
  acimaDoLimiteMin: 0,
  noturnoMin: 0,
  atrasoMin: 0,
  faltas: 1,
  abonoDias: 1,
  abonoMin: 525,
  feriadosTrabalhados: 0,
  sabadosTrabalhados: 0,
  diasComLanche: 1,
};
const JORNADA = [0, 525, 525, 525, 525, 525, 240] as const;

function dia(data: string, semana: number, extras: Partial<DiaDaFolhaDto> = {}): DiaDaFolhaDto {
  return {
    data,
    batidas: [],
    extra: null,
    abono: false,
    feriado: false,
    temApontamento: !!extras.batidas?.length || !!extras.extra || !!extras.abono,
    diaDaSemana: semana,
    cargaMin: JORNADA[semana],
    diaDeTrabalho: JORNADA[semana] > 0,
    trabalhadoMin: 0,
    apuracao: { ...ZERO, faltas: 0 },
    ...extras,
  };
}

const EMPREGADO = {
  id: "e1",
  nome: "Maria da Conceição",
  jornada: JORNADA,
  comissionado: false,
  ativo: true,
};

const FOLHA: FolhaDePontoDto = {
  clienteId: "c1",
  empresa: "Padaria Teste Ltda",
  competencia: "2026-11",
  padraoComissionados: false,
  empregados: [],
  podeEditar: true,
  selecionado: {
    empregado: {
      id: "e1",
      nome: "Maria da Conceição",
      jornada: JORNADA,
      comissionado: false,
      ativo: true,
      semMovimento: false,
    },
    dias: [
      dia("2026-11-02", 1, {
        batidas: [
          { entrada: 480, saida: 720 },
          { entrada: 780, saida: 1080 },
        ],
        trabalhadoMin: 540,
      }),
      dia("2026-11-03", 2, { abono: true }),
      dia("2026-11-04", 3, { apuracao: ZERO }),
      dia("2026-11-08", 0),
    ],
    totalizacao: ZERO,
    iniciado: true,
    semConvencao: true,
  },
};

function montar(opcoes: {
  ator?: AtorSessaoDto | null;
  apurado?: unknown;
  // null: empregado fora da vista do ator.
  empregado?: typeof EMPREGADO | null;
  // true: o gerador lança um Error; texto: lança esse valor, que não é Error.
  falhaDoGerador?: boolean | string;
}) {
  // Quando a leitura falha ou o cartão vem sem empregado, o apurador falso devolve o resultado combinado.
  const apurador = {
    apurar: jest.fn(async () => opcoes.apurado ?? ok([FOLHA.selecionado!])),
  };
  const gerador: GeradorDePdfDoCartaoPort = {
    gerar: jest.fn(async () => {
      if (opcoes.falhaDoGerador === true) throw new Error("boom");
      if (opcoes.falhaDoGerador) throw opcoes.falhaDoGerador;
      return new Uint8Array([37, 80, 68, 70]);
    }),
  };
  const auditoria = { registrar: jest.fn(async () => undefined) };
  const erros = { registrar: jest.fn() };
  const repositorio = {
    buscarCliente: jest.fn(async () =>
      ok({ cnpj: "11444777000161", empresa: "Padaria Teste Ltda", responsavelId: "func" }),
    ),
    buscarEmpregado: jest.fn(async () =>
      ok(opcoes.empregado === undefined ? EMPREGADO : opcoes.empregado),
    ),
    listarSemMovimento: jest.fn(async () => ok([])),
  } as never;
  const caso = new BaixarPdfDoCartao(
    { usuarioAtual: async () => (opcoes.ator === undefined ? FUNC : opcoes.ator) },
    repositorio,
    apurador as never,
    { agora: () => new Date("2026-11-20T15:00:00Z") },
    gerador,
    auditoria,
    erros,
  );
  return { caso, apurador, repositorio, gerador, auditoria, erros };
}

describe("BaixarPdfDoCartao", () => {
  it("gera o PDF do mês do empregado e audita o download com sucesso", async () => {
    const { caso, gerador, auditoria } = montar({});

    const r = await caso.execute(ENTRADA);

    expect(r.ok && r.value.nomeDoArquivo).toBe("cartao-de-ponto-maria-da-conceicao-2026-11.pdf");
    expect(r.ok && r.value.bytes).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(gerador.gerar).toHaveBeenCalledTimes(1);
    expect(auditoria.registrar).toHaveBeenCalledWith({
      ator: "func",
      setor: "rh",
      acao: "rh.ponto.baixar-pdf",
      alvo: "11444777000161 Maria da Conceição 2026-11",
      resultado: "sucesso",
    });
  });

  it("monta o documento com identificação, dias, abono, falta, Totalização e o aviso de legislação", async () => {
    const { caso, gerador } = montar({});

    await caso.execute(ENTRADA);

    const documento = (gerador.gerar as jest.Mock).mock.calls[0][0];
    expect(documento).toMatchObject({
      empresa: "Padaria Teste Ltda",
      empregado: "Maria da Conceição",
      periodo: "11/2026",
    });
    expect(documento.linhas[0]).toEqual({
      data: "02/11",
      diaDaSemana: "seg",
      batidas: ["08:00", "12:00", "13:00", "18:00"],
      extra: "",
      horasDiarias: "9h00",
      situacao: "",
    });
    expect(documento.linhas.map((l: { situacao: string }) => l.situacao)).toEqual([
      "",
      "Abono",
      "Falta",
      "Folga",
    ]);
    expect(documento.totalizacao).toEqual(
      expect.arrayContaining([
        { rotulo: "Extras 50%", valor: "0h15" },
        { rotulo: "Faltas", valor: "1 dia" },
        { rotulo: "Abonos", valor: "1 dia · 8h45" },
      ]),
    );
    expect(documento.avisoDaTotalizacao).toContain("legislação");
  });

  it("cartão com motivoSemPdf (desligado, sem movimento, sem apontamento): não gera o PDF e audita a recusa", async () => {
    const motivo = "Empregado desligado: não há cartão para assinar.";
    const { caso, gerador, auditoria } = montar({
      apurado: ok([{ ...FOLHA.selecionado!, motivoSemPdf: motivo }]),
    });

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(!r.ok && r.error.message).toBe(motivo);
    expect(gerador.gerar).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: "rh.ponto.baixar-pdf",
        alvo: "11444777000161 Maria da Conceição 2026-11",
        resultado: "falha",
      }),
    );
    expect(auditoria.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "sucesso" }),
    );
  });

  it("sem sessão recusa e nada é gerado nem auditado", async () => {
    const { caso, gerador, auditoria } = montar({ ator: null });

    const r = await caso.execute(ENTRADA);

    expect(r.ok).toBe(false);
    expect(gerador.gerar).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it("quem não lê a Folha de ponto é recusado e a tentativa é auditada como falha", async () => {
    const { caso, gerador, auditoria } = montar({
      ator: { id: "sn", papel: "funcionario", setor: "simples_nacional" },
    });

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(gerador.gerar).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "rh.ponto.baixar-pdf", resultado: "falha" }),
    );
  });

  it("lê só o empregado pedido, sem o Quadro do Cliente", async () => {
    const { caso, apurador, repositorio } = montar({});

    await caso.execute(ENTRADA);

    expect(apurador.apurar).toHaveBeenCalledWith(
      "c1",
      [expect.objectContaining({ id: "e1", semMovimento: false })],
      expect.objectContaining({ valor: "2026-11" }),
    );
    expect(
      (repositorio as unknown as { buscarEmpregado: jest.Mock }).buscarEmpregado,
    ).toHaveBeenCalledWith("c1", "e1");
  });

  it("empregado fora da vista ou de outro Cliente: não encontrado, nada gerado, falha auditada", async () => {
    const { caso, gerador, auditoria } = montar({ empregado: null });

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("NOT_FOUND");
    expect(gerador.gerar).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "falha" }),
    );
  });

  it("mês futuro é recusado", async () => {
    const { caso, gerador } = montar({});

    const r = await caso.execute({ ...ENTRADA, competencia: "2026-12" });

    expect(!r.ok && r.error.code).toBe("VALIDATION_ERROR");
    expect(gerador.gerar).not.toHaveBeenCalled();
  });

  it("falha do gerador vira erro de geração, é registrada e auditada como falha", async () => {
    const { caso, auditoria, erros } = montar({ falhaDoGerador: true });

    const r = await caso.execute(ENTRADA);

    expect(!r.ok && r.error.code).toBe("DOCUMENT_GENERATION_ERROR");
    expect(erros.registrar).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "falha" }),
    );
    expect(auditoria.registrar).not.toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "sucesso" }),
    );
  });

  it("falha do gerador que não é Error registra o valor lançado como causa", async () => {
    const { caso, erros } = montar({ falhaDoGerador: "sem fonte" });

    await caso.execute(ENTRADA);

    expect(erros.registrar).toHaveBeenCalledWith(expect.any(String), "sem fonte");
  });
});
