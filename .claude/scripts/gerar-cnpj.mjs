// Gera CNPJs numéricos válidos (módulo 11, o mesmo de src/shared/kernel/cnpj.ts) para roteiros de teste.
// Uso: node .claude/scripts/gerar-cnpj.mjs <n> [quantidade]   -> CNPJs de filial 0001 derivados de n
//      node .claude/scripts/gerar-cnpj.mjs --validar <cnpj>
// Os que o seed e os e2e já usam (ex.: 90.000.010/0001-10) não devem ser reaproveitados para cadastro novo.
const PESOS1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const dv = (base, pesos) => {
  const resto = [...base].reduce((s, c, i) => s + (c.charCodeAt(0) - 48) * pesos[i], 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
};
const completar = (doze) => {
  const d1 = dv(doze, PESOS1);
  return doze + d1 + dv(doze + d1, PESOS2);
};
const mascara = (c) => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;

const [a, b] = process.argv.slice(2);
if (a === "--validar") {
  const c = (b ?? "").replace(/\D/g, "");
  const ok = c.length === 14 && !/^(\d)\1{13}$/.test(c) && completar(c.slice(0, 12)) === c;
  console.log(ok ? "válido" : "inválido");
  process.exit(ok ? 0 : 1);
}
const n = Number(a);
if (!Number.isInteger(n) || n < 1) {
  console.error("uso: node .claude/scripts/gerar-cnpj.mjs <n> [quantidade] | --validar <cnpj>");
  process.exit(1);
}
for (let i = 0; i < Number(b ?? 1); i++) {
  const raiz = String(70_000_000 + n + i).padStart(8, "0"); // faixa 70.xxx.xxx, longe dos 90.000.0xx do seed
  const c = completar(raiz + "0001");
  console.log(`${mascara(c)}  (${c})`);
}
