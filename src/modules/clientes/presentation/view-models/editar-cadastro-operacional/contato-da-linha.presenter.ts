import { chaveDoTelefone, soDigitos } from "@/shared/kernel/telefone";

import {
  contatoSchema,
  type EditarCadastroOperacionalFormValues,
} from "./editar-cadastro-operacional.schema";

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

const CAMPOS_DO_CONTATO = ["nome", "telefone", "email"] as const;

// O que a validação do contato recusou, campo a campo (problema fora dos três campos cai no Nome).
export function problemasDosCampos(contato: ValoresDaLinha) {
  const valido = contatoSchema.safeParse(contato);
  if (valido.success) return [];
  return valido.error.issues.map((problema) => ({
    campo: CAMPOS_DO_CONTATO.find((c) => c === problema.path[0]) ?? "nome",
    mensagem: problema.message,
  }));
}

export type ValoresDaLinha = EditarCadastroOperacionalFormValues["contatos"][number];

// O contato como estava quando a edição abriu: o Cancelar volta a ele e o Salvar só grava o que mudou.
export type Instantaneo = {
  nome: string;
  telefone: string;
  email: string;
  tipos: string[];
  canal: string;
};

export function instantaneoDe(
  contato: Pick<ValoresDaLinha, "nome" | "telefone" | "email" | "canal">,
  tipos: string[],
): Instantaneo {
  return {
    nome: contato.nome,
    telefone: contato.telefone,
    email: contato.email,
    tipos: [...tipos],
    canal: contato.canal ?? "",
  };
}

export const emBranco = (contato: ValoresDaLinha) =>
  !contato.nome.trim() &&
  !soDigitos(contato.telefone) &&
  !contato.email.trim() &&
  !contato.tipos?.length;

const mesmosTipos = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tipo) => b.includes(tipo));

// Nome, WhatsApp ou e-mail diferentes do que estava gravado (o telefone compara só os dígitos).
export function camposMudaram(antes: Instantaneo | undefined, contato: ValoresDaLinha): boolean {
  if (!contato.id || !antes) return true;
  return (
    antes.nome.trim() !== contato.nome.trim() ||
    soDigitos(antes.telefone) !== soDigitos(contato.telefone) ||
    antes.email.trim().toLowerCase() !== contato.email.trim().toLowerCase()
  );
}

// O que o contato recebe (ou o canal do envio) mudou desde que a edição abriu; sem instantâneo, basta ter envio.
export function enviosMudaram(
  antes: Instantaneo | undefined,
  contato: ValoresDaLinha,
  tipos: string[],
  exigeCanal: boolean,
): boolean {
  if (!antes) return tipos.length > 0;
  return !mesmosTipos(antes.tipos, tipos) || (exigeCanal && antes.canal !== (contato.canal ?? ""));
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
