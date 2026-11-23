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

// As opções do "Enviar por" (o contato com os dois canais; sem valor padrão).
export const OPCOES_DE_CANAL = FORMAS_ENVIO.map((valor) => ({
  valor,
  rotulo: FORMA_ENVIO_LABEL[valor],
}));

// Por onde o Setor envia ao contato que tem os dois canais: o canal dos Destinos dele ("" sem Destino). Com um
// canal só não há o que escolher (o canal é o do contato), então a linha não guarda valor.
export function canalDoContato(
  destinos: DestinoSalvo[],
  contato: Pick<ContatoDaLinha, "id" | "telefone" | "email">,
): string {
  if (!temOsDoisCanais(contato)) return "";
  return destinos.find((d) => d.contatoId === contato.id)?.canal ?? "";
}

const ROTULO_TODOS_OS_ENVIOS = "Todos os envios";

// Os checkboxes da linha: "Todos os envios" e os tipos do catálogo do Setor.
export function opcoesDeTipos(tipos: OpcaoDeTipoDeEnvio[]) {
  return [
    { valor: TIPO_TODOS_OS_ENVIOS, rotulo: ROTULO_TODOS_OS_ENVIOS },
    ...tipos.map((t) => ({ valor: t.slug, rotulo: t.rotulo })),
  ];
}

// O que o contato recebe hoje (o Destino de tipo nulo é "todos").
export function tiposDoContato(destinos: DestinoSalvo[], contatoId: string | undefined): string[] {
  return destinos
    .filter((d) => d.contatoId === contatoId)
    .map((d) => d.tipo ?? TIPO_TODOS_OS_ENVIOS);
}

const CANAL_PERDIDO = { whatsapp: "o WhatsApp", email: "o e-mail" } as const;

// Aviso na linha: o canal que algum envio do contato usa e ele deixou de ter (número ou e-mail apagado,
// já na tela, antes de salvar). Sem Destino salvo, não há o que avisar.
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

// Os checkboxes da linha depois de um clique. "Todos os envios" marca todos os outros (e, desmarcado,
// desmarca todos); desmarcar um dos outros desmarca o "Todos"; marcar o último que faltava o marca.
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

// A lista com que a tela abre: os contatos já com o que cada um recebe e, quando o Setor ainda não usa nenhum,
// uma linha em branco (descartada se ninguém a tocar) para a seção não abrir vazia.
export function contatosIniciais<T extends ContatoDaLinha>(
  contatos: T[],
  destinos: DestinoSalvo[],
  opcoes: { verTodos: boolean; setor: string; somenteLeitura: boolean },
): (T | ReturnType<typeof linhaEmBranco>)[] {
  const comTipos = contatosComTipos(contatos, destinos);
  const semNenhum = !comTipos.some((c) => opcoes.verTodos || contatoDoSetor(c, opcoes.setor));
  return semNenhum && !opcoes.somenteLeitura ? [...comTipos, linhaEmBranco()] : comTipos;
}

// Os contatos do servidor já com o que cada um recebe do Setor (os checkboxes da linha) e por qual canal.
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
