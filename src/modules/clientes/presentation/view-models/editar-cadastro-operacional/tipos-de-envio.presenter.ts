import { TIPO_TODOS_OS_ENVIOS } from "@/modules/clientes/application/ports/in/definir-tipos-de-envio-do-contato.provider";
import { canalPerdidoDoDestino, type FormaEnvioValor } from "@/shared/kernel/forma-envio";

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

// Os contatos do servidor já com o que cada um recebe do Setor (os checkboxes da linha).
export function contatosComTipos<T extends { id?: string }>(
  contatos: T[],
  destinos: DestinoSalvo[],
): (T & { tipos: string[] })[] {
  return contatos.map((contato) => ({ ...contato, tipos: tiposDoContato(destinos, contato.id) }));
}
