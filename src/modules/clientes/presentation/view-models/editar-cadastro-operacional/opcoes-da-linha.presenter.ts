import { temOsDoisCanais } from "@/shared/kernel/forma-envio";
import { chaveDoTelefone } from "@/shared/kernel/telefone";

import {
  contatoDoMesmoNumero,
  emBranco,
  textoDoNumeroRepetido,
  type ValoresDaLinha,
} from "./contato-da-linha.presenter";
import {
  avisoDeCanalPerdido,
  OPCOES_DE_CANAL,
  type DestinoSalvo,
} from "./tipos-de-envio.presenter";

const MENSAGEM_SEM_CANAL = "Escolha por onde enviar a este contato.";

type EntradaDosEnvios = {
  contato: ValoresDaLinha;
  opcoes: { valor: string; rotulo: string }[];
  destinos: DestinoSalvo[];
  // O Salvar foi recusado por falta do canal.
  semCanal: boolean;
  onMudarCanal: (valor: string) => void;
  onAlternar: (valor: string) => void;
};

// O que a linha mostra de "o que o contato recebe": os checkboxes e, com os dois canais e ao menos um envio
// marcado, o "Enviar por".
export function enviosDaLinha({
  contato,
  opcoes,
  destinos,
  semCanal,
  onMudarCanal,
  onAlternar,
}: EntradaDosEnvios) {
  const marcados = contato.tipos ?? [];
  const comCanal = marcados.length > 0 && temOsDoisCanais(contato);
  return {
    opcoes,
    marcados,
    canal: comCanal
      ? {
          opcoes: OPCOES_DE_CANAL,
          valor: contato.canal ?? "",
          erro: semCanal ? MENSAGEM_SEM_CANAL : undefined,
          onMudar: onMudarCanal,
        }
      : undefined,
    aviso: avisoDeCanalPerdido(destinos, contato),
    onAlternar,
  };
}

type EntradaDosExistentes = {
  disponiveis: { id: string; contato: ValoresDaLinha }[];
  contato: ValoresDaLinha | undefined;
  // Escolheu "Cadastrar novo" nesta linha.
  escolheuNovo: boolean;
  onEscolher: (contatoId: string) => void;
  onNovo: () => void;
};

// A linha nova do Setor oferece os contatos de outros Setores já cadastrados.
export function existentesDaLinha({
  disponiveis,
  contato,
  escolheuNovo,
  onEscolher,
  onNovo,
}: EntradaDosExistentes) {
  return {
    opcoes: disponiveis.map(({ id, contato: c }) => ({
      id,
      nome: c.nome,
      telefone: c.telefone,
      email: c.email,
    })),
    // Escolheu "Cadastrar novo" (ou já digitou): os três campos são de texto.
    modoNovo: escolheuNovo || (contato ? !emBranco(contato) : false),
    onEscolher,
    onNovo,
  };
}

type EntradaDoNumeroRepetido = {
  contatos: readonly ValoresDaLinha[];
  indice: number;
  // O número (chave) em que se saiu do WhatsApp da última vez: o aviso só vale para ele.
  verificado: string | undefined;
  admin: boolean;
  naLista: (indice: number) => boolean;
  onUsar: (contatoId: string) => void;
};

// O aviso do número repetido da linha nova: o contato do Cliente que já o tem. Fora da lista do Setor, a linha
// oferece usá-lo.
export function numeroRepetidoDaLinha({
  contatos,
  indice,
  verificado,
  admin,
  naLista,
  onUsar,
}: EntradaDoNumeroRepetido) {
  const contato = contatos[indice];
  const chave = contato ? chaveDoTelefone(contato.telefone) : null;
  if (!contato || !chave || verificado !== chave) return undefined;
  const achado = contatoDoMesmoNumero(contatos, indice, contato.telefone);
  if (!achado) return undefined;
  const jaNaLista = naLista(achado.indice);
  const idDoContato = achado.contato.id;
  return {
    texto: textoDoNumeroRepetido(achado.contato.nome, jaNaLista, !admin),
    onUsar: jaNaLista || !idDoContato ? undefined : () => onUsar(idDoContato),
  };
}
