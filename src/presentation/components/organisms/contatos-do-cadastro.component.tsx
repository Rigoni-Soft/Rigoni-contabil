import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  LinhaDeContato,
  type EnviosDaLinha,
} from "@/presentation/components/molecules/linha-de-contato.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

// Linha sem `id` é nova (Salvar/Limpar); com `id` já está salva (lixeira).
export type AcoesDasLinhasDeContato = {
  salvos: boolean[];
  salvando: number | null;
  // Confirmação dita ao leitor de tela ("Contato 1 salvo."), já que salvar só troca os botões.
  aviso?: string;
  erroDaLinha: (indice: number) => string | undefined;
  onSalvar: (indice: number) => void;
  onLimpar: (indice: number) => void;
};

type ContatosDoCadastroProps = {
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  readOnly: boolean;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  contatos: { id: string }[];
  onAdicionar: () => void;
  onRemover: (indice: number) => void;
  linhas: AcoesDasLinhasDeContato;
  // Contato de outro Setor: nome, WhatsApp e e-mail ficam só de leitura. Sem isso, é editável.
  doutroSetor?: (indice: number) => boolean;
  // O que o contato recebe (checkboxes da linha); ausente quando o ator não define envios.
  envios?: (indice: number) => EnviosDaLinha | undefined;
};

export function ContatosDoCadastro({
  register,
  control,
  errors,
  readOnly,
  contatos,
  onAdicionar,
  onRemover,
  linhas,
  doutroSetor,
  envios,
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
      {contatos.map((campo, indice) => (
        <Controller
          key={campo.id}
          control={control}
          name={`contatos.${indice}.telefone`}
          render={({ field: { onChange, onBlur, value, name, ref } }) => (
            <LinhaDeContato
              indice={indice}
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
              salvo={linhas.salvos[indice]}
              salvando={linhas.salvando === indice}
              erroDaLinha={linhas.erroDaLinha(indice)}
              onSalvar={() => linhas.onSalvar(indice)}
              onLimpar={() => linhas.onLimpar(indice)}
              doutroSetor={doutroSetor?.(indice)}
              envios={readOnly ? undefined : envios?.(indice)}
              onRemover={readOnly ? undefined : () => onRemover(indice)}
            />
          )}
        />
      ))}
      <Texto variante="nota" aria-live="polite" className="sr-only">
        {linhas.aviso}
      </Texto>
      {errors.contatos && typeof errors.contatos.message === "string" && (
        <FieldError>{errors.contatos.message}</FieldError>
      )}
    </Pilha>
  );
}
