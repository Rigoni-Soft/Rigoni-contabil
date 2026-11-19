import { TIPO_TODOS_OS_ENVIOS } from "@/modules/clientes/application/ports/in/definir-tipos-de-envio-do-contato.provider";
import { canalPerdidoDoDestino, type FormaEnvioValor } from "@/shared/kernel/forma-envio";
import { SETOR_LABEL } from "@/shared/kernel/setores";

type DestinoSalvo = { contatoId: string; tipo: string | null; canal: string };
type TipoDeEnvio = { slug: string; rotulo: string };

// O contato como a linha o tem: os campos digitados e os tipos que ele recebe.
export type ContatoDaLinha = {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  donoSetor?: string | null;
};

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

// O texto da linha em leitura ("Contato do RH: ..."); sem texto, a linha é editável.
export function avisoDeContatoDeOutroSetor(
  contato: Pick<ContatoDaLinha, "id" | "donoSetor">,
  ator: AtorDoContato,
): string | undefined {
  if (contatoEditavel(contato, ator)) return undefined;
  if (!contato.donoSetor) return "Contato do Admin: só o Admin edita nome, WhatsApp e e-mail.";
  const dono = SETOR_LABEL[contato.donoSetor] ?? contato.donoSetor;
  return `Contato do ${dono}: só o ${dono} e o Admin editam nome, WhatsApp e e-mail.`;
}

// Os contatos do servidor já com o que cada um recebe do Setor (os checkboxes da linha).
export function contatosComTipos<T extends { id?: string }>(
  contatos: T[],
  destinos: DestinoSalvo[],
): (T & { tipos: string[] })[] {
  return contatos.map((contato) => ({ ...contato, tipos: tiposDoContato(destinos, contato.id) }));
}
