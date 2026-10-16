export type CadastroOperacionalRow = {
  forma_envio: string;
  documento_obrigatorio: string | null;
  das_status: string | null;
  data_envio_das: string | null;
  tem_parcelamento: boolean;
  parcelamento_status: string | null;
  observacoes_gerais: string;
  responsavel_id: string | null;
  responsavel: { nome: string } | null;
};

// PostgREST devolve embed 1:1 (FK também é PK, como cliente_cadastro_operacional_sn) ora como
// objeto, ora como array de 1 elemento, dependendo da versão/config do schema cache — normaliza os
// dois formatos aqui. Compartilhado entre cliente.mapper.ts e cliente-query.gateway.ts.
export function operacionalUnico(
  valor: CadastroOperacionalRow | CadastroOperacionalRow[] | null | undefined,
): CadastroOperacionalRow | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}
