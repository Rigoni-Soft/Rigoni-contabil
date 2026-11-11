import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { ConvencaoDto } from "@/modules/rh/application/dtos/convencao.dto";
import type {
  ConvencaoRepository,
  NovaConvencao,
} from "@/modules/rh/application/ports/out/convencao.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import type { RegrasDaConvencao } from "@/shared/kernel/regras-da-convencao";
import { err, ok, type Result } from "@/shared/kernel/result";

type Linha = {
  id: string;
  sindicato: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  arquivo_nome: string;
  criado_em: string;
  regras: RegrasDaConvencao;
};

// O banco (RLS) é a última barreira: só o Líder do RH e o Admin inserem (42501 para os demais).
export class SupabaseConvencaoRepository implements ConvencaoRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async listar(clienteId: string): Promise<Result<ConvencaoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("rh_convencoes")
      .select("id, sindicato, vigencia_inicio, vigencia_fim, arquivo_nome, criado_em, regras")
      .eq("cliente_id", clienteId)
      .order("vigencia_inicio", { ascending: false })
      .order("criado_em", { ascending: false });
    if (error) return this.falhaDeLeitura(error);
    return ok(
      (data as Linha[]).map((l) => ({
        id: l.id,
        sindicato: l.sindicato,
        vigenciaInicio: l.vigencia_inicio,
        vigenciaFim: l.vigencia_fim,
        arquivoNome: l.arquivo_nome,
        enviadaEm: l.criado_em.slice(0, 10),
        regras: l.regras,
      })),
    );
  }

  async inserir(nova: NovaConvencao): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from("rh_convencoes").insert({
      cliente_id: nova.clienteId,
      sindicato: nova.sindicato,
      vigencia_inicio: nova.vigenciaInicio,
      vigencia_fim: nova.vigenciaFim,
      arquivo_caminho: nova.arquivoCaminho,
      arquivo_nome: nova.arquivoNome,
      regras: nova.regras,
    });
    if (!error) return ok(undefined);
    if (error.code === "42501") {
      return err(new ForbiddenError("Só o Líder do RH e o Admin enviam a convenção."));
    }
    if (error.code === "23514" || error.code === "22P02") {
      return err(new ValidationError("Dados da convenção inválidos."));
    }
    this.erros.registrar("Falha ao gravar a convenção do RH:", error.message);
    return err(new PersistenciaError("Não foi possível salvar a convenção. Tente novamente."));
  }

  private falhaDeLeitura(error: PostgrestError): Result<never, AppError> {
    this.erros.registrar("Falha ao ler as convenções do RH:", error.message);
    return err(new PersistenciaError("Não foi possível carregar as convenções."));
  }
}
