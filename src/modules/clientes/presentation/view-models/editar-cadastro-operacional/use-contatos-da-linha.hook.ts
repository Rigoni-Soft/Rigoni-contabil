import { useState } from "react";
import {
  useWatch,
  type Control,
  type UseFormClearErrors,
  type UseFormGetValues,
  type UseFormSetError,
  type UseFormSetValue,
} from "react-hook-form";

import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { contatoNovo } from "./editar-cadastro-operacional.presenter";
import {
  contatoSchema,
  type EditarCadastroOperacionalFormValues as Valores,
} from "./editar-cadastro-operacional.schema";
import { salvarContatoAction } from "./salvar-contato.actions";

type Params = {
  clienteId: string;
  control: Control<Valores>;
  getValues: UseFormGetValues<Valores>;
  setValue: UseFormSetValue<Valores>;
  setError: UseFormSetError<Valores>;
  clearErrors: UseFormClearErrors<Valores>;
};

// As ações por linha de contato: uma linha sem `id` é nova (ainda não está na tabela) e tem Salvar e
// Cancelar; com `id` já está salva e tem a lixeira. Salvar grava só aquele contato e dá o `id` à linha.
export function useContatosDaLinha({
  clienteId,
  control,
  getValues,
  setValue,
  setError,
  clearErrors,
}: Params) {
  const contatos = useWatch({ control, name: "contatos" });
  const [salvando, setSalvando] = useState<number | null>(null);
  const [falha, setFalha] = useState<{ indice: number; mensagem: string } | null>(null);
  // Lido pelo leitor de tela (região aria-live): o sucesso não tem outro sinal além da troca dos botões.
  // Repetir a mesma ação não mudaria o texto e não seria anunciado de novo; por isso cada anúncio
  // alterna um espaço invisível no fim.
  const [anuncio, setAnuncio] = useState({ texto: "", vez: 0 });
  const anunciar = (texto: string) => setAnuncio((atual) => ({ texto, vez: atual.vez + 1 }));
  const aviso = anuncio.texto && anuncio.texto + (anuncio.vez % 2 ? " " : "");

  // Os botões somem da tela ao salvar/cancelar: o foco volta ao Nome da própria linha, que sempre existe.
  const focarNome = (indice: number) => document.getElementById(`contatos.${indice}.nome`)?.focus();

  const salvarLinha = async (indice: number) => {
    const contato = getValues(`contatos.${indice}`);
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    const valido = contatoSchema.safeParse(contato);
    if (!valido.success) {
      for (const problema of valido.error.issues) {
        const campo = String(problema.path[0] ?? "nome") as "nome" | "telefone" | "email";
        setError(`contatos.${indice}.${campo}`, { message: problema.message });
      }
      return;
    }
    setSalvando(indice);
    try {
      const resultado = await salvarContatoAction({
        clienteId,
        contato: { nome: contato.nome, telefone: contato.telefone, email: contato.email },
      });
      if (resultado.ok) {
        setValue(`contatos.${indice}.id`, resultado.data.id);
        anunciar(`Contato ${indice + 1} salvo.`);
        focarNome(indice);
      } else setFalha({ indice, mensagem: resultado.error.message });
    } catch (erro) {
      console.error("Falha ao salvar o contato", erro);
      setFalha({ indice, mensagem: mensagemDaFalha(erro) });
    } finally {
      setSalvando(null);
    }
  };

  // Volta a linha ao estado padrão (campos vazios), sem tocar nas outras.
  const cancelarLinha = (indice: number) => {
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    setValue(`contatos.${indice}`, contatoNovo());
    anunciar(`Contato ${indice + 1} limpo.`);
    focarNome(indice);
  };

  return {
    salvos: (contatos ?? []).map((contato) => Boolean(contato?.id)),
    salvando,
    aviso,
    erroDaLinha: (indice: number) => (falha?.indice === indice ? falha.mensagem : undefined),
    salvarLinha,
    cancelarLinha,
  };
}
