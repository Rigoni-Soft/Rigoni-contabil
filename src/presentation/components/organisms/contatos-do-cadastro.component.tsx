import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { LinhaDeContato } from "@/presentation/components/molecules/linha-de-contato.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

type ContatosDoCadastroProps = {
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  readOnly: boolean;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  contatos: { id: string }[];
  onAdicionar: () => void;
  onRemover: (indice: number) => void;
};

export function ContatosDoCadastro({
  register,
  control,
  errors,
  readOnly,
  contatos,
  onAdicionar,
  onRemover,
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
      {contatos.map((campo, indice) => (
        <Controller
          key={campo.id}
          control={control}
          name={`contatos.${indice}.telefone`}
          render={({ field: { onChange, onBlur, value, name } }) => (
            <LinhaDeContato
              indice={indice}
              somenteLeitura={readOnly}
              nome={register(`contatos.${indice}.nome`)}
              // Sem `ref` (Input não usa forwardRef): só perde o foco automático em erro.
              telefone={{
                name,
                value,
                onBlur,
                onChange: (evento) => onChange(formatarTelefone(evento.target.value)),
              }}
              padrao={register(`contatos.${indice}.padrao`)}
              erroNome={errors.contatos?.[indice]?.nome?.message}
              erroTelefone={errors.contatos?.[indice]?.telefone?.message}
              onRemover={readOnly ? undefined : () => onRemover(indice)}
            />
          )}
        />
      ))}
      {errors.contatos && typeof errors.contatos.message === "string" && (
        <FieldError>{errors.contatos.message}</FieldError>
      )}
    </Pilha>
  );
}
