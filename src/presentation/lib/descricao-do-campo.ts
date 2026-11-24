export function descricaoDoCampo(
  ...ids: (string | false | null | undefined)[]
): string | undefined {
  const ligados = ids.filter(Boolean);
  return ligados.length > 0 ? ligados.join(" ") : undefined;
}
