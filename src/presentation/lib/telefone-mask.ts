export function formatarTelefone(entrada: string): string {
  const digitos = entrada.replace(/\D/g, "").slice(0, 11);
  if (digitos.length === 0) return "";

  let resultado = `(${digitos.slice(0, 2)}`;
  if (digitos.length <= 2) return resultado;
  resultado += `) `;

  const restante = digitos.slice(2);
  const tamanhoDdd = digitos.length > 10 ? 5 : 4;
  resultado += restante.slice(0, tamanhoDdd);
  if (restante.length > tamanhoDdd) resultado += `-${restante.slice(tamanhoDdd)}`;
  return resultado;
}

export function telefoneParaExibicao(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return formatarTelefone(
    digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos,
  );
}
