import type {
  DocumentoContratualVisivelDto,
  ListarDocumentosContratuaisClientePort,
} from "@/modules/clientes/application/ports/in/documentos-contratuais-cliente.provider";
import type { DocumentosContratuaisClientePort } from "@/modules/clientes/application/ports/out/documentos-contratuais-cliente.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Último trecho do caminho; nas alterações, sem o prefixo "{nº}-" que o upload acrescenta.
function nomeDoArquivo(caminho: string, numero: number | null): string {
  const nome = caminho.split("/").pop() ?? caminho;
  return numero === null ? nome : nome.replace(`${numero}-`, "");
}

// Quem pode ver é decidido no banco (RLS/RPC, pode_ver_cliente + Setor SN): sem acesso a lista
// vem vazia. A ordem (alterações do maior nº para o menor, contrato por último) vem do RPC. Aqui só se
// exige sessão e se tira o caminho do que vai para a tela.
export class ListarDocumentosContratuaisCliente implements ListarDocumentosContratuaisClientePort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly documentos: DocumentosContratuaisClientePort,
  ) {}

  async execute(clienteId: string): Promise<Result<DocumentoContratualVisivelDto[], AppError>> {
    if (!(await this.sessao.usuarioAtual())) {
      return err(new ForbiddenError("Faça login para visualizar os documentos."));
    }
    const lista = await this.documentos.listar(clienteId);
    if (!lista.ok) return lista;
    return ok(
      lista.value.map(({ tipo, numero, data, caminho }) => ({
        tipo,
        numero,
        data,
        arquivo: nomeDoArquivo(caminho, numero),
      })),
    );
  }
}
