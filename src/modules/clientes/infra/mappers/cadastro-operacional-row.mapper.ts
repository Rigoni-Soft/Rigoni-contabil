export type CadastroOperacionalRow = {
  forma_envio: string;
  documento_obrigatorio: string | null;
  das_status: string | null;
  data_envio_das: string | null;
  observacoes_gerais: string;
};

export type ResponsavelRow = { responsavel_id: string; responsavel: { nome: string } | null };

export function operacionalUnico<T = CadastroOperacionalRow>(
  valor: T | T[] | null | undefined,
): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}
