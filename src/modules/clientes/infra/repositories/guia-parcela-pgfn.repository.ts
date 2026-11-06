import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
  ParcelamentoDaGuia,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { RegistroDeErrosPort } from "@/modules/clientes/application/ports/out/registro-de-erros.provider";
import type { GuiaParcelaPgfnProps } from "@/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo";
import { ConsoleRegistroDeErrosGateway } from "@/modules/clientes/infra/gateways/console-registro-de-erros.gateway";
import { AppError } from "@/shared/errors/app.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

// Sem resposta (status 0) ou gateway/timeout (502-504): o banco pode ter confirmado a gravação.
const semDesfechoConhecido = (status: number) => status === 0 || status >= 502;

type Tabela = ReturnType<SupabaseClient["from"]>;

type GuiaRow = {
  competencia: string;
  conta_negociacao: string;
  arquivo_caminho: string;
  estado: GuiaDaParcela["estado"];
  motivo: string | null;
};

export class SupabaseGuiaParcelaPgfnRepository implements GuiaParcelaPgfnRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort = new ConsoleRegistroDeErrosGateway(),
  ) {}

  async parcelamento(parcelamentoId: string): Promise<Result<ParcelamentoDaGuia | null, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamentos")
      .select("cliente_id, origem, codigo")
      .eq("id", parcelamentoId)
      .maybeSingle();
    if (error) {
      this.erros.registrar("Falha ao buscar o Parcelamento da guia:", error.message);
      return err(new PersistenciaError("Não foi possível carregar o Parcelamento."));
    }
    if (!data) return ok(null);
    // O CNPJ vem da view que quem edita o cadastro operacional pode ler (a tabela é só do Admin).
    const cliente = await this.supabase
      .from("clientes_basico")
      .select("cnpj")
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (cliente.error || !cliente.data) {
      this.erros.registrar("Falha ao buscar o Cliente da guia:", cliente.error?.message);
      return err(new PersistenciaError("Não foi possível carregar o Cliente do Parcelamento."));
    }
    return ok({
      clienteId: data.cliente_id,
      origem: data.origem,
      codigo: data.codigo,
      cnpj: cliente.data.cnpj,
    });
  }

  async listar(parcelamentoId: string): Promise<Result<GuiaDaParcela[], AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamento_guias")
      .select("competencia, conta_negociacao, arquivo_caminho, estado, motivo")
      .eq("parcelamento_id", parcelamentoId)
      .order("competencia", { ascending: false });
    if (error) {
      this.erros.registrar("Falha ao listar guias da parcela:", error.message);
      return err(new PersistenciaError("Não foi possível carregar as guias anexadas."));
    }
    const envios = await this.supabase
      .from("cliente_parcelamento_envios")
      .select("parcela")
      .eq("parcelamento_id", parcelamentoId);
    if (envios.error) {
      this.erros.registrar("Falha ao listar envios da parcela:", envios.error.message);
      return err(new PersistenciaError("Não foi possível carregar as guias anexadas."));
    }
    const enviadas = new Set(envios.data.map((e) => e.parcela));
    return ok(
      (data as GuiaRow[]).map((g) => ({
        competencia: g.competencia,
        contaNegociacao: g.conta_negociacao,
        versao: g.arquivo_caminho,
        estado: g.estado,
        motivo: g.motivo ?? undefined,
        enviada: enviadas.has(g.competencia),
      })),
    );
  }

  async anexar(
    parcelamentoId: string,
    guia: GuiaParcelaPgfnProps,
    motivo: string | null,
  ): Promise<Result<void, AppError>> {
    const { error, status } = await this.supabase.from("cliente_parcelamento_guias").insert({
      parcelamento_id: parcelamentoId,
      competencia: guia.competencia,
      conta_negociacao: guia.contaNegociacao,
      arquivo_caminho: guia.arquivoCaminho,
      motivo,
    });
    if (!error) return ok(undefined);

    this.erros.registrar("Falha ao anexar guia da parcela:", error.message);
    if (semDesfechoConhecido(status)) {
      return err(new ResultadoIncertoError("Não foi possível confirmar o anexo da guia."));
    }
    if (error.code === "23505") {
      return err(new PersistenciaError("Já existe guia anexada para esta competência."));
    }
    // Gatilhos do banco recusam com 23514 e mensagem em português, própria para o usuário.
    return err(
      new PersistenciaError(
        error.code === "23514" ? error.message : "Não foi possível anexar a guia. Tente novamente.",
      ),
    );
  }

  async confirmar(
    parcelamentoId: string,
    competencia: string,
    versao: string,
  ): Promise<Result<void, AppError>> {
    // `.select()` devolve as linhas atualizadas: RLS que esconde a guia não dá erro, dá zero linhas.
    const { data, error } = await this.supabase
      .from("cliente_parcelamento_guias")
      .update({ estado: "confirmada" })
      .eq("parcelamento_id", parcelamentoId)
      .eq("competencia", competencia)
      .eq("arquivo_caminho", versao)
      .select("competencia");
    if (error) {
      this.erros.registrar("Falha ao confirmar guia da parcela:", error.message);
      return err(
        new PersistenciaError(
          error.code === "23514"
            ? error.message
            : "Não foi possível confirmar a guia. Tente novamente.",
        ),
      );
    }
    if (data.length === 0) {
      return err(
        new NotFoundError("A guia mudou ou não existe mais. Atualize a página e confira."),
      );
    }
    return ok(undefined);
  }

  async arquivo(
    parcelamentoId: string,
    competencia: string,
  ): Promise<Result<string | null, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamento_guias")
      .select("arquivo_caminho")
      .eq("parcelamento_id", parcelamentoId)
      .eq("competencia", competencia)
      .maybeSingle();
    if (error) {
      this.erros.registrar("Falha ao buscar o PDF da guia da parcela:", error.message);
      return err(new PersistenciaError("Não foi possível carregar a guia."));
    }
    return ok(data?.arquivo_caminho ?? null);
  }

  async substituir(
    parcelamentoId: string,
    competencia: string,
    nova: Pick<GuiaParcelaPgfnProps, "contaNegociacao" | "arquivoCaminho">,
    motivo: string | null,
  ): Promise<Result<void, AppError>> {
    return this.mutar("trocar", parcelamentoId, competencia, (tabela) =>
      tabela.update({
        arquivo_caminho: nova.arquivoCaminho,
        conta_negociacao: nova.contaNegociacao,
        motivo,
      }),
    );
  }

  async remover(parcelamentoId: string, competencia: string): Promise<Result<void, AppError>> {
    return this.mutar("remover", parcelamentoId, competencia, (tabela) => tabela.delete());
  }

  // Troca e remoção da guia de uma competência. `.select()` devolve as linhas afetadas: RLS que esconde
  // a guia não dá erro, dá zero linhas. Sem desfecho conhecido o banco pode ter confirmado; gatilhos
  // recusam com 23514 e mensagem em português, própria para o usuário.
  private async mutar(
    acao: "trocar" | "remover",
    parcelamentoId: string,
    competencia: string,
    operar: (tabela: Tabela) => ReturnType<Tabela["update"]> | ReturnType<Tabela["delete"]>,
  ): Promise<Result<void, AppError>> {
    const { data, error, status } = await operar(this.supabase.from("cliente_parcelamento_guias"))
      .eq("parcelamento_id", parcelamentoId)
      .eq("competencia", competencia)
      .select("competencia");
    if (error) {
      this.erros.registrar(`Falha ao ${acao} a guia da parcela:`, error.message);
      if (semDesfechoConhecido(status)) {
        return err(new ResultadoIncertoError(`Não foi possível confirmar: ${acao} a guia.`));
      }
      return err(
        new PersistenciaError(
          error.code === "23514"
            ? error.message
            : `Não foi possível ${acao} a guia. Tente novamente.`,
        ),
      );
    }
    if (data.length === 0) {
      return err(new NotFoundError("Não encontramos esta guia. Atualize a página."));
    }
    return ok(undefined);
  }

  async gravada(
    parcelamentoId: string,
    competencia: string,
    arquivoCaminho: string,
  ): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamento_guias")
      .select("arquivo_caminho")
      .eq("parcelamento_id", parcelamentoId)
      .eq("competencia", competencia)
      .maybeSingle();
    if (error) return err(new PersistenciaError("Não foi possível conferir a guia anexada."));
    return ok(data?.arquivo_caminho === arquivoCaminho);
  }
}
