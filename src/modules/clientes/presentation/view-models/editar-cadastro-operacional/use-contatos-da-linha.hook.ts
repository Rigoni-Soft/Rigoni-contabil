import { useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import { contatoNovo } from "./editar-cadastro-operacional.presenter";
import {
  contatoSchema,
  type EditarCadastroOperacionalFormValues,
} from "./editar-cadastro-operacional.schema";
import { salvarContatoAction } from "./salvar-contato.actions";

type ParametrosDeContatosDaLinha = Pick<
  UseFormReturn<EditarCadastroOperacionalFormValues>,
  "control" | "getValues" | "setValue" | "setError" | "clearErrors"
> & { clienteId: string };

// A mesma ação repetida não muda o texto e o leitor de tela não a anunciaria de novo; o espaço no fim alterna.
const ESPACO_ALTERNADO = " ";

export function useContatosDaLinha({
  clienteId,
  control,
  getValues,
  setValue,
  setError,
  clearErrors,
}: ParametrosDeContatosDaLinha) {
  const contatos = useWatch({ control, name: "contatos" });
  const [salvando, setSalvando] = useState<number | null>(null);
  const [falha, setFalha] = useState<{ indice: number; mensagem: string } | null>(null);
  const [anuncio, setAnuncio] = useState({ texto: "", vez: 0 });
  const anunciar = (texto: string) => setAnuncio((atual) => ({ texto, vez: atual.vez + 1 }));
  const aviso = anuncio.texto && anuncio.texto + (anuncio.vez % 2 ? ESPACO_ALTERNADO : "");

  const focarNome = (indice: number) => document.getElementById(`contatos.${indice}.nome`)?.focus();

  const onSalvar = async (indice: number) => {
    if (salvando !== null) return;
    const contato = getValues(`contatos.${indice}`);
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    const valido = contatoSchema.safeParse(contato);
    if (!valido.success) {
      valido.error.issues.forEach((problema, posicao) => {
        const campo = String(problema.path[0] ?? "nome") as "nome" | "telefone" | "email";
        setError(
          `contatos.${indice}.${campo}`,
          { message: problema.message },
          { shouldFocus: posicao === 0 },
        );
      });
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

  const onLimpar = (indice: number) => {
    setFalha(null);
    clearErrors(`contatos.${indice}`);
    setValue(`contatos.${indice}`, contatoNovo());
    anunciar(`Contato ${indice + 1} limpo.`);
    focarNome(indice);
  };

  // Já no formato `AcoesDasLinhasDeContato` que os Containers repassam ao formulário.
  return {
    salvos: (contatos ?? []).map((contato) => Boolean(contato?.id)),
    salvando,
    aviso,
    erroDaLinha: (indice: number) => (falha?.indice === indice ? falha.mensagem : undefined),
    onSalvar,
    onLimpar,
  };
}
