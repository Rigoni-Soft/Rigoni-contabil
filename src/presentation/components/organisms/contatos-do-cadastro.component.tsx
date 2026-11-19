import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  LinhaDeContato,
  type EnviosDaLinha,
  type ExistentesDaLinha,
} from "@/presentation/components/molecules/linha-de-contato.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

// O que cada linha de contato faz (montado no Container): editar, salvar e cancelar a linha, e o que ela
// mostra de si. Linha sem `id` é nova e já nasce em edição.
export type AcoesDasLinhasDeContato = {
  editando: (indice: number) => boolean;
  salvo: (indice: number) => boolean;
  salvando: number | null;
  // Contato de outro Setor: nome, WhatsApp e e-mail só de leitura (os envios seguem do Setor).
  camposTravados: (indice: number) => boolean;
  // Só o Setor dono e o Admin removem o contato.
  podeRemover: (indice: number) => boolean;
  // Nome da lixeira quando o contato é de outro dono ("Deixar de usar…"); sem texto, "Remover contato N".
  rotuloDaLixeira: (indice: number) => string | undefined;
  // O dono remove o contato (o Salvar do cadastro persiste); quem só o usa deixa de usá-lo na hora.
  onRemover: (indice: number) => void;
  // O que o contato recebe do Setor; ausente quando o ator não define envios (Admin).
  envios: (indice: number) => EnviosDaLinha | undefined;
  // Linha nova do Setor: os contatos de outros Setores que ele pode escolher em vez de digitar um novo.
  existentes: (indice: number) => ExistentesDaLinha | undefined;
  // Contato de outro Setor que o Setor ainda não usa não aparece na lista; a numeração só conta os visíveis.
  visivel: (indice: number) => boolean;
  numero: (indice: number) => number;
  // Confirmação dita ao leitor de tela ("Contato 1 salvo."), já que salvar só troca os botões.
  aviso?: string;
  erroDaLinha: (indice: number) => string | undefined;
  onEditar: (indice: number) => void;
  onSalvar: (indice: number) => void;
  onCancelar: (indice: number) => void;
  // Enquanto uma linha está em edição, o Salvar do cadastro espera (senão o que se digitou nela, e os envios, se perderia).
  motivoDoBloqueio?: string;
};

type ContatosDoCadastroProps = {
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  readOnly: boolean;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  contatos: { id: string }[];
  onAdicionar: () => void;
  linhas: AcoesDasLinhasDeContato;
};

export function ContatosDoCadastro({
  register,
  control,
  errors,
  readOnly,
  contatos,
  onAdicionar,
  linhas,
}: ContatosDoCadastroProps) {
  return (
    <Pilha espaco={3} className="sm:col-span-2 lg:col-span-4">
      <Linha alinhar="centro" justificar="entre" espaco={4}>
        <Label className="block">Contatos</Label>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={onAdicionar}>
            <Plus className="size-4" aria-hidden="true" />
            Adicionar contato
          </Button>
        )}
      </Linha>
      {!readOnly && (
        <Texto variante="nota">Em cada contato, informe ao menos o WhatsApp ou o e-mail.</Texto>
      )}
      {contatos.map((campo, indice) =>
        !linhas.visivel(indice) ? null : (
          <Controller
            key={campo.id}
            control={control}
            name={`contatos.${indice}.telefone`}
            render={({ field: { onChange, onBlur, value, name, ref } }) => (
              <LinhaDeContato
                indice={indice}
                numero={linhas.numero(indice)}
                existentes={linhas.existentes(indice)}
                somenteLeitura={readOnly}
                nome={register(`contatos.${indice}.nome`)}
                telefone={{
                  name,
                  value,
                  ref,
                  onBlur,
                  onChange: (evento) => onChange(formatarTelefone(evento.target.value)),
                }}
                email={register(`contatos.${indice}.email`)}
                erroNome={errors.contatos?.[indice]?.nome?.message}
                erroTelefone={errors.contatos?.[indice]?.telefone?.message}
                erroEmail={errors.contatos?.[indice]?.email?.message}
                editando={linhas.editando(indice)}
                salvo={linhas.salvo(indice)}
                salvando={linhas.salvando === indice}
                camposTravados={linhas.camposTravados(indice)}
                rotuloDaLixeira={linhas.rotuloDaLixeira(indice)}
                erroDaLinha={linhas.erroDaLinha(indice)}
                envios={readOnly ? undefined : linhas.envios(indice)}
                onEditar={() => linhas.onEditar(indice)}
                onSalvar={() => linhas.onSalvar(indice)}
                onCancelar={() => linhas.onCancelar(indice)}
                onRemover={
                  readOnly || !linhas.podeRemover(indice)
                    ? undefined
                    : () => linhas.onRemover(indice)
                }
              />
            )}
          />
        ),
      )}
      <Texto variante="nota" aria-live="polite" className="sr-only">
        {linhas.aviso}
      </Texto>
      {errors.contatos && typeof errors.contatos.message === "string" && (
        <FieldError>{errors.contatos.message}</FieldError>
      )}
    </Pilha>
  );
}
