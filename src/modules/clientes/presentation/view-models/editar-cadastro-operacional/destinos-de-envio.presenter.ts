import {
  canaisDoContato,
  canalPerdidoDoDestino,
  FORMA_ENVIO_LABEL,
  type FormaEnvioValor,
} from "@/shared/kernel/forma-envio";
import { SETOR_LABEL } from "@/shared/kernel/setores";
import { chaveDoTelefone } from "@/shared/kernel/telefone";

// O que o Destino precisa saber do Contato (a linha do formulário, já salva se tem `id`).
export type ContatoDoDestino = {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  donoSetor?: string | null;
};

type DestinoSalvo = { id: string; contatoId: string; tipo: string | null; canal: string };
type TipoDeEnvio = { slug: string; rotulo: string };

export type Opcao = { valor: string; rotulo: string };

export const ROTULO_TODOS_OS_ENVIOS = "Todos os envios do Setor";

// Como o Contato aparece no select: o WhatsApp, ou o e-mail quando não tem número.
export const identificadorDoContato = (c: Pick<ContatoDoDestino, "telefone" | "email">) =>
  c.telefone.trim() || c.email.trim();

// O select de contato lista os já salvos (os que têm id); o Destino aponta um id.
export function opcoesDeContato(contatos: ContatoDoDestino[]): Opcao[] {
  return contatos.flatMap((c) =>
    c.id ? [{ valor: c.id, rotulo: identificadorDoContato(c) }] : [],
  );
}

export function opcoesDeTipo(tipos: TipoDeEnvio[]): Opcao[] {
  return [
    { valor: "", rotulo: ROTULO_TODOS_OS_ENVIOS },
    ...tipos.map((t) => ({ valor: t.slug, rotulo: t.rotulo })),
  ];
}

// O canal escolhível: o Contato com um canal só trava nele (`unico`); com os dois pede escolha, sem padrão.
export function canaisDaEscolha(contato: Pick<ContatoDoDestino, "telefone" | "email"> | undefined) {
  const canais = contato ? canaisDoContato(contato) : [];
  return {
    opcoes: canais.map((valor) => ({ valor, rotulo: FORMA_ENVIO_LABEL[valor] })),
    unico: canais.length === 1 ? canais[0] : undefined,
  };
}

const ROTULO_DO_CANAL_PERDIDO = { whatsapp: "o WhatsApp", email: "o e-mail" } as const;

export type LinhaDeDestino = {
  id: string;
  tipo: string;
  contato: string;
  identificador: string;
  canal: string;
  // O canal que o Destino usa e o Contato deixou de ter: o envio não sai por ele.
  aviso?: string;
};

// A tabela de Destinos: o rótulo do tipo, o Contato (nome e WhatsApp ou e-mail), o canal e o aviso de canal perdido.
export function linhasDeDestino(
  destinos: DestinoSalvo[],
  contatos: ContatoDoDestino[],
  tipos: TipoDeEnvio[],
): LinhaDeDestino[] {
  return destinos.map((d) => {
    const contato = contatos.find((c) => c.id === d.contatoId);
    const perdido = contato ? canalPerdidoDoDestino(d.canal as FormaEnvioValor, contato) : null;
    return {
      id: d.id,
      tipo: d.tipo
        ? (tipos.find((t) => t.slug === d.tipo)?.rotulo ?? d.tipo)
        : ROTULO_TODOS_OS_ENVIOS,
      contato: contato?.nome ?? "Contato removido",
      identificador: contato ? identificadorDoContato(contato) : "",
      canal: FORMA_ENVIO_LABEL[d.canal] ?? d.canal,
      aviso: perdido
        ? `O contato deixou de ter ${ROTULO_DO_CANAL_PERDIDO[perdido]}: este envio não sai por ele. Atualize o contato ou remova o destino.`
        : undefined,
    };
  });
}

// O contato do Cliente que já tem o WhatsApp ou o e-mail que se está digitando: o formulário o mostra
// em vez de deixar criar o repetido (o banco recusa o mesmo número ou e-mail no Cliente).
export function contatoComOMesmoCanal(
  contatos: ContatoDoDestino[],
  digitado: { telefone: string; email: string },
): ContatoDoDestino | undefined {
  const chave = chaveDoTelefone(digitado.telefone);
  const email = digitado.email.trim().toLowerCase();
  return contatos.find(
    (c) =>
      c.id &&
      ((chave !== null && chaveDoTelefone(c.telefone) === chave) ||
        (email !== "" && c.email.trim().toLowerCase() === email)),
  );
}

type AtorDoContato = { admin: boolean; setorDoCadastro: string };

// Quem edita nome, WhatsApp e e-mail do Contato: o Setor dono e o Admin (o do Admin só ele). Os outros
// Setores o veem em leitura e o escolhem como destino. Linha ainda não salva é de quem a digita.
export function contatoEditavel(
  contato: Pick<ContatoDoDestino, "id" | "donoSetor">,
  ator: AtorDoContato,
): boolean {
  if (!contato.id || ator.admin) return true;
  return contato.donoSetor === ator.setorDoCadastro;
}

// O texto da linha em leitura ("Contato do RH: ..."); sem texto, a linha é editável.
export function avisoDeContatoDeOutroSetor(
  contato: Pick<ContatoDoDestino, "id" | "donoSetor">,
  ator: AtorDoContato,
): string | undefined {
  if (contatoEditavel(contato, ator)) return undefined;
  const uso = "Você pode usá-lo como destino.";
  if (!contato.donoSetor) return `Contato do Admin: só o Admin edita. ${uso}`;
  const dono = SETOR_LABEL[contato.donoSetor] ?? contato.donoSetor;
  return `Contato do ${dono}: só o ${dono} e o Admin editam. ${uso}`;
}
