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

// Pedido por página; o servidor pode devolver menos (`max_rows`), então o laço avança pelo que veio.
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
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(setor: SetorSlug): Promise<Result<ClienteDaCarteiraRow[], AppError>> {
    // O PostgREST corta cada resposta em `max_rows`: lê a carteira em páginas até vir uma vazia,
    // sem depender de o servidor honrar o tamanho pedido. Uma página que repete a anterior (o
    // servidor ignorou o `range`) aborta em vez de girar sem fim.
    const linhas: ClienteComResponsavelRow[] = [];
    let primeiroDaAnterior: string | undefined;
    for (let de = 0; ; de = linhas.length) {
      const { data, error } = await this.supabase
        .from("clientes_basico")
        .select(
          "id, empresa, cnpj, cliente_responsaveis(responsavel_id, responsavel:perfis!responsavel_id(nome))",
        )
        .eq("cliente_responsaveis.setor", setor)
        .order("empresa")
        .order("id")
        .range(de, de + TAMANHO_DA_PAGINA - 1);
      if (error) return err(new ConsultaError(`Erro ao listar a carteira: ${error.message}`));
      // Cast único: o select com relação embutida não é inferido sem os tipos gerados do banco.
      const pagina = (data ?? []) as unknown as ClienteComResponsavelRow[];
      if (pagina.length === 0) break;
      if (pagina[0].id === primeiroDaAnterior) {
        return err(new ConsultaError("Erro ao listar a carteira: a paginação não avançou."));
      }
      primeiroDaAnterior = pagina[0].id;
      linhas.push(...pagina);
    }

    // `.eq("cliente_responsaveis.setor", setor)` deixa no máximo um vínculo por Cliente (um
    // Responsável por Setor), por isso basta o primeiro.
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
