import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CarteiraDoSetorQueryPort,
  ClienteDaCarteiraRow,
} from "@/modules/clientes/application/ports/out/carteira-do-setor.provider";
import type { ResponsavelRow } from "@/modules/clientes/infra/mappers/cadastro-operacional-row.mapper";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

class ConsultaError extends AppError {
  readonly code = "CONSULTA_ERROR";
}

type ClienteComResponsavelRow = {
  id: string;
  empresa: string;
  cnpj: string;
  cliente_responsaveis: ResponsavelRow[] | null;
};

// View `clientes_basico`: o Setor lê os dados básicos da carteira; o vínculo do Responsável vem pela
// RLS de `cliente_responsaveis` (o Funcionário enxerga só o próprio, o Líder e o Admin todos).
export class SupabaseCarteiraDoSetorGateway implements CarteiraDoSetorQueryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(setor: SetorSlug): Promise<Result<ClienteDaCarteiraRow[], AppError>> {
    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select(
        "id, empresa, cnpj, cliente_responsaveis(responsavel_id, responsavel:perfis!responsavel_id(nome))",
      )
      .eq("cliente_responsaveis.setor", setor)
      .order("empresa");
    if (error) return err(new ConsultaError(`Erro ao listar a carteira: ${error.message}`));

    return ok(
      ((data ?? []) as unknown as ClienteComResponsavelRow[]).map((linha) => ({
        clienteId: linha.id,
        empresa: linha.empresa,
        cnpj: linha.cnpj,
        responsavelId: linha.cliente_responsaveis?.[0]?.responsavel_id ?? null,
        responsavelNome: linha.cliente_responsaveis?.[0]?.responsavel?.nome ?? null,
      })),
    );
  }
}
