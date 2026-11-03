import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CarteiraDoSetorQueryPort,
  ClienteDaCarteiraRow,
} from "@/modules/clientes/application/ports/out/carteira-do-setor.provider";
import type { ResponsavelRow } from "@/modules/clientes/infra/mappers/cadastro-operacional-row.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ConsultaError } from "@/shared/errors/consulta.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Igual ao `max_rows` do Supabase: página menor que isso é a última.
const TAMANHO_DA_PAGINA = 1000;

type ClienteComResponsavelRow = {
  id: string;
  empresa: string;
  cnpj: string;
  cliente_responsaveis: ResponsavelRow[] | null;
};

// View `clientes_basico`: o Setor lê os dados básicos da carteira; o vínculo do Responsável vem pela
// RLS de `cliente_responsaveis` (o Funcionário enxerga só o próprio, o Líder e o Admin todos).
export class SupabaseCarteiraDoSetorGateway implements CarteiraDoSetorQueryPort {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tamanhoDaPagina = TAMANHO_DA_PAGINA,
  ) {}

  async listar(setor: SetorSlug): Promise<Result<ClienteDaCarteiraRow[], AppError>> {
    // O PostgREST corta cada resposta em `max_rows` (1000): lê a carteira em páginas até esgotar.
    const linhas: ClienteComResponsavelRow[] = [];
    for (let de = 0; ; de += this.tamanhoDaPagina) {
      const { data, error } = await this.supabase
        .from("clientes_basico")
        .select(
          "id, empresa, cnpj, cliente_responsaveis(responsavel_id, responsavel:perfis!responsavel_id(nome))",
        )
        .eq("cliente_responsaveis.setor", setor)
        .order("empresa")
        .order("id")
        .range(de, de + this.tamanhoDaPagina - 1);
      if (error) return err(new ConsultaError(`Erro ao listar a carteira: ${error.message}`));
      const pagina = (data ?? []) as unknown as ClienteComResponsavelRow[];
      linhas.push(...pagina);
      if (pagina.length < this.tamanhoDaPagina) break;
    }

    return ok(
      linhas.map((linha) => ({
        clienteId: linha.id,
        empresa: linha.empresa,
        cnpj: linha.cnpj,
        responsavelId: linha.cliente_responsaveis?.[0]?.responsavel_id ?? null,
        responsavelNome: linha.cliente_responsaveis?.[0]?.responsavel?.nome ?? null,
      })),
    );
  }
}
