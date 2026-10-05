import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  SessaoAtendimento,
  SessaoAtendimentoPort,
} from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const VALIDADE_MS = 10 * 60 * 1000;

type Linha = {
  etapa: string;
  modo: string | null;
  pagina: number | null;
  cliente_id: string | null;
};

function falha(acao: string): Result<never, AppError> {
  return err(new ServicoExternoError(`Falha ao ${acao} a sessão de atendimento.`));
}

// Usa o client service_role (docs/adr/0001). O telefone nunca vai ao banco em claro: a chave é
// um HMAC dele (número de telefone tem pouca entropia, então hash puro seria reversível).
export class SupabaseSessaoAtendimentoGateway implements SessaoAtendimentoPort {
  constructor(
    private readonly supabaseAdmin: SupabaseClient,
    private readonly segredo: string,
  ) {}

  async obter(telefone: string): Promise<Result<SessaoAtendimento | null, AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("atendimento_sessoes")
      .select("etapa, modo, pagina, cliente_id")
      .eq("chave", this.chave(telefone))
      .gt("atualizado_em", this.limite())
      .maybeSingle();
    if (error) return falha("consultar");
    const linha = data as Linha | null;
    if (!linha) return ok(null);
    if (linha.etapa === "alteracao") {
      return ok({
        etapa: "alteracao",
        modo: linha.modo as "alteracoes" | "ambos",
        pagina: linha.pagina as number,
      });
    }
    if (linha.etapa === "aceite_cadastro" || linha.etapa === "nome_cadastro") {
      return ok({ etapa: linha.etapa, clienteId: linha.cliente_id as string });
    }
    return ok({ etapa: linha.etapa as "ja_cliente" | "cnpj" | "tipo_documento" });
  }

  async salvar(telefone: string, sessao: SessaoAtendimento): Promise<Result<void, AppError>> {
    // Varre as expiradas de todos os números: sem job agendado, é a única limpeza.
    const varredura = await this.supabaseAdmin
      .from("atendimento_sessoes")
      .delete()
      .lt("atualizado_em", this.limite());
    if (varredura.error) return falha("gravar");

    const { error } = await this.supabaseAdmin.from("atendimento_sessoes").upsert({
      chave: this.chave(telefone),
      etapa: sessao.etapa,
      modo: sessao.etapa === "alteracao" ? sessao.modo : null,
      pagina: sessao.etapa === "alteracao" ? sessao.pagina : null,
      cliente_id: "clienteId" in sessao ? sessao.clienteId : null,
      atualizado_em: new Date().toISOString(),
    });
    return error ? falha("gravar") : ok(undefined);
  }

  async limpar(telefone: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabaseAdmin
      .from("atendimento_sessoes")
      .delete()
      .eq("chave", this.chave(telefone));
    return error ? falha("encerrar") : ok(undefined);
  }

  private chave(telefone: string): string {
    return createHmac("sha256", this.segredo).update(telefone).digest("hex");
  }

  private limite(): string {
    return new Date(Date.now() - VALIDADE_MS).toISOString();
  }
}
