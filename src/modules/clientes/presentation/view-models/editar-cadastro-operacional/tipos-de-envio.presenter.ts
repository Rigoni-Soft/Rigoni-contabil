import { TIPO_TODOS_OS_ENVIOS } from "@/modules/clientes/application/ports/in/definir-tipos-de-envio-do-contato.provider";
import {
  canalPerdidoDoDestino,
  FORMAS_ENVIO,
  temOsDoisCanais,
  type FormaEnvioValor,
} from "@/shared/kernel/forma-envio";
import { chaveDoTelefone } from "@/shared/kernel/telefone";

type DestinoSalvo = { contatoId: string; tipo: string | null; canal: string };
type TipoDeEnvio = { slug: string; rotulo: string };

// O contato como a linha o tem: os campos digitados e os tipos que ele recebe.
export type ContatoDaLinha = {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  donoSetor?: string | null;
  // Os Setores que usam o contato (a URA e o dono entram sempre): só quem o usa o vê na lista.
  setores?: readonly string[];
  // Por onde o Setor envia ao contato quando ele tem os dois canais; "" = ainda não escolhido.
  canal?: string;
};

const ROTULO_DO_CANAL: Record<FormaEnvioValor, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  whatsapp_e_email: "WhatsApp e E-mail",
};

// As opções do "Enviar por" (o contato com os dois canais; sem valor padrão).
export const OPCOES_DE_CANAL = FORMAS_ENVIO.map((valor) => ({
  valor,
  rotulo: ROTULO_DO_CANAL[valor],
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

export const ROTULO_TODOS_OS_ENVIOS = "Todos os envios";

// Os checkboxes da linha: "Todos os envios" e os tipos do catálogo do Setor.
export function opcoesDeTipos(tipos: TipoDeEnvio[]) {
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

type AtorDoContato = { admin: boolean; setorDoCadastro: string };

// Quem edita nome, WhatsApp e e-mail do Contato: o Setor dono e o Admin (o do Admin só ele). Os outros
// Setores o veem em leitura e só marcam o que ele recebe deles. Linha ainda não salva é de quem a digita.
export function contatoEditavel(
  contato: Pick<ContatoDaLinha, "id" | "donoSetor">,
  ator: AtorDoContato,
): boolean {
  // Sem `donoSetor` (undefined) é a linha que esta tela acabou de salvar: o dono é quem a criou.
  if (!contato.id || ator.admin || contato.donoSetor === undefined) return true;
  return contato.donoSetor === ator.setorDoCadastro;
}

// O contato é do Setor quando ele o cadastrou ou o escolheu (tem Destino dele). Os demais ficam fora da lista
// do Setor e só aparecem no "contato já cadastrado" de quem vai adicionar um contato.
export function contatoDoSetor(
  contato: Pick<ContatoDaLinha, "donoSetor" | "setores">,
  setor: string,
): boolean {
  return contato.donoSetor === setor || (contato.setores ?? []).includes(setor);
}

// O contato já salvo do Cliente que tem o número digitado (a mesma chave do banco: dígitos sem o DDI 55),
// fora a própria linha. Qualquer contato do formulário vale, inclusive os escondidos de outros Setores.
export function contatoDoMesmoNumero<T extends ContatoDaLinha>(
  contatos: readonly T[],
  indiceDaLinha: number,
  telefone: string,
): { indice: number; contato: T } | undefined {
  const chave = chaveDoTelefone(telefone);
  if (!chave) return undefined;
  const indice = contatos.findIndex(
    (c, i) => i !== indiceDaLinha && Boolean(c.id) && chaveDoTelefone(c.telefone) === chave,
  );
  return indice < 0 ? undefined : { indice, contato: contatos[indice] };
}

// O aviso sob o WhatsApp: o número já é de um contato do Cliente. Na lista (do Setor, ou toda para o Admin) não
// há o que escolher; fora dela, a linha oferece usar esse contato.
export function textoDoNumeroRepetido(nome: string, naLista: boolean, porSetor: boolean): string {
  if (!naLista) return `Este número já é do contato ${nome}.`;
  return `Este número já é do contato ${nome}, que já está na lista${porSetor ? " deste Setor" : ""}.`;
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

// A lista com que a tela abre: os contatos já com o que cada um recebe e, quando o Setor ainda não usa nenhum,
// uma linha em branco (descartada se ninguém a tocar) para a seção não abrir vazia.
export function contatosIniciais<T extends ContatoDaLinha>(
  contatos: T[],
  destinos: DestinoSalvo[],
  opcoes: { verTodos: boolean; setor: string; somenteLeitura: boolean },
): (T | { nome: string; telefone: string; email: string; tipos: string[]; canal: string })[] {
  const comTipos = contatosComTipos(contatos, destinos);
  const semNenhum = !comTipos.some((c) => opcoes.verTodos || contatoDoSetor(c, opcoes.setor));
  return semNenhum && !opcoes.somenteLeitura
    ? [...comTipos, { nome: "", telefone: "", email: "", tipos: [], canal: "" }]
    : comTipos;
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
