import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  SessaoAtendimento,
  SessaoAtendimentoPort,
} from "@/modules/atendimento/application/ports/out/sessao-atendimento.provider";
import { sessaoAtendimentoRowSchema } from "@/modules/atendimento/infra/dtos/sessao-atendimento-row.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const VALIDADE_MS = 10 * 60 * 1000;

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
      .select("etapa, modo, pagina, lista, invalidos")
      .eq("chave", this.chave(telefone))
      .gt("atualizado_em", this.limite())
      .maybeSingle();
    if (error) return falha("consultar");
    if (!data) return ok(null);
    const linha = sessaoAtendimentoRowSchema.safeParse(data);
    return linha.success ? ok(linha.data) : falha("consultar");
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
      lista: sessao.etapa === "alteracao" ? sessao.lista : null,
      invalidos: "invalidos" in sessao ? sessao.invalidos : 0,
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
