import type { AnexosAtendimentoPort } from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type {
  AtendimentoRepositoryPort,
  ConversaLida,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import type { RegimeValor } from "@/shared/kernel/regimes";
import { err, ok } from "@/shared/kernel/result";

import { ObterConversa } from "./obter-conversa.use-case";

const CONTATO = { contatoNome: "Maria", empresa: "Padaria Ltda", cnpj: "11444777000161" };
const CONVERSA: ConversaLida = {
  id: "at-1",
  status: "em_andamento",
  setor: "contabil",
  funcionarioId: "func-1",
  clienteId: "cli-1",
  telefone: "5561988887777",
  contato: CONTATO,
  mensagens: [
    {
      id: "m1",
      autor: "contato",
      texto: "oi",
      criadoEm: "2026-10-08T12:00:00Z",
      atendente: null,
      idExterno: "wamid.1",
      reacao: "👍",
      entrega: "entregue",
      anexo: null,
    },
    {
      id: "m2",
      autor: "funcionario",
      texto: "Enviou: Contrato social",
      criadoEm: "2026-10-08T12:01:00Z",
      atendente: { nome: "Ana", setor: "contabil" },
      idExterno: null,
      reacao: null,
      entrega: "entregue",
      anexo: null,
    },
  ],
  temMaisAntigas: false,
  ultimaTransferencia: { setorOrigem: "recepcao", origemNome: "Ana", resumo: "Dúvida no DAS" },
  ura: { resumo: "Quer o contrato", cnpjInformado: null },
};
const COM_ANEXO: ConversaLida = {
  ...CONVERSA,
  mensagens: [
    ...CONVERSA.mensagens,
    {
      id: "m3",
      autor: "funcionario",
      texto: "Segue",
      criadoEm: "2026-10-08T12:02:00Z",
      atendente: { nome: "Ana", setor: "contabil" },
      idExterno: null,
      reacao: null,
      entrega: "entregue",
      anexo: {
        tipo: "imagem",
        nome: "foto.png",
        tamanho: 10,
        caminho: "at-1/u/foto.png",
        miniaturaCaminho: "at-1/u/miniatura.webp",
      },
    },
  ],
};
const FUNCIONARIO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };

// Fake parcial de uma porta: só os métodos que o caso de uso chama neste teste.
const fake = <T>(parcial: Partial<T>) => parcial as T;

function montar(
  ator: AtorSessaoDto | null,
  conversa: ConversaLida | null | "falha" = CONVERSA,
  regime: RegimeValor = "lucro_presumido",
) {
  const chamadasAnteriores: { antes: { id: string }; limite: number }[] = [];
  const pedidosPorId: string[][] = [];
  const repo = fake<AtendimentoRepositoryPort>({
    conversa: async () =>
      conversa === "falha" ? err(new ServicoExternoError("banco")) : ok(conversa),
    roteamentoDoCliente: async () => ok({ regime: regime, responsavelId: null }),
    mensagensPorId: async (_id: string, ids: string[]) => {
      pedidosPorId.push(ids);
      return ok({
        setor: "contabil" as const,
        funcionarioId: "func-1",
        mensagens: COM_ANEXO.mensagens.filter((m) => ids.includes(m.id)),
      });
    },
    mensagensAnteriores: async (_id: string, antes: { id: string }, limite: number) => {
      chamadasAnteriores.push({ antes, limite });
      return ok({
        setor: "contabil" as const,
        funcionarioId: "func-1",
        mensagens: CONVERSA.mensagens.slice(0, 1),
        temMaisAntigas: true,
      });
    },
  });
  const listados: string[] = [];
  const documentos = fake<DocumentosContratuaisPort>({
    listar: async (clienteId: string) => {
      listados.push(clienteId);
      return ok([
        { tipo: "contrato" as const, numero: null, data: null, caminho: "a/contrato.pdf" },
        { tipo: "alteracao" as const, numero: 3, data: "2026-03-01", caminho: "a/alt.pdf" },
        { tipo: "alteracao" as const, numero: 2, data: "2026-05-10", caminho: "a/alt-2.pdf" },
      ]);
    },
  });
  const pedidos: string[][] = [];
  const anexos = fake<AnexosAtendimentoPort>({
    linksTemporarios: async (caminhos: string[]) => {
      pedidos.push(caminhos);
      return ok(
        Object.fromEntries(
          caminhos.map((c) => [
            c,
            {
              url: `https://link/${c}`,
              urlVisualizacao: `https://link/${c}?ver`,
              expiraEm: "2026-10-08T13:00:00Z",
            },
          ]),
        ),
      );
    },
  });
  return {
    listados,
    pedidos,
    chamadasAnteriores,
    pedidosPorId,
    caso: new ObterConversa({ usuarioAtual: async () => ator }, repo, documentos, anexos),
  };
}

