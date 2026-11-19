import { useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { mensagemDaFalha } from "@/presentation/lib/mensagem-da-falha";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional.schema";
import { definirTiposDoContatoAction } from "./tipos-de-envio.actions";
import {
  avisoDeCanalPerdido,
  avisoDeContatoDeOutroSetor,
  opcoesDeTipos,
} from "./tipos-de-envio.presenter";

type Parametros = {
  clienteId: string;
  form: UseFormReturn<EditarCadastroOperacionalFormValues>;
  // Os Destinos do Setor como vieram do servidor (para o aviso de canal perdido) e o catálogo de tipos.
  destinos: { contatoId: string; tipo: string | null; canal: string }[];
  tiposDeEnvio: { slug: string; rotulo: string }[];
  // O Setor da tela e quem a abriu: o Admin não tem Setor (só cadastra contatos); o Setor define o que
  // cada contato recebe dele e edita só os contatos que cadastrou.
  setorDoCadastro: string;
  admin: boolean;
};

// A mesma ação repetida não muda o texto e o leitor de tela não a anunciaria de novo.
const ESPACO_ALTERNADO = " ";

// Os checkboxes "Recebe" de cada linha de contato: marcar grava na hora (como o "Salvar" da linha), e o
// contato novo grava os seus junto com o Salvar da linha (use-contatos-da-linha).
export function useEnviosDosContatos({
  clienteId,
  form,
  destinos,
  tiposDeEnvio,
  setorDoCadastro,
  admin,
}: Parametros) {
  const { getValues, setValue } = form;
  const contatos = useWatch({ control: form.control, name: "contatos" }) ?? [];
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [falha, setFalha] = useState<{ indice: number; mensagem: string } | null>(null);
  const [anuncio, setAnuncio] = useState({ texto: "", vez: 0 });
  const opcoes = opcoesDeTipos(tiposDeEnvio);
  const ator = { admin, setorDoCadastro };

  const alternar = async (indice: number, valor: string) => {
    if (ocupado !== null) return;
    const id = getValues(`contatos.${indice}.id`);
    // Contato ainda não salvo: os checkboxes esperam o "Salvar contato" da linha.
    if (!id) return;
    const atuais = getValues(`contatos.${indice}.tipos`) ?? [];
    const novos = atuais.includes(valor) ? atuais.filter((t) => t !== valor) : [...atuais, valor];
    setFalha(null);
    setValue(`contatos.${indice}.tipos`, novos);
    setOcupado(indice);
    try {
      const resultado = await definirTiposDoContatoAction({
        clienteId,
        contatoId: id,
        tipos: novos,
      });
      if (!resultado.ok) throw new Error(resultado.error.message);
      const rotulo = opcoes.find((o) => o.valor === valor)?.rotulo ?? valor;
      setAnuncio((a) => ({
        texto: `${rotulo} ${novos.includes(valor) ? "marcado" : "desmarcado"} no contato ${indice + 1}.`,
        vez: a.vez + 1,
      }));
    } catch (erro) {
      setValue(`contatos.${indice}.tipos`, atuais);
      setFalha({ indice, mensagem: erro instanceof Error ? erro.message : mensagemDaFalha(erro) });
    } finally {
      setOcupado(null);
    }
  };

  return {
    // Os checkboxes: só o Setor os tem (o Admin não define o que cada Setor envia).
    enviosDoContato: (indice: number) => {
      const contato = contatos[indice];
      if (admin || !contato) return undefined;
      return {
        opcoes,
        marcados: contato.tipos ?? [],
        ocupado: ocupado !== null,
        // Linha ainda não salva: os checkboxes esperam o "Salvar contato".
        semContatoSalvo: !contato.id,
        aviso:
          (falha?.indice === indice ? falha.mensagem : undefined) ??
          avisoDeCanalPerdido(destinos, contato),
        onAlternar: (valor: string) => void alternar(indice, valor),
      };
    },
    contatoDoutroSetor: (indice: number) => {
      const contato = contatos[indice];
      return contato && avisoDeContatoDeOutroSetor(contato, ator);
    },
    aviso: anuncio.texto && anuncio.texto + (anuncio.vez % 2 ? ESPACO_ALTERNADO : ""),
  };
}
