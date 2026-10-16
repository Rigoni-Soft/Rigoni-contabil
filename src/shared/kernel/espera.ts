const doisDigitos = (n: number) => String(n).padStart(2, "0");

// Tempo de espera na Fila: mm:ss; a partir de 1h, h:mm:ss.
export function formatarEspera(milissegundos: number): string {
  const total = Math.max(0, Math.floor(milissegundos / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const mmss = `${doisDigitos(minutos)}:${doisDigitos(total % 60)}`;
  return horas > 0 ? `${horas}:${mmss}` : mmss;
}