// O mesmo caso de uso, com o Storage trocável para o teste de falha dos links.
function montarComFalhaDeLinks() {
  const anexos = fake<AnexosAtendimentoPort>({ linksTemporarios: async () => ok({}) });
  const repo = fake<AtendimentoRepositoryPort>({
    conversa: async () => ok(COM_ANEXO),
    roteamentoDoCliente: async () => ok({ regime: "lucro_presumido", responsavelId: null }),
    mensagensPorId: async () =>
      ok({ setor: "contabil" as const, funcionarioId: "func-1", mensagens: COM_ANEXO.mensagens }),
  });
  const documentos = fake<DocumentosContratuaisPort>({ listar: async () => ok([]) });
  return {
    anexos,
    caso: new ObterConversa({ usuarioAtual: async () => FUNCIONARIO }, repo, documentos, anexos),
  };
}

const ANTES = { criadoEm: "2026-10-08T12:00:00+00:00", id: "m1" };

describe("ObterConversa", () => {
  it("diz que há histórico antes da janela", async () => {
    const { caso } = montar(FUNCIONARIO, { ...CONVERSA, temMaisAntigas: true });
    const r = await caso.execute({ atendimentoId: "at-1" });
    expect(r.ok && r.value.temMaisAnteriores).toBe(true);
  });

  describe("mensagensAnteriores", () => {
    it("devolve a página anterior ao cursor, na janela, para quem pode ver o Atendimento", async () => {
      const { caso, chamadasAnteriores } = montar(FUNCIONARIO);

      const r = await caso.mensagensAnteriores({ atendimentoId: "at-1", antes: ANTES });

      expect(chamadasAnteriores).toEqual([{ antes: ANTES, limite: 100 }]);
      expect(r.ok && r.value.temMaisAnteriores).toBe(true);
      expect(r.ok && r.value.mensagens.map((m) => m.id)).toEqual(["m1"]);
    });

    it("outro Funcionário não vê o histórico", async () => {
      const { caso } = montar({ id: "func-2", papel: "funcionario", setor: "contabil" });

      const r = await caso.mensagensAnteriores({ atendimentoId: "at-1", antes: ANTES });

      expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    });

    it("sem sessão é recusado", async () => {
      const { caso } = montar(null);

      const r = await caso.mensagensAnteriores({ atendimentoId: "at-1", antes: ANTES });

      expect(r.ok).toBe(false);
    });
  });

  it("pede os links dos anexos em lote e devolve o anexo sem o caminho", async () => {
    const { caso, pedidos } = montar(FUNCIONARIO, COM_ANEXO);

    const r = await caso.execute({ atendimentoId: "at-1" });

    expect(pedidos).toEqual([["at-1/u/foto.png", "at-1/u/miniatura.webp"]]);
    expect(r.ok && r.value.mensagens.map((m) => m.anexo)).toEqual([
      null,
      null,
      {
        tipo: "imagem",
        nome: "foto.png",
        tamanho: 10,
        url: "https://link/at-1/u/foto.png",
        urlVisualizacao: "https://link/at-1/u/foto.png?ver",
        miniaturaUrl: "https://link/at-1/u/miniatura.webp",
        expiraEm: "2026-10-08T13:00:00Z",
      },
    ]);
  });

  it("falha ao gerar os links não derruba a leitura: o texto vem e o anexo aparece sem arquivo", async () => {
    const { caso, anexos } = montarComFalhaDeLinks();
    anexos.linksTemporarios = async () => err(new ServicoExternoError("storage"));

    const r = await caso.execute({ atendimentoId: "at-1" });

    expect(r.ok).toBe(true);
    expect(r.ok && r.value.mensagens.map((m) => m.anexo)).toEqual([null, null, null]);
    expect(r.ok && r.value.mensagens.map((m) => m.texto)).toEqual(
      COM_ANEXO.mensagens.map((m) => m.texto),
    );
  });

  it("sem anexo na conversa não consulta o Storage", async () => {
    const { caso, pedidos } = montar(FUNCIONARIO);
    await caso.execute({ atendimentoId: "at-1" });
    expect(pedidos).toEqual([]);
  });

  it("devolve a conversa com quem escreveu cada Mensagem e os serviços disponíveis, sem o caminho dos arquivos", async () => {
    const { caso, listados } = montar(FUNCIONARIO);
    const r = await caso.execute({ atendimentoId: "at-1" });
    expect(r).toEqual({
      ok: true,
      value: {
        atendimentoId: "at-1",
        encerrado: false,
        podeAtender: true,
        telefone: "5561988887777",
        contato: CONTATO,
        clienteVinculado: true,
        // O id do provedor não vai à tela: só se a Mensagem do cliente aceita reação.
        mensagens: [
          expect.objectContaining({ reagivel: true }),
          expect.objectContaining({ reagivel: false }),
        ],
        temMaisAnteriores: false,
        ultimaTransferencia: CONVERSA.ultimaTransferencia,
        ura: CONVERSA.ura,
        documentos: [
          { tipo: "contrato", numero: null, descricao: "Contrato social" },
          {
            tipo: "alteracao",
            numero: 3,
            descricao: "Alteração nº 3 - 01/03/2026",
          },
          {
            tipo: "alteracao",
            numero: 2,
            descricao: "Alteração nº 2 - 10/05/2026",
          },
        ],
        setoresDestino: expect.arrayContaining(["recepcao", "tributario"]),
      },
    });
    expect(r.ok && r.value.mensagens.some((m) => "idExterno" in m)).toBe(false);
    expect(r.ok && r.value.setoresDestino).not.toContain("contabil");
    expect(r.ok && r.value.setoresDestino).not.toContain("simples_nacional");
    expect(listados).toEqual(["cli-1"]);
  });

  it("sem Cliente vinculado ou encerrado não oferece serviços e nem consulta os documentos", async () => {
    const semCliente = montar(FUNCIONARIO, { ...CONVERSA, clienteId: null });
    const a = await semCliente.caso.execute({ atendimentoId: "at-1" });
    expect(a.ok && a.value.clienteVinculado).toBe(false);
    expect(a.ok && a.value.documentos).toEqual([]);

    const encerrado = montar(FUNCIONARIO, { ...CONVERSA, status: "encerrado" });
    const b = await encerrado.caso.execute({ atendimentoId: "at-1" });
    expect(b.ok && b.value.encerrado).toBe(true);
    expect(b.ok && b.value.documentos).toEqual([]);
    expect([...semCliente.listados, ...encerrado.listados]).toEqual([]);
  });

  it("oferece o Simples Nacional como destino só para Cliente do Simples Nacional ou MEI", async () => {
    const mei = await montar(FUNCIONARIO, CONVERSA, "mei").caso.execute({ atendimentoId: "at-1" });
    expect(mei.ok && mei.value.setoresDestino).toContain("simples_nacional");
  });

  it("encerrado não oferece destinos", async () => {
    const r = await montar(FUNCIONARIO, { ...CONVERSA, status: "encerrado" }).caso.execute({
      atendimentoId: "at-1",
    });
    expect(r.ok && r.value.setoresDestino).toEqual([]);
  });

  it("só o dono, o Líder do Setor e o Admin leem; outro Funcionário e outro Líder não", async () => {
    const outro = await montar({ ...FUNCIONARIO, id: "func-2" }).caso.execute({
      atendimentoId: "at-1",
    });
    expect(!outro.ok && outro.error.code).toBe("FORBIDDEN");
    const liderOutroSetor = await montar({
      id: "l",
      papel: "lider_setor",
      setor: "rh",
    }).caso.execute({
      atendimentoId: "at-1",
    });
    expect(!liderOutroSetor.ok && liderOutroSetor.error.code).toBe("FORBIDDEN");
    const lider = await montar({ id: "l", papel: "lider_setor", setor: "contabil" }).caso.execute({
      atendimentoId: "at-1",
    });
    expect(lider.ok).toBe(true);
    const admin = await montar({ id: "a", papel: "admin", setor: "administrativo" }).caso.execute({
      atendimentoId: "at-1",
    });
    expect(admin.ok).toBe(true);
  });

  it("Líder do Setor e Admin leem em supervisão: sem atender, sem serviços nem destinos", async () => {
    for (const ator of [
      { id: "l", papel: "lider_setor" as const, setor: "contabil" as const },
      { id: "a", papel: "admin" as const, setor: "administrativo" as const },
    ]) {
      const r = await montar(ator).caso.execute({ atendimentoId: "at-1" });
      expect(r.ok && r.value).toMatchObject({
        podeAtender: false,
        documentos: [],
        setoresDestino: [],
      });
    }
  });

  it("sem sessão nega, inexistente não é encontrado e falha de leitura devolve o erro", async () => {
    const semSessao = await montar(null).caso.execute({ atendimentoId: "at-1" });
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    const inexistente = await montar(FUNCIONARIO, null).caso.execute({ atendimentoId: "x" });
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");
    const falha = await montar(FUNCIONARIO, "falha").caso.execute({ atendimentoId: "at-1" });
    expect(falha.ok).toBe(false);
  });
});

