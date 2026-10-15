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
      // Um anexo sem link aparece sem arquivo na conversa; os demais, e o texto, continuam.
      if (item.error || !item.signedUrl || !item.path) continue;
      // O token assina só o caminho: sem `download` o mesmo endereço serve o arquivo para ver.
      const visualizacao = new URL(item.signedUrl);
      visualizacao.searchParams.delete("download");
      links[item.path] = {
        url: item.signedUrl,
        urlVisualizacao: visualizacao.toString(),
        expiraEm,
      };
    }
    return ok(links);
  }

  async remover(caminho: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.storage.from(BUCKET).remove([caminho]);
    if (error) return err(new ServicoExternoError("Falha ao remover o arquivo."));
    return ok(undefined);
  }

  async reservar(caminho: string, atendimentoId: string): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("reservar_anexo_para_envio", {
      p_caminho: caminho,
      p_atendimento_id: atendimentoId,
    });
    if (error || (data !== "reservado" && data !== "em_uso")) {
      return err(new ServicoExternoError("Falha ao reservar o arquivo para envio."));
    }
    return ok(data === "reservado");
  }

  async liberarReserva(caminho: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin.rpc("liberar_anexo_em_envio", {
      p_caminho: caminho,
    });
    if (error) return err(new ServicoExternoError("Falha ao liberar a reserva do arquivo."));
    return ok(undefined);
  }

  async inspecionar(
    caminho: string,
  ): Promise<Result<{ tipoMime: string; tamanho: number } | null, AppError>> {
    const { data, error } = await this.supabaseAdmin.storage.from(BUCKET).info(caminho);
    // Objeto inexistente: o Storage responde erro, sem distinguir de falha de rede; os dois viram
    // "não chegou", e quem chama pede o envio de novo.
    if (error || !data) return ok(null);
    return ok({ tipoMime: data.contentType ?? "", tamanho: data.size ?? 0 });
  }

  async cabecalho(caminho: string, bytes: number): Promise<Result<Uint8Array, AppError>> {
    const links = await this.linksTemporarios([caminho]);
    if (!links.ok) return links;
    const link = links.value[caminho];
    if (!link) return err(new ServicoExternoError("Falha ao ler o arquivo guardado."));
    try {
      const resposta = await fetch(link.url, {
        headers: { Range: `bytes=0-${bytes - 1}` },
      });
      if (!resposta.ok) throw new Error();
      return ok(new Uint8Array(await resposta.arrayBuffer()).subarray(0, bytes));
    } catch {
      return err(new ServicoExternoError("Falha ao ler o arquivo guardado."));
    }
  }

  async baixar(caminho: string): Promise<Result<Uint8Array, AppError>> {
    const { data, error } = await this.supabaseAdmin.storage.from(BUCKET).download(caminho);
    if (error || !data) return err(new ServicoExternoError("Falha ao ler o arquivo guardado."));
    return ok(new Uint8Array(await data.arrayBuffer()));
  }
}
