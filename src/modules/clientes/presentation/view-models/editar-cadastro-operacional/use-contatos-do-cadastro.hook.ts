import { useRef, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";
import { temOsDoisCanais } from "@/shared/kernel/forma-envio";
import { chaveDoTelefone } from "@/shared/kernel/telefone";

import {
  camposMudaram,
  contatoDoSetor,
  contatoEditavel,
  emBranco,
  enviosMudaram,
  instantaneoDe,
  problemasDosCampos,
  type Instantaneo,
  type ValoresDaLinha,
} from "./contato-da-linha.presenter";
import { contatoNovo } from "./editar-cadastro-operacional.presenter";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import {
  enviosDaLinha,
  existentesDaLinha,
  numeroRepetidoDaLinha,
} from "./opcoes-da-linha.presenter";
import { opcoesDeTipos, tiposAposAlternar } from "./tipos-de-envio.presenter";
import { useAvisoAnunciado } from "./use-aviso-anunciado.hook";
import { useDeixarDeUsarContato } from "./use-deixar-de-usar-contato.hook";
import { useFocoPendente } from "./use-foco-pendente.hook";
import { useGravarContatoDaLinha } from "./use-gravar-contato-da-linha.hook";

type Parametros = {
  clienteId: string;
  form: UseFormReturn<EditarCadastroOperacionalFormValues>;
  campos: { id: string }[];
  remover: (indice: number) => void;
  destinos: { contatoId: string; tipo: string | null; canal: string }[];
  tiposDeEnvio: { slug: string; rotulo: string }[];
  setorDoCadastro: string;
  admin: boolean;
  verTodos: boolean;
};

type EstadoDaLinha = {
  aberta?: boolean;
  adotado?: "novo" | "salvo";
  dispensado?: boolean;
  confirmando?: boolean;
  novo?: boolean;
  semCanal?: boolean;
  verificado?: string;
};

const TEXTO_DA_CONFIRMACAO =
  "Deixar de usar este contato? Os envios marcados aqui deixam de sair para ele; o contato segue com o dono e com os outros Setores.";

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
  const [estado, setEstado] = useState<Record<string, EstadoDaLinha>>({});
  const instantaneos = useRef<Record<string, Instantaneo>>({});
  const [salvando, setSalvando] = useState<number | null>(null);
  const [falha, setFalha] = useState<{ indice: number; mensagem: string } | null>(null);
  const { aviso, avisoVez, anunciar } = useAvisoAnunciado();
  const focar = useFocoPendente();
  const gravarContatoDaLinha = useGravarContatoDaLinha(clienteId);
  const deixarDeUsarContato = useDeixarDeUsarContato(clienteId);

  const daLinha = (chave: string): EstadoDaLinha => estado[chave] ?? {};
  const alterar = (chave: string, parcial: EstadoDaLinha) =>
    setEstado((atual) => ({ ...atual, [chave]: { ...atual[chave], ...parcial } }));

  const opcoes = opcoesDeTipos(tiposDeEnvio);
  const ator = { admin, setorDoCadastro };
  const chaveDe = (indice: number) => campos[indice]?.id ?? String(indice);
  const salvo = (indice: number) => Boolean(contatos[indice]?.id);
  const editando = (indice: number) => daLinha(chaveDe(indice)).aberta ?? !salvo(indice);
  const editavel = (indice: number) =>
    contatos[indice] ? contatoEditavel(contatos[indice], ator) : true;
  const visivel = (indice: number) => {
    const contato = contatos[indice];
    if (!contato || verTodos || !contato.id) return true;
    const linha = daLinha(chaveDe(indice));
    if (linha.dispensado) return false;
    return Boolean(linha.adotado) || contatoDoSetor(contato, setorDoCadastro);
  };
  const numero = (indice: number) =>
    contatos.slice(0, indice + 1).filter((_, i) => visivel(i)).length;
  const fechar = (indice: number) => {
    delete instantaneos.current[chaveDe(indice)];
    alterar(chaveDe(indice), { aberta: false });
  };
  const tiposDa = (indice: number) => getValues(`contatos.${indice}.tipos`) ?? [];

  const onEditar = (indice: number) => {
    const contato = getValues(`contatos.${indice}`);
    instantaneos.current[chaveDe(indice)] = instantaneoDe(contato, tiposDa(indice));
    alterar(chaveDe(indice), { aberta: true });
    focar(editavel(indice) ? `contatos.${indice}.nome` : `contatos.${indice}.tipo-todos`);
  };

  const deixarDeUsar = async (indice: number) => {
    const id = getValues(`contatos.${indice}.id`);
    if (salvando !== null || !id) return;
    setFalha(null);
    setSalvando(indice);
    try {
      const resultado = await deixarDeUsarContato(id);
      if (!resultado.ok) return setFalha({ indice, mensagem: resultado.mensagem });
      anunciar(`Contato ${numero(indice)} deixou de ser usado por este Setor.`);
      setValue(`contatos.${indice}.tipos`, []);
      alterar(chaveDe(indice), { dispensado: true, confirmando: false });
    } catch (erro) {
      console.error("Falha ao deixar de usar o contato", erro);
      setFalha({ indice, mensagem: mensagemDaFalha(erro) });
    } finally {
      setSalvando(null);
    }
  };
  const perguntarSeDeixaDeUsar = (indice: number) => {
    alterar(chaveDe(indice), { confirmando: true });
  };
  const manterOContato = (indice: number) => {
    alterar(chaveDe(indice), { confirmando: false });
    focar(`contatos.${indice}.remover`);
  };

  const cancelarEdicaoDoSalvo = (indice: number, antes: Instantaneo) => {
    setValue(`contatos.${indice}.nome`, antes.nome);
    setValue(`contatos.${indice}.telefone`, antes.telefone);
    setValue(`contatos.${indice}.email`, antes.email);
    setValue(`contatos.${indice}.tipos`, antes.tipos);
    setValue(`contatos.${indice}.canal`, antes.canal);
    fechar(indice);
    const devolver = daLinha(chaveDe(indice)).adotado === "novo";
    alterar(chaveDe(indice), devolver ? { adotado: undefined } : {});
    anunciar(`Edição do contato ${numero(indice)} cancelada.`);
    focar(`contatos.${indice}.editar`);
  };

  const descartarLinhaNova = (indice: number) => {
    const visiveis = contatos.filter((_, i) => visivel(i)).length;
    if (visiveis > 1) remover(indice);
    if (visiveis <= 1) {
      setValue(`contatos.${indice}`, { ...contatoNovo(), tipos: [], canal: "" });
      alterar(chaveDe(indice), { novo: false });
    }
    anunciar(`Contato ${numero(indice)} descartado.`);
  };

  const onCancelar = (indice: number) => {
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    alterar(chaveDe(indice), { semCanal: false });
    const antes = instantaneos.current[chaveDe(indice)];
    if (salvo(indice) && antes) return cancelarEdicaoDoSalvo(indice, antes);
    descartarLinhaNova(indice);
  };

  const camposValidos = (indice: number, contato: ValoresDaLinha) => {
    const problemas = problemasDosCampos(contato);
    problemas.forEach(({ campo, mensagem }, posicao) =>
      setError(
        `contatos.${indice}.${campo}`,
        { message: mensagem },
        { shouldFocus: posicao === 0 },
      ),
    );
    return problemas.length === 0;
  };

  const registrarContatoGravado = (
    indice: number,
    contato: ValoresDaLinha,
    id: string | undefined,
    antes: Instantaneo | undefined,
  ) => {
    setValue(`contatos.${indice}.id`, id);
    setValue(`contatos.${indice}.donoSetor`, admin ? null : setorDoCadastro);
    alterar(chaveDe(indice), { aberta: true });
    instantaneos.current[chaveDe(indice)] = {
      ...instantaneoDe(contato, antes?.tipos ?? []),
      canal: antes?.canal ?? "",
    };
  };

  const concluirSalvar = (indice: number) => {
    const chave = chaveDe(indice);
    if (daLinha(chave).adotado) alterar(chave, { adotado: "salvo" });
    fechar(indice);
    anunciar(`Contato ${numero(indice)} salvo.`);
    focar(`contatos.${indice}.editar`);
  };

  const gravar = async (indice: number, contato: ValoresDaLinha, tipos: string[]) => {
    const antes = instantaneos.current[chaveDe(indice)];
    const exigeCanal = !admin && tipos.length > 0 && temOsDoisCanais(contato);
    setSalvando(indice);
    try {
      const gravacao = await gravarContatoDaLinha({
        contato,
        gravarCampos: editavel(indice) && camposMudaram(antes, contato),
        gravarEnvios: !admin && enviosMudaram(antes, contato, tipos, exigeCanal),
        tipos,
        canal: exigeCanal ? contato.canal : undefined,
      });
      if (gravacao.camposGravados) registrarContatoGravado(indice, contato, gravacao.id, antes);
      if (gravacao.falha) return setFalha({ indice, mensagem: gravacao.falha });
      concluirSalvar(indice);
    } catch (erro) {
      console.error("Falha ao salvar o contato", erro);
      setFalha({ indice, mensagem: mensagemDaFalha(erro) });
    } finally {
      setSalvando(null);
    }
  };

  const onSalvar = async (indice: number) => {
    if (salvando !== null) return;
    const contato = getValues(`contatos.${indice}`);
    const chave = chaveDe(indice);
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    alterar(chave, { semCanal: false });
    if (editavel(indice) && !camposValidos(indice, contato)) return;

    const tipos = tiposDa(indice);
    if (daLinha(chave).adotado === "novo" && tipos.length === 0) {
      return setFalha({ indice, mensagem: "Marque ao menos um envio para usar este contato." });
    }
    if (!admin && tipos.length > 0 && temOsDoisCanais(contato) && !contato.canal) {
      alterar(chave, { semCanal: true });
      return focar(`contatos.${indice}.canal`);
    }
    await gravar(indice, contato, tipos);
  };

  const disponiveis = contatos.flatMap((contato, indice) =>
    contato.id && !visivel(indice) ? [{ indice, contato, id: contato.id }] : [],
  );

  const onEscolherExistente = (indiceDaLinha: number, contatoId: string) => {
    const alvo = disponiveis.find((d) => d.id === contatoId);
    if (!alvo) return;
    const chave = chaveDe(alvo.indice);
    instantaneos.current[chave] = instantaneoDe({ ...alvo.contato, canal: "" }, []);
    setValue(`contatos.${alvo.indice}.tipos`, []);
    setValue(`contatos.${alvo.indice}.canal`, "");
    alterar(chave, { adotado: "novo", aberta: true });
    const novoIndice = alvo.indice > indiceDaLinha ? alvo.indice - 1 : alvo.indice;
    remover(indiceDaLinha);
    focar(`contatos.${novoIndice}.tipo-todos`);
  };

  const onSairDoTelefone = (indice: number) => {
    const contato = getValues(`contatos.${indice}`);
    if (!contato || salvo(indice)) return;
    alterar(chaveDe(indice), { verificado: chaveDoTelefone(contato.telefone) ?? "" });
  };

  const numeroRepetido = (indice: number) => {
    if (salvo(indice) || !editando(indice)) return undefined;
    return numeroRepetidoDaLinha({
      contatos,
      indice,
      verificado: daLinha(chaveDe(indice)).verificado,
      admin,
      naLista: visivel,
      onUsar: (contatoId) => onEscolherExistente(indice, contatoId),
    });
  };

  const existentes = (indice: number) => {
    if (admin || salvo(indice)) return undefined;
    return existentesDaLinha({
      disponiveis,
      contato: contatos[indice],
      escolheuNovo: Boolean(daLinha(chaveDe(indice)).novo),
      onEscolher: (contatoId) => onEscolherExistente(indice, contatoId),
      onNovo: () => alterar(chaveDe(indice), { novo: true }),
    });
  };

  const envios = (indice: number) => {
    const contato = contatos[indice];
    if (admin || !contato) return undefined;
    return enviosDaLinha({
      contato,
      opcoes,
      destinos,
      semCanal: Boolean(daLinha(chaveDe(indice)).semCanal),
      onMudarCanal: (valor) => {
        setValue(`contatos.${indice}.canal`, valor);
        alterar(chaveDe(indice), { semCanal: false });
      },
      onAlternar: (valor) =>
        setValue(
          `contatos.${indice}.tipos`,
          tiposAposAlternar(
            tiposDa(indice),
            valor,
            opcoes.map((o) => o.valor),
          ),
        ),
    });
  };

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
    rotuloDaLixeira: (indice: number) =>
      editavel(indice) ? undefined : `Deixar de usar o contato ${numero(indice)}`,
    onRemover: (indice: number) =>
      editavel(indice) ? remover(indice) : perguntarSeDeixaDeUsar(indice),
    confirmacaoDeRemocao: (indice: number) =>
      daLinha(chaveDe(indice)).confirmando
        ? {
            texto: TEXTO_DA_CONFIRMACAO,
            onConfirmar: () => void deixarDeUsar(indice),
            onCancelar: () => manterOContato(indice),
          }
        : undefined,
    existentes,
    envios,
    numeroRepetido,
    onSairDoTelefone,
    aviso,
    avisoVez,
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
