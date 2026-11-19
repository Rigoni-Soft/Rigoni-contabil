import { useRef, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { contatoNovo } from "./editar-cadastro-operacional.presenter";
import {
  contatoSchema,
  type EditarCadastroOperacionalFormValues,
} from "./editar-cadastro-operacional.schema";
import { salvarContatoAction } from "./salvar-contato.actions";
import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";
import {
  avisoDeCanalPerdido,
  contatoDoSetor,
  contatoEditavel,
  opcoesDeTipos,
  tiposAposAlternar,
} from "./tipos-de-envio.presenter";

type Parametros = {
  clienteId: string;
  form: UseFormReturn<EditarCadastroOperacionalFormValues>;
  // Os campos do useFieldArray (a chave de cada linha) e a remoção da linha nova que se cancela.
  campos: { id: string }[];
  remover: (indice: number) => void;
  // Os Destinos do Setor como vieram do servidor (para o aviso de canal perdido) e o catálogo de tipos.
  destinos: { contatoId: string; tipo: string | null; canal: string }[];
  tiposDeEnvio: { slug: string; rotulo: string }[];
  // O Setor da tela e quem a abriu: o Admin não tem Setor (só cadastra contatos); o Setor marca o que cada
  // contato recebe dele (também nos de outros donos) e edita só os contatos que cadastrou.
  setorDoCadastro: string;
  admin: boolean;
  // Admin e quem só visualiza veem todos os contatos; o Setor vê os que cadastrou ou escolheu, e escolhe os
  // demais ao adicionar um contato.
  verTodos: boolean;
};

type Linha = EditarCadastroOperacionalFormValues["contatos"][number];
type Instantaneo = { nome: string; telefone: string; email: string; tipos: string[] };

const CAMPOS_DO_CONTATO = ["nome", "telefone", "email"] as const;

// A mesma ação repetida não muda o texto e o leitor de tela não a anunciaria de novo; o espaço no fim alterna.
const ESPACO_ALTERNADO = " ";

const soDigitos = (texto: string) => texto.replace(/\D/g, "");
const emBranco = (c: Linha) =>
  !c.nome.trim() && !soDigitos(c.telefone) && !c.email.trim() && !c.tipos?.length;
const mesmosTipos = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tipo) => b.includes(tipo));

// Depois de a tela se atualizar: o foco vai a um alvo estável da mesma linha (o botão que sumiu não pode
// deixar o foco no <body>). O elemento novo só existe depois da atualização: tenta de novo por um instante.
function focar(id: string, tentativa = 0) {
  setTimeout(() => {
    const alvo = document.getElementById(id);
    if (alvo) alvo.focus();
    else if (tentativa < 10) focar(id, tentativa + 1);
  }, 20);
}

