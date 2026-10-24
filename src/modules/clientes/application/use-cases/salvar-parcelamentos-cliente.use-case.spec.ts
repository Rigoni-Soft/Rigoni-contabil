import type { SalvarParcelamentosClienteInput } from "@/modules/clientes/application/ports/in/salvar-parcelamentos-cliente.provider";
import type { ArquivoStoragePort } from "@/modules/clientes/application/ports/out/arquivo-storage.provider";
import type {
  ClienteParcelamentoRepository,
  ParcelamentoSalvo,
} from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import type { ClienteRepository } from "@/modules/clientes/application/ports/out/cliente.repository";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/clientes/application/ports/out/sessao.provider";
import { Cliente } from "@/modules/clientes/domain/entities/cliente.entity";
import type { ParcelamentoProps } from "@/modules/clientes/domain/value-objects/parcelamento.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

import { SalvarParcelamentosCliente } from "./salvar-parcelamentos-cliente.use-case";

const CLIENTE_ID = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const CNPJ_VALIDO = "11444777000161";
const pdf = (nome = "acordo.pdf") => new File(["%PDF"], nome, { type: "application/pdf" });

const salvo = (sobrescrever: Partial<ParcelamentoSalvo> = {}): ParcelamentoSalvo => ({
  id: "11111111-1111-4111-8111-111111111111",
  codigo: "A-1",
  parcelasRestantes: 10,
  interno: false,
  arquivoCaminho: `${CLIENTE_ID}/11111111-1111-4111-8111-111111111111-a.pdf`,
  quitado: false,
  temEnvio: false,
  enviadoNoMes: false,
  ...sobrescrever,
});

class StorageFalso implements ArquivoStoragePort {
  enviados: string[] = [];
  removidos: string[] = [];
  async enviar(caminho: string): Promise<Result<{ caminho: string }, AppError>> {
    this.enviados.push(caminho);
    return ok({ caminho });
  }
  async remover(caminhos: string[]): Promise<Result<void, AppError>> {
    this.removidos.push(...caminhos);
    return ok(undefined);
  }
}

function montar(
  opcoes: { ator?: AtorSessaoDto | null; regime?: string; existentes?: ParcelamentoSalvo[] } = {},
) {
  const ator =
    opcoes.ator === undefined
      ? { id: "u-1", papel: "funcionario", setor: "simples_nacional" }
      : opcoes.ator;
  const sessao: SessaoPort = { usuarioAtual: async () => ator };
  const cliente = Cliente.builder()
    .comId(CLIENTE_ID)
    .comEmpresa("Padaria Ltda")
    .comCnpj(CNPJ_VALIDO)
    .comRegime(opcoes.regime ?? "simples_nacional")
    .comAlteracoesContratuais([])
    .build();
  if (!cliente.ok) throw new Error("setup inválido");
  const clientes = {
    buscarPorId: jest.fn().mockResolvedValue(ok(cliente.value)),
  } as unknown as ClienteRepository;
  const gravar = jest
    .fn<Promise<Result<void, AppError>>, [string, ParcelamentoProps[]]>()
    .mockResolvedValue(ok(undefined));
  const parcelamentos: ClienteParcelamentoRepository = {
    listar: jest.fn().mockResolvedValue(ok(opcoes.existentes ?? [])),
    salvar: gravar,
  };
  const storage = new StorageFalso();
  return {
    gravar,
    storage,
    listar: parcelamentos.listar as jest.Mock,
    caso: new SalvarParcelamentosCliente(sessao, clientes, parcelamentos, storage),
  };
}

const entrada = (
  parcelamentos: SalvarParcelamentosClienteInput["parcelamentos"],
): SalvarParcelamentosClienteInput => ({ clienteId: CLIENTE_ID, parcelamentos });