describe("ObterConversa.renovarLinks", () => {
  it("gera links novos só para as Mensagens pedidas que têm anexo, sem o caminho", async () => {
    const { caso, pedidos } = montar(FUNCIONARIO, COM_ANEXO);

    const r = await caso.renovarLinks({ atendimentoId: "at-1", mensagemIds: ["m1", "m3"] });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((m) => m.id)).toEqual(["m3"]);
    expect(r.value[0].anexo).toMatchObject({
      url: "https://link/at-1/u/foto.png",
      miniaturaUrl: "https://link/at-1/u/miniatura.webp",
      expiraEm: "2026-10-08T13:00:00Z",
    });
    expect(JSON.stringify(r.value)).not.toContain("caminho");
    expect(pedidos).toHaveLength(1);
  });

  it("passa de novo pela autorização: outro Funcionário, outro Setor e sem sessão não renovam", async () => {
    const pedido = { atendimentoId: "at-1", mensagemIds: ["m3"] };
    const outro = await montar({ ...FUNCIONARIO, id: "func-2" }).caso.renovarLinks(pedido);
    expect(!outro.ok && outro.error.code).toBe("FORBIDDEN");
    const outroSetor = await montar({
      id: "l",
      papel: "lider_setor",
      setor: "rh",
    }).caso.renovarLinks(pedido);
    expect(!outroSetor.ok && outroSetor.error.code).toBe("FORBIDDEN");
    const semSessao = await montar(null).caso.renovarLinks(pedido);
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
  });

  it("mudança de autorização depois de carregar (dono perdeu o Atendimento): recusa", async () => {
    const transferido = montar({ ...FUNCIONARIO, id: "func-antigo" });
    const r = await transferido.caso.renovarLinks({ atendimentoId: "at-1", mensagemIds: ["m3"] });
    expect(!r.ok && r.error.code).toBe("FORBIDDEN");
    expect(transferido.pedidos).toEqual([]);
  });

  it("corta o pedido no limite e objeto ausente devolve a Mensagem sem anexo (o cliente mantém o link)", async () => {
    const muitos = Array.from({ length: 80 }, (_, i) => `id-${i}`);
    const { caso, pedidosPorId } = montar(FUNCIONARIO, COM_ANEXO);
    await caso.renovarLinks({ atendimentoId: "at-1", mensagemIds: muitos });
    expect(pedidosPorId[0]).toHaveLength(50);

    const { caso: semObjeto } = montarComFalhaDeLinks();
    const r = await semObjeto.renovarLinks({ atendimentoId: "at-1", mensagemIds: ["m3"] });
    expect(r.ok && r.value[0]?.anexo).toBeNull();
  });
});
