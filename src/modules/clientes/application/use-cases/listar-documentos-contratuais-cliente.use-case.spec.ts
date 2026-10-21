import type {
  DocumentoContratualClienteDto,
  DocumentosContratuaisClientePort,
} from "@/modules/clientes/application/ports/out/documentos-contratuais-cliente.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { AppError } from "@/shared/errors/app.error";
import { err, ok } from "@/shared/kernel/result";

import { ListarDocumentosContratuaisCliente } from "./listar-documentos-contratuais-cliente.use-case";

class ErroFalso extends AppError {
  readonly code = "FALSO";
}

const comSessao: SessaoPort = {
  usuarioAtual: async () => ({ id: "u1", papel: "lider_setor", setor: "simples_nacional" }),
};
const semSessao: SessaoPort = { usuarioAtual: async () => null };

function gatewayCom(documentos: DocumentoContratualClienteDto[]): DocumentosContratuaisClientePort {
  return {
    listar: async () => ok(documentos),
    linkTemporario: async () => ok("https://x"),
  };
}

describe("ListarDocumentosContratuaisCliente (#140)", () => {
  it("exige sessão", async () => {
    const resultado = await new ListarDocumentosContratuaisCliente(
      semSessao,
      gatewayCom([]),
    ).execute("c1");

    expect(resultado.ok).toBe(false);
  });

  it("devolve só {tipo, número, data}, na ordem do gateway", async () => {
    const documentos: DocumentoContratualClienteDto[] = [
      { tipo: "alteracao", numero: 3, data: "2025-03-05", caminho: "c1/alt/3.pdf" },
      { tipo: "contrato", numero: null, data: null, caminho: "c1/contrato-social/a.pdf" },
    ];

    const resultado = await new ListarDocumentosContratuaisCliente(
      comSessao,
      gatewayCom(documentos),
    ).execute("c1");

    expect(resultado).toEqual({
      ok: true,
      value: [
        { tipo: "alteracao", numero: 3, data: "2025-03-05" },
        { tipo: "contrato", numero: null, data: null },
      ],
    });
  });

  it("sem alteração, o único item é o contrato social", async () => {
    const resultado = await new ListarDocumentosContratuaisCliente(
      comSessao,
      gatewayCom([{ tipo: "contrato", numero: null, data: null, caminho: "c1/x.pdf" }]),
    ).execute("c1");

    expect(resultado).toEqual({
      ok: true,
      value: [{ tipo: "contrato", numero: null, data: null }],
    });
  });

  it("propaga a falha do gateway", async () => {
    const gateway: DocumentosContratuaisClientePort = {
      listar: async () => err(new ErroFalso("falhou")),
      linkTemporario: async () => ok("https://x"),
    };

    const resultado = await new ListarDocumentosContratuaisCliente(comSessao, gateway).execute(
      "c1",
    );

    expect(resultado.ok).toBe(false);
  });
});
