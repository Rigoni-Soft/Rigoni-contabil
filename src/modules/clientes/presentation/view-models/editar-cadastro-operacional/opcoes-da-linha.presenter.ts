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
  semCanal: boolean;
  onMudarCanal: (valor: string) => void;
  onAlternar: (valor: string) => void;
};

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
  escolheuNovo: boolean;
  onEscolher: (contatoId: string) => void;
  onNovo: () => void;
};

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
    modoNovo: escolheuNovo || (contato ? !emBranco(contato) : false),
    onEscolher,
    onNovo,
  };
}

type EntradaDoNumeroRepetido = {
  contatos: readonly ValoresDaLinha[];
  indice: number;
  verificado: string | undefined;
  admin: boolean;
  naLista: (indice: number) => boolean;
  onUsar: (contatoId: string) => void;
};

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
