import {
  canalPerdidoDoDestino,
  FORMA_ENVIO_LABEL,
  FORMAS_ENVIO,
  temOsDoisCanais,
  type FormaEnvioValor,
} from "@/shared/kernel/forma-envio";
import { TIPO_TODOS_OS_ENVIOS } from "@/shared/kernel/tipo-de-envio";

import { contatoDoSetor, type ContatoDaLinha } from "./contato-da-linha.presenter";

export type DestinoSalvo = { contatoId: string; tipo: string | null; canal: string };
export type OpcaoDeTipoDeEnvio = { slug: string; rotulo: string };

export const OPCOES_DE_CANAL = FORMAS_ENVIO.map((valor) => ({
  valor,
  rotulo: FORMA_ENVIO_LABEL[valor],
}));

export function canalDoContato(
  destinos: DestinoSalvo[],
  contato: Pick<ContatoDaLinha, "id" | "telefone" | "email">,
): string {
  if (!temOsDoisCanais(contato)) return "";
  return destinos.find((d) => d.contatoId === contato.id)?.canal ?? "";
}

const ROTULO_TODOS_OS_ENVIOS = "Todos os envios";

export function opcoesDeTipos(tipos: OpcaoDeTipoDeEnvio[]) {
  return [
    { valor: TIPO_TODOS_OS_ENVIOS, rotulo: ROTULO_TODOS_OS_ENVIOS },
    ...tipos.map((t) => ({ valor: t.slug, rotulo: t.rotulo })),
  ];
}

export function tiposDoContato(destinos: DestinoSalvo[], contatoId: string | undefined): string[] {
  return destinos
    .filter((d) => d.contatoId === contatoId)
    .map((d) => d.tipo ?? TIPO_TODOS_OS_ENVIOS);
}

const CANAL_PERDIDO = { whatsapp: "o WhatsApp", email: "o e-mail" } as const;

export function avisoDeCanalPerdido(
  destinos: DestinoSalvo[],
  contato: Pick<ContatoDaLinha, "id" | "telefone" | "email">,
): string | undefined {
  const perdido = destinos
    .filter((d) => d.contatoId === contato.id)
    .map((d) => canalPerdidoDoDestino(d.canal as FormaEnvioValor, contato))
    .find(Boolean);
  return perdido
    ? `O contato deixou de ter ${CANAL_PERDIDO[perdido]}: os envios deste Setor não saem por ele. Informe de novo ou desmarque os envios.`
    : undefined;
}

export function tiposAposAlternar(marcados: string[], valor: string, opcoes: string[]): string[] {
  const outros = opcoes.filter((o) => o !== TIPO_TODOS_OS_ENVIOS);
  if (valor === TIPO_TODOS_OS_ENVIOS) {
    return marcados.includes(valor) ? [] : [TIPO_TODOS_OS_ENVIOS, ...outros];
  }
  const outrosMarcados = marcados.includes(valor)
    ? marcados.filter((t) => t !== valor && t !== TIPO_TODOS_OS_ENVIOS)
    : [...marcados.filter((t) => t !== TIPO_TODOS_OS_ENVIOS), valor];
  return outros.every((o) => outrosMarcados.includes(o))
    ? [TIPO_TODOS_OS_ENVIOS, ...outrosMarcados]
    : outrosMarcados;
}

const linhaEmBranco = () => ({
  nome: "",
  telefone: "",
  email: "",
  tipos: [] as string[],
  canal: "",
});

export function contatosIniciais<T extends ContatoDaLinha>(
  contatos: T[],
  destinos: DestinoSalvo[],
  opcoes: { verTodos: boolean; setor: string; somenteLeitura: boolean },
): (T | ReturnType<typeof linhaEmBranco>)[] {
  const comTipos = contatosComTipos(contatos, destinos);
  const semNenhum = !comTipos.some((c) => opcoes.verTodos || contatoDoSetor(c, opcoes.setor));
  return semNenhum && !opcoes.somenteLeitura ? [...comTipos, linhaEmBranco()] : comTipos;
}

export function contatosComTipos<T extends { id?: string; telefone: string; email: string }>(
  contatos: T[],
  destinos: DestinoSalvo[],
): (T & { tipos: string[]; canal: string })[] {
  return contatos.map((contato) => ({
    ...contato,
    tipos: tiposDoContato(destinos, contato.id),
    canal: canalDoContato(destinos, contato),
  }));
}