describe("SalvarParcelamentosCliente", () => {
  it("adiciona um Parcelamento: sobe o PDF e grava com o caminho enviado", async () => {
    const { caso, gravar, storage } = montar();

    const r = await caso.execute(
      entrada([{ codigo: " PARC-9 ", parcelasRestantes: 12, interno: true, arquivo: pdf() }]),
    );

    expect(r.ok).toBe(true);
    const [clienteId, itens] = gravar.mock.calls[0];
    expect(clienteId).toBe(CLIENTE_ID);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ codigo: "PARC-9", parcelasRestantes: 12, interno: true });
    expect(storage.enviados).toEqual([itens[0].arquivoCaminho]);
    expect(itens[0].arquivoCaminho).toBe(`${CLIENTE_ID}/${itens[0].id}-acordo.pdf`);
    expect(storage.removidos).toEqual([]);
  });

  it("código em branco é gerado pelo sistema; num existente, mantém o gravado", async () => {
    const existente = salvo();
    const { caso, gravar } = montar({ existentes: [existente] });

    const r = await caso.execute(
      entrada([
        { id: existente.id, codigo: "  ", parcelasRestantes: 4, interno: false },
        { codigo: "", parcelasRestantes: 2, interno: false, arquivo: pdf() },
      ]),
    );

    expect(r.ok).toBe(true);
    const itens = gravar.mock.calls[0][1];
    expect(itens[0].codigo).toBe(existente.codigo);
    expect(itens[1].codigo).toMatch(/^PARC-[0-9A-F]{8}$/);
  });

  it("grava os dados do acordo lidos do PDF do Parcelamento novo, revalidados", async () => {
    const { caso, gravar } = montar();

    await caso.execute(
      entrada([
        {
          codigo: "PGFN-1",
          parcelasRestantes: 5,
          interno: false,
          arquivo: pdf(),
          acordo: {
            origem: "pgfn",
            totalDeParcelas: 5,
            valorDaParcelaCentavos: -10,
            dataDeAdesao: "2026-01-27",
          },
        },
      ]),
    );

    expect(gravar.mock.calls[0][1][0].acordo).toEqual({
      origem: "pgfn",
      totalDeParcelas: 5,
      valorDaParcelaCentavos: null,
      dataDeAdesao: "2026-01-27",
    });
  });

  it.each([
    ["lider_setor", "simples_nacional", true],
    ["admin", "administrativo", true],
    ["funcionario", "financeiro", false],
    ["lider_setor", "financeiro", false],
  ])("%s do setor %s: permitido=%s", async (papel, setor, permitido) => {
    const { caso, gravar, storage } = montar({ ator: { id: "u", papel, setor } });

    const r = await caso.execute(
      entrada([{ codigo: "A", parcelasRestantes: 2, interno: false, arquivo: pdf() }]),
    );

    expect(r.ok).toBe(permitido);
    if (!permitido) {
      expect(!r.ok && r.error).toBeInstanceOf(ForbiddenError);
      expect(gravar).not.toHaveBeenCalled();
      expect(storage.enviados).toEqual([]);
    }
  });

  it("sem sessão é recusado", async () => {
    const { caso } = montar({ ator: null });
    const r = await caso.execute(entrada([]));
    expect(!r.ok && r.error).toBeInstanceOf(ForbiddenError);
  });

  it("recusa Regime sem Cadastro operacional SN", async () => {
    const { caso, gravar } = montar({ regime: "lucro_presumido" });
    const r = await caso.execute(
      entrada([{ codigo: "A", parcelasRestantes: 2, interno: false, arquivo: pdf() }]),
    );
    expect(!r.ok && r.error).toBeInstanceOf(ValidationError);
    expect(gravar).not.toHaveBeenCalled();
  });

  it.each([
    ["sem PDF", { codigo: "A", parcelasRestantes: 2, interno: false }],
    ["parcelas restantes 0", { codigo: "A", parcelasRestantes: 0, interno: false, arquivo: pdf() }],
    [
      "id desconhecido",
      {
        id: "99999999-9999-4999-8999-999999999999",
        codigo: "A",
        parcelasRestantes: 2,
        interno: false,
      },
    ],
  ])("recusa novo Parcelamento %s, sem subir arquivo nem gravar", async (_nome, item) => {
    const { caso, gravar, storage } = montar();
    const r = await caso.execute(entrada([item]));
    expect(!r.ok && r.error).toBeInstanceOf(ValidationError);
    expect(gravar).not.toHaveBeenCalled();
    expect(storage.enviados).toEqual([]);
  });

  it("recusa código repetido no mesmo Cliente", async () => {
    const { caso, gravar } = montar();
    const r = await caso.execute(
      entrada([
        { codigo: "A", parcelasRestantes: 2, interno: false, arquivo: pdf() },
        { codigo: "a ", parcelasRestantes: 3, interno: false, arquivo: pdf("b.pdf") },
      ]),
    );
    expect(!r.ok && r.error).toBeInstanceOf(ValidationError);
    expect(gravar).not.toHaveBeenCalled();
  });

  it("edita um existente mantendo o anexo gravado, sem subir arquivo", async () => {
    const existente = salvo();
    const { caso, gravar, storage } = montar({ existentes: [existente] });

    const r = await caso.execute(
      entrada([{ id: existente.id, codigo: "A-1", parcelasRestantes: 4, interno: true }]),
    );

    expect(r.ok).toBe(true);
    expect(gravar.mock.calls[0][1]).toEqual([
      {
        id: existente.id,
        codigo: "A-1",
        parcelasRestantes: 4,
        interno: true,
        arquivoCaminho: existente.arquivoCaminho,
      },
    ]);
    expect(storage.enviados).toEqual([]);
    expect(storage.removidos).toEqual([]);
  });

  it("Parcelamento quitado volta intacto, mesmo com valores diferentes na entrada", async () => {
    const quitado = salvo({ parcelasRestantes: 0, quitado: true });
    const { caso, gravar } = montar({ existentes: [quitado] });

    const r = await caso.execute(
      entrada([{ id: quitado.id, codigo: "OUTRO", parcelasRestantes: 7, interno: true }]),
    );

    expect(r.ok).toBe(true);
    expect(gravar.mock.calls[0][1][0]).toMatchObject({
      codigo: "A-1",
      parcelasRestantes: 0,
      interno: false,
    });
  });

  it("remover apaga o PDF do Parcelamento depois de gravar", async () => {
    const existente = salvo();
    const { caso, gravar, storage } = montar({ existentes: [existente] });

    const r = await caso.execute(entrada([]));

    expect(r.ok).toBe(true);
    expect(gravar.mock.calls[0][1]).toEqual([]);
    expect(storage.removidos).toEqual([existente.arquivoCaminho]);
  });

  it("falha ao gravar desfaz só os uploads novos e mantém o PDF do que seria removido", async () => {
    const existente = salvo();
    const { caso, gravar, storage } = montar({ existentes: [existente] });
    gravar.mockResolvedValue(
      err(new ValidationError("Parcelamento com guia enviada não pode ser removido.")),
    );

    const r = await caso.execute(
      entrada([{ codigo: "N-1", parcelasRestantes: 2, interno: false, arquivo: pdf() }]),
    );

    expect(!r.ok && r.error.message).toBe("Parcelamento com guia enviada não pode ser removido.");
    expect(storage.removidos).toEqual(storage.enviados);
    expect(storage.removidos).not.toContain(existente.arquivoCaminho);
  });

  describe("resposta incerta do banco ao gravar", () => {
    const novo = [{ codigo: "N-1", parcelasRestantes: 2, interno: false, arquivo: pdf() }];

    it("commit realizado: mantém o PDF, apaga só o do removido e devolve sucesso", async () => {
      const removido = salvo();
      const { caso, gravar, storage, listar } = montar({ existentes: [removido] });
      gravar.mockImplementation(async (_, itens) => {
        listar.mockResolvedValue(ok(itens.map((i) => salvo(i))));
        return err(new ResultadoIncertoError("504"));
      });

      const r = await caso.execute(entrada(novo));

      expect(r.ok).toBe(true);
      expect(storage.removidos).toEqual([removido.arquivoCaminho]);
      expect(storage.removidos).not.toContain(storage.enviados[0]);
    });

    it("ausente na leitura não prova rollback: mantém os uploads e devolve o erro", async () => {
      const existente = salvo();
      const { caso, gravar, storage } = montar({ existentes: [existente] });
      gravar.mockResolvedValue(err(new ResultadoIncertoError("504")));

      const r = await caso.execute(entrada([{ ...existente, ...novo[0], id: undefined }]));

      expect(r.ok).toBe(false);
      expect(storage.enviados).toHaveLength(1);
      expect(storage.removidos).toEqual([]);
    });

    it("commit tardio (depois da leitura): mantém o PDF do que acabou gravado", async () => {
      const existente = salvo();
      const { caso, gravar, storage, listar } = montar({ existentes: [existente] });
      // A leitura da reconciliação ainda não vê o commit, que conclui logo depois.
      gravar.mockImplementation(async (_, itens) => {
        listar.mockResolvedValueOnce(ok([existente]));
        queueMicrotask(() => listar.mockResolvedValue(ok(itens.map((i) => salvo(i)))));
        return err(new ResultadoIncertoError("504"));
      });

      const r = await caso.execute(entrada(novo));

      expect(r.ok).toBe(false);
      expect(storage.removidos).not.toContain(storage.enviados[0]);
    });

    it("leitura parcial (um dos uploads oculto): mantém todos os PDFs", async () => {
      const dois = [novo[0], { ...novo[0], codigo: "N-2" }];
      const { caso, gravar, storage, listar } = montar({ existentes: [] });
      gravar.mockImplementation(async (_, itens) => {
        listar.mockResolvedValue(ok([salvo(itens[0])]));
        return err(new ResultadoIncertoError("504"));
      });

      const r = await caso.execute(entrada(dois));

      expect(r.ok).toBe(false);
      expect(storage.removidos).toEqual([]);
    });

    it("não consegue reconciliar: mantém todos os PDFs", async () => {
      const existente = salvo();
      const { caso, gravar, storage, listar } = montar({ existentes: [existente] });
      gravar.mockImplementation(async () => {
        listar.mockResolvedValue(err(new ResultadoIncertoError("fora do ar")));
        return err(new ResultadoIncertoError("504"));
      });

      const r = await caso.execute(entrada(novo));

      expect(r.ok).toBe(false);
      expect(storage.removidos).toEqual([]);
    });
  });

  it("não apaga o PDF de um removido cujo caminho outro Parcelamento mantido referencia", async () => {
    const a = salvo();
    const b = salvo({ id: "22222222-2222-4222-8222-222222222222", codigo: "B-1" });
    const { caso, storage } = montar({
      existentes: [a, { ...b, arquivoCaminho: a.arquivoCaminho }],
    });

    const r = await caso.execute(
      entrada([{ id: a.id, codigo: "A-1", parcelasRestantes: 10, interno: false }]),
    );

    expect(r.ok).toBe(true);
    expect(storage.removidos).toEqual([]);
  });
});
