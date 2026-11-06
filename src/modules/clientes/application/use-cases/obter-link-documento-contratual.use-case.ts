import type {
  ObterLinkDocumentoContratualInput,
  ObterLinkDocumentoContratualPort,
} from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import type { DocumentosContratuaisClientePort } from "@/modules/clientes/application/ports/out/documentos-contratuais-cliente.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const VALIDADE_LINK_SEGUNDOS = 120;

// A tela pede {tipo, número}; o caminho nasce aqui, da lista que o banco liberou ao ator, então um
// caminho forjado nunca chega ao Storage. Sem acesso e inexistente são indistinguíveis de propósito.
export class ObterLinkDocumentoContratual implements ObterLinkDocumentoContratualPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly documentos: DocumentosContratuaisClientePort,
  ) {}

  async execute(
    entrada: ObterLinkDocumentoContratualInput,
  ): Promise<Result<{ url: string }, AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Faça login para abrir o documento."));
    }
    const lista = await this.documentos.listar(entrada.clienteId);
    if (!lista.ok) return lista;
    const documento = lista.value.find(
      (d) => d.tipo === entrada.tipo && d.numero === entrada.numero,
    );
    if (!documento) return err(new NotFoundError("Documento não encontrado."));
    const link = await this.documentos.linkTemporario(documento.caminho, VALIDADE_LINK_SEGUNDOS);
    return link.ok ? ok({ url: link.value }) : link;
  }
}