// As linhas de contato do cadastro: cada uma vê (Editar e Lixeira) ou edita (Salvar e Cancelar) o contato e
// o que ele recebe do Setor, numa gravação só. Linha nova já nasce em edição; as demais abrem no lápis.
export function useContatosDoCadastro({
  clienteId,
  form,
  campos,
  remover,
  destinos,
  tiposDeEnvio,
  setorDoCadastro,
  admin,
  verTodos,
}: Parametros) {
  const { control, getValues, setValue, setError, clearErrors } = form;
  const contatos = useWatch({ control, name: "contatos" }) ?? [];
  // Por chave da linha (o id do useFieldArray, que não muda quando outra linha sai); sem entrada, vale o
  // padrão: nova = em edição, salva = só mostrando.
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  // Contato de outro Setor trazido para a lista pelo "contato já cadastrado": "novo" até o Setor salvar os
  // envios (cancelar o devolve à lista dos disponíveis), "salvo" depois.
  const [adotados, setAdotados] = useState<Record<string, "novo" | "salvo">>({});
  // Contato de outro Setor que o Setor deixou de usar: sai da lista agora (o servidor tirou os envios dele).
  const [dispensados, setDispensados] = useState<Record<string, true>>({});
  // Linha nova em que se escolheu "Cadastrar novo": os campos são de texto em vez de seleções.
  const [novos, setNovos] = useState<Record<string, boolean>>({});
  const instantaneos = useRef<Record<string, Instantaneo>>({});
  const [salvando, setSalvando] = useState<number | null>(null);
  const [falha, setFalha] = useState<{ indice: number; mensagem: string } | null>(null);
  const [anuncio, setAnuncio] = useState({ texto: "", vez: 0 });
  const anunciar = (texto: string) => setAnuncio((atual) => ({ texto, vez: atual.vez + 1 }));
  const aviso = anuncio.texto && anuncio.texto + (anuncio.vez % 2 ? ESPACO_ALTERNADO : "");

  const opcoes = opcoesDeTipos(tiposDeEnvio);
  const ator = { admin, setorDoCadastro };
  const chaveDe = (indice: number) => campos[indice]?.id ?? String(indice);
  const salvo = (indice: number) => Boolean(contatos[indice]?.id);
  const editando = (indice: number) => abertas[chaveDe(indice)] ?? !salvo(indice);
  const editavel = (indice: number) =>
    contatos[indice] ? contatoEditavel(contatos[indice], ator) : true;
  const visivel = (indice: number) => {
    const contato = contatos[indice];
    if (!contato || verTodos || !contato.id) return true;
    if (dispensados[chaveDe(indice)]) return false;
    return Boolean(adotados[chaveDe(indice)]) || contatoDoSetor(contato, setorDoCadastro);
  };
  // A numeração é a da tela: contato escondido não conta.
  const numero = (indice: number) =>
    contatos.slice(0, indice + 1).filter((_, i) => visivel(i)).length;
  const fechar = (indice: number) => {
    delete instantaneos.current[chaveDe(indice)];
    setAbertas((atuais) => ({ ...atuais, [chaveDe(indice)]: false }));
  };

  const tiposDa = (indice: number) => getValues(`contatos.${indice}.tipos`) ?? [];

  const onEditar = (indice: number) => {
    const contato = getValues(`contatos.${indice}`);
    instantaneos.current[chaveDe(indice)] = {
      nome: contato.nome,
      telefone: contato.telefone,
      email: contato.email,
      tipos: [...tiposDa(indice)],
    };
    setAbertas((atuais) => ({ ...atuais, [chaveDe(indice)]: true }));
    focar(editavel(indice) ? `contatos.${indice}.nome` : `contatos.${indice}.tipo-todos`);
  };

  // A lixeira do contato que o Setor só usa (é de outro dono): tira os envios do Setor e o contato sai da lista
  // dele; o contato segue com o dono e com os outros Setores.
  const deixarDeUsar = async (indice: number) => {
    const id = getValues(`contatos.${indice}.id`);
    if (salvando !== null || !id) return;
    setFalha(null);
    setSalvando(indice);
    try {
      const resultado = await definirTiposDoContatoAction({ clienteId, contatoId: id, tipos: [] });
      if (!resultado.ok) {
        setFalha({ indice, mensagem: resultado.error.message });
        return;
      }
      anunciar(`Contato ${numero(indice)} deixou de ser usado por este Setor.`);
      setValue(`contatos.${indice}.tipos`, []);
      setDispensados((atuais) => ({ ...atuais, [chaveDe(indice)]: true }));
    } catch (erro) {
      console.error("Falha ao deixar de usar o contato", erro);
      setFalha({ indice, mensagem: mensagemDaFalha(erro) });
    } finally {
      setSalvando(null);
    }
  };

  const onCancelar = (indice: number) => {
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    const antes = instantaneos.current[chaveDe(indice)];
    if (salvo(indice) && antes) {
      setValue(`contatos.${indice}.nome`, antes.nome);
      setValue(`contatos.${indice}.telefone`, antes.telefone);
      setValue(`contatos.${indice}.email`, antes.email);
      setValue(`contatos.${indice}.tipos`, antes.tipos);
      fechar(indice);
      // O contato escolhido e ainda não salvo volta à lista dos disponíveis.
      if (adotados[chaveDe(indice)] === "novo") {
        setAdotados((atuais) => {
          const { [chaveDe(indice)]: _, ...resto } = atuais;
          return resto;
        });
      }
      anunciar(`Edição do contato ${numero(indice)} cancelada.`);
      focar(`contatos.${indice}.editar`);
      return;
    }
    // Linha nova: some, a menos que seja a única visível (aí só esvazia).
    const visiveis = contatos.filter((_, i) => visivel(i)).length;
    if (visiveis > 1) remover(indice);
    else {
      setValue(`contatos.${indice}`, { ...contatoNovo(), tipos: [] });
      setNovos((atuais) => ({ ...atuais, [chaveDe(indice)]: false }));
    }
    anunciar(`Contato ${numero(indice)} descartado.`);
  };

  const onSalvar = async (indice: number) => {
    if (salvando !== null) return;
    const contato = getValues(`contatos.${indice}`);
    const camposEditaveis = editavel(indice);
    const chave = chaveDe(indice);
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    if (camposEditaveis) {
      const valido = contatoSchema.safeParse(contato);
      if (!valido.success) {
        valido.error.issues.forEach((problema, posicao) => {
          const campo = CAMPOS_DO_CONTATO.find((c) => c === problema.path[0]) ?? "nome";
          setError(
            `contatos.${indice}.${campo}`,
            { message: problema.message },
            { shouldFocus: posicao === 0 },
          );
        });
        return;
      }
    }

    const antes = instantaneos.current[chave];
    const tipos = tiposDa(indice);
    // Contato de outro Setor escolhido agora: sem ao menos um envio ele não entra na lista do Setor.
    if (adotados[chave] === "novo" && tipos.length === 0) {
      setFalha({ indice, mensagem: "Marque ao menos um envio para usar este contato." });
      return;
    }
    const camposMudaram =
      !contato.id ||
      !antes ||
      antes.nome.trim() !== contato.nome.trim() ||
      soDigitos(antes.telefone) !== soDigitos(contato.telefone) ||
      antes.email.trim().toLowerCase() !== contato.email.trim().toLowerCase();
    const tiposMudaram = antes ? !mesmosTipos(antes.tipos, tipos) : tipos.length > 0;

    setSalvando(indice);
    try {
      let id = contato.id;
      if (camposEditaveis && camposMudaram) {
        const resultado = await salvarContatoAction({
          clienteId,
          contato: { id, nome: contato.nome, telefone: contato.telefone, email: contato.email },
        });
        if (!resultado.ok) {
          setFalha({ indice, mensagem: resultado.error.message });
          return;
        }
        id = resultado.data.id;
        setValue(`contatos.${indice}.id`, id);
        setValue(`contatos.${indice}.donoSetor`, admin ? null : setorDoCadastro);
        // A linha segue em edição se só os envios falharem (agora ela tem id, e o padrão seria fechar).
        setAbertas((atuais) => ({ ...atuais, [chave]: true }));
        // O que já está gravado não se regrava se só os envios falharem e a pessoa tentar de novo.
        instantaneos.current[chave] = {
          nome: contato.nome,
          telefone: contato.telefone,
          email: contato.email,
          tipos: antes?.tipos ?? [],
        };
      }
      if (!admin && id && tiposMudaram) {
        const envios = await definirTiposDoContatoAction({ clienteId, contatoId: id, tipos });
        if (!envios.ok) {
          setFalha({
            indice,
            mensagem:
              camposEditaveis && camposMudaram
                ? `Contato salvo, mas os envios não: ${envios.error.message}`
                : envios.error.message,
          });
          return;
        }
      }
      if (adotados[chave]) setAdotados((atuais) => ({ ...atuais, [chave]: "salvo" }));
      fechar(indice);
      anunciar(`Contato ${numero(indice)} salvo.`);
      focar(`contatos.${indice}.editar`);
    } catch (erro) {
      console.error("Falha ao salvar o contato", erro);
      setFalha({ indice, mensagem: mensagemDaFalha(erro) });
    } finally {
      setSalvando(null);
    }
  };

  // Os contatos de outros Setores que este ainda não usa: o que a linha nova oferece escolher.
  const disponiveis = contatos.flatMap((contato, indice) =>
    contato.id && !visivel(indice) ? [{ indice, contato }] : [],
  );

  // Escolher um contato já cadastrado: ele entra na lista, em edição, para o Setor marcar os envios; a linha em
  // branco de onde se escolheu sai.
  const onEscolherExistente = (indiceDaLinha: number, contatoId: string) => {
    const alvo = disponiveis.find((d) => d.contato.id === contatoId);
    if (!alvo) return;
    const chave = chaveDe(alvo.indice);
    instantaneos.current[chave] = {
      nome: alvo.contato.nome,
      telefone: alvo.contato.telefone,
      email: alvo.contato.email,
      tipos: [],
    };
    setValue(`contatos.${alvo.indice}.tipos`, []);
    setAdotados((atuais) => ({ ...atuais, [chave]: "novo" }));
    setAbertas((atuais) => ({ ...atuais, [chave]: true }));
    const novoIndice = alvo.indice > indiceDaLinha ? alvo.indice - 1 : alvo.indice;
    remover(indiceDaLinha);
    focar(`contatos.${novoIndice}.tipo-todos`);
  };

  // Linha em edição (com algo nela) segura o Salvar do cadastro: o que se digitou ou marcou ali só vale com o
  // Salvar da própria linha. A linha nova em branco, que ninguém tocou, não segura.
  const abertaComConteudo = contatos.findIndex(
    (contato, indice) =>
      visivel(indice) && editando(indice) && (salvo(indice) || !emBranco(contato)),
  );

  return {
    editando,
    salvo,
    salvando,
    visivel,
    numero,
    camposTravados: (indice: number) => !editavel(indice),
    // Editar e a lixeira andam em par em todo contato: o dono remove; quem só usa o contato deixa de usá-lo.
    rotuloDaLixeira: (indice: number) =>
      editavel(indice) ? undefined : `Deixar de usar o contato ${numero(indice)}`,
    onRemover: (indice: number) => (editavel(indice) ? remover(indice) : void deixarDeUsar(indice)),
    // A linha nova do Setor oferece os contatos de outros Setores já cadastrados (o Admin não: vê todos).
    existentes: (indice: number) =>
      admin || salvo(indice)
        ? undefined
        : {
            opcoes: disponiveis.map((d) => ({
              id: d.contato.id as string,
              nome: d.contato.nome,
              telefone: d.contato.telefone,
              email: d.contato.email,
            })),
            // Escolheu "Cadastrar novo" (ou já digitou): os três campos são de texto.
            modoNovo:
              Boolean(novos[chaveDe(indice)]) ||
              (contatos[indice] ? !emBranco(contatos[indice]) : false),
            onEscolher: (contatoId: string) => onEscolherExistente(indice, contatoId),
            onNovo: () => setNovos((atuais) => ({ ...atuais, [chaveDe(indice)]: true })),
          },
    // Os checkboxes: só o Setor os tem (o Admin não define o que cada Setor envia).
    envios: (indice: number) => {
      const contato = contatos[indice];
      if (admin || !contato) return undefined;
      return {
        opcoes,
        marcados: contato.tipos ?? [],
        aviso: avisoDeCanalPerdido(destinos, contato),
        onAlternar: (valor: string) =>
          setValue(
            `contatos.${indice}.tipos`,
            tiposAposAlternar(
              tiposDa(indice),
              valor,
              opcoes.map((o) => o.valor),
            ),
          ),
      };
    },
    aviso,
    erroDaLinha: (indice: number) => (falha?.indice === indice ? falha.mensagem : undefined),
    onEditar,
    onSalvar,
    onCancelar,
    motivoDoBloqueio:
      abertaComConteudo >= 0
        ? `Salve ou cancele a edição do contato ${numero(abertaComConteudo)} para salvar o cadastro.`
        : undefined,
  };
}
