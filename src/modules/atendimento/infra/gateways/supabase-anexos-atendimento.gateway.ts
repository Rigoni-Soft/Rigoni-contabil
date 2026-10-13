import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AnexosAtendimentoPort,
  ArquivoAnexo,
  LinkTemporario,
} from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const BUCKET = "anexos-atendimento";
// Vale para a tela do Funcionário (que busca os links a cada leitura da conversa) e para o provedor
// buscar o arquivo ao enviar.
const VALIDADE_LINK_SEGUNDOS = 3600;

// Só o que o Storage aceita em um caminho (sem acento nem espaço). O nome original fica na Mensagem
// e no envio ao provedor; o arquivo baixado pelo link leva este nome.
function nomeSeguro(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\w.-]+/g, "_")
      .slice(-120) || "arquivo"
  );
}

// Usa o client service_role (docs/adr/0001), como o gateway de documentos contratuais. O bucket
// é privado e sem policy: o arquivo só sai por link temporário.
export class SupabaseAnexosAtendimentoGateway implements AnexosAtendimentoPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async guardar({
    atendimentoId,
    arquivo,
  }: {
    atendimentoId: string;
    arquivo: ArquivoAnexo;
  }): Promise<Result<string, AppError>> {
    // Uma pasta por envio: o link com `download` entrega o arquivo com o nome original.
    const caminho = `${atendimentoId}/${randomUUID()}/${nomeSeguro(arquivo.nome)}`;
    const { error } = await this.supabaseAdmin.storage
      .from(BUCKET)
      .upload(caminho, arquivo.conteudo, { contentType: arquivo.tipoMime });
    if (error) return err(new ServicoExternoError("Falha ao guardar o arquivo."));
    return ok(caminho);
  }

  async linksTemporarios(
    caminhos: string[],
  ): Promise<Result<Record<string, LinkTemporario>, AppError>> {
    const { data, error } = await this.supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrls(caminhos, VALIDADE_LINK_SEGUNDOS, { download: true });
    if (error || !data) return err(new ServicoExternoError("Falha ao gerar o link do arquivo."));
    const expiraEm = new Date(Date.now() + VALIDADE_LINK_SEGUNDOS * 1000).toISOString();
    const links: Record<string, LinkTemporario> = {};
    for (const item of data) {
      if (item.error || !item.signedUrl || !item.path) {
        return err(new ServicoExternoError("Falha ao gerar o link do arquivo."));
      }
      links[item.path] = { url: item.signedUrl, expiraEm };
    }
    return ok(links);
  }

  async remover(caminho: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.storage.from(BUCKET).remove([caminho]);
    if (error) return err(new ServicoExternoError("Falha ao remover o arquivo."));
    return ok(undefined);
  }
}
