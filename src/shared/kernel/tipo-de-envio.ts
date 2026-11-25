export const TIPO_TODOS_OS_ENVIOS = "todos";

export type TipoDeEnvio = "lembrete_documento" | "das" | "guia_parcelamento";

const ORDEM_DOS_TIPOS_DE_ENVIO = ["lembrete_documento", "das", "guia_parcelamento", "avisos"];

const posicaoDoTipo = (slug: string): number => {
  const posicao = ORDEM_DOS_TIPOS_DE_ENVIO.indexOf(slug);
  return posicao === -1 ? ORDEM_DOS_TIPOS_DE_ENVIO.length : posicao;
};

export const porOrdemDosTiposDeEnvio = <T extends { slug: string }>(tipos: T[]): T[] =>
  [...tipos].sort((a, b) => posicaoDoTipo(a.slug) - posicaoDoTipo(b.slug));
