import type {
  DocumentoContratualClienteDto,
  DocumentosContratuaisClientePort,
} from "@/modules/clientes/application/ports/out/documentos-contratuais-cliente.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ObterLinkDocumentoContratual } from "./obter-link-documento-contratual.use-case";

const comSessao: SessaoPort = {
  usuarioAtual: async () => ({ id: "u1", papel: "funcionario", setor: "simples_nacional" }),
};
const semSessao: SessaoPort = { usuarioAtual: async () => null };

const DOCUMENTOS: DocumentoContratualClienteDto[] = [
  { tipo: "contrato", numero: null, data: null, caminho: "c1/contrato-social/a.pdf" },
  { tipo: "alteracao", numero: 2, data: "2024-06-01", caminho: "c1/alteracoes/2-b.pdf" },
];

function gateway(documentos = DOCUMENTOS) {
  const chamadas: { caminho: string; validade: number }[] = [];
  const porta: DocumentosContratuaisClientePort = {
    listar: async () => ok(documentos),
    linkTemporario: async (caminho, validade) => {
      chamadas.push({ caminho, validade });
      return ok(`https://storage/${caminho}`);
    },
  };
  return { porta, chamadas };
}

describe("ObterLinkDocumentoContratual (#140)", () => {
  it("gera o link da alteração pedida, com validade de 120 s, resolvendo o caminho no servidor", async () => {
    const { porta, chamadas } = gateway();

    const resultado = await new ObterLinkDocumentoContratual(comSessao, porta).execute({
      clienteId: "c1",
      tipo: "alteracao",
      numero: 2,
    });

    expect(resultado).toEqual({
      ok: true,
      value: { url: "https://storage/c1/alteracoes/2-b.pdf" },
    });
    expect(chamadas).toEqual([{ caminho: "c1/alteracoes/2-b.pdf", validade: 120 }]);
  });

  it("gera o link do contrato social", async () => {
    const { porta, chamadas } = gateway();

    const resultado = await new ObterLinkDocumentoContratual(comSessao, porta).execute({
      clienteId: "c1",
      tipo: "contrato",
      numero: null,
    });

    expect(resultado.ok).toBe(true);
    expect(chamadas[0].caminho).toBe("c1/contrato-social/a.pdf");
  });

  it("recusa sem sessão, sem tocar no storage", async () => {
    const { porta, chamadas } = gateway();

    const resultado = await new ObterLinkDocumentoContratual(semSessao, porta).execute({
      clienteId: "c1",
      tipo: "contrato",
      numero: null,
    });

    expect(resultado.ok).toBe(false);
    expect(chamadas).toEqual([]);
  });

  it("sem acesso (lista vazia) ou documento inexistente: não encontrado, sem link", async () => {
    const vazio = gateway([]);
    const inexistente = gateway();

    const semAcesso = await new ObterLinkDocumentoContratual(comSessao, vazio.porta).execute({
      clienteId: "c1",
      tipo: "contrato",
      numero: null,
    });
    const outroNumero = await new ObterLinkDocumentoContratual(
      comSessao,
      inexistente.porta,
    ).execute({ clienteId: "c1", tipo: "alteracao", numero: 9 });

    expect(semAcesso.ok).toBe(false);
    expect(outroNumero.ok).toBe(false);
    expect(vazio.chamadas).toEqual([]);
    expect(inexistente.chamadas).toEqual([]);
  });
});
