import type {
  AtendimentoRepositoryPort,
  ConversaLida,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { AtorSessaoDto } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
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
    { id: "m1", autor: "contato", texto: "oi", criadoEm: "2026-10-08T12:00:00Z", atendente: null },
    {
      id: "m2",
      autor: "funcionario",
      texto: "Enviou: Contrato social",
      criadoEm: "2026-10-08T12:01:00Z",
      atendente: { nome: "Ana", setor: "contabil" },
    },
  ],
  ultimaTransferencia: { setorOrigem: "recepcao", origemNome: "Ana", resumo: "Dúvida no DAS" },
  ura: { resumo: "Quer o contrato", cnpjInformado: null },
};
const FUNCIONARIO: AtorSessaoDto = { id: "func-1", papel: "funcionario", setor: "contabil" };

function montar(
  ator: AtorSessaoDto | null,
  conversa: ConversaLida | null | "falha" = CONVERSA,
  regime = "lucro_presumido",
) {
  const repo = {
    conversa: async () =>
      conversa === "falha" ? err(new ServicoExternoError("banco")) : ok(conversa),
    roteamentoDoCliente: async () => ok({ regime: regime, responsavelId: null }),
  } as unknown as AtendimentoRepositoryPort;
  const listados: string[] = [];
  const documentos = {
    listar: async (clienteId: string) => {
      listados.push(clienteId);
      return ok([
        { tipo: "contrato" as const, data: null, caminho: "a/contrato.pdf" },
        { tipo: "alteracao" as const, data: "2026-03-01", caminho: "a/alt.pdf" },
      ]);
    },
  } as unknown as DocumentosContratuaisPort;
  return {
    listados,
    caso: new ObterConversa({ usuarioAtual: async () => ator }, repo, documentos),
  };
}

describe("ObterConversa", () => {
  it("devolve a conversa com quem escreveu cada Mensagem e os serviços disponíveis, sem o caminho dos arquivos", async () => {
    const { caso, listados } = montar(FUNCIONARIO);
    const r = await caso.execute({ atendimentoId: "at-1" });
    expect(r).toEqual({
      ok: true,
      value: {
        atendimentoId: "at-1",
        encerrado: false,
        telefone: "5561988887777",
        contato: CONTATO,
        clienteVinculado: true,
        mensagens: CONVERSA.mensagens,
        ultimaTransferencia: CONVERSA.ultimaTransferencia,
        ura: CONVERSA.ura,
        documentos: [
          { tipo: "contrato", data: null, descricao: "Contrato social" },
          { tipo: "alteracao", data: "2026-03-01", descricao: "Alteração de 01/03/2026" },
        ],
        setoresDestino: expect.arrayContaining(["recepcao", "tributario"]),
      },
    });
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

  it("sem sessão nega, inexistente não é encontrado e falha de leitura devolve o erro", async () => {
    const semSessao = await montar(null).caso.execute({ atendimentoId: "at-1" });
    expect(!semSessao.ok && semSessao.error.code).toBe("FORBIDDEN");
    const inexistente = await montar(FUNCIONARIO, null).caso.execute({ atendimentoId: "x" });
    expect(!inexistente.ok && inexistente.error.code).toBe("NOT_FOUND");
    const falha = await montar(FUNCIONARIO, "falha").caso.execute({ atendimentoId: "at-1" });
    expect(falha.ok).toBe(false);
  });
});
