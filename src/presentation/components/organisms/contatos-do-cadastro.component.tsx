import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import type { EnviosDaLinha } from "@/presentation/components/molecules/envios-do-contato.component";
import type { ExistentesDaLinha } from "@/presentation/components/molecules/escolha-de-contato.component";
import {
  LinhaDeContato,
  type ConfirmacaoDeRemocao,
  type NumeroRepetidoDaLinha,
} from "@/presentation/components/molecules/linha-de-contato.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

export type AcoesDasLinhasDeContato = {
  editando: (indice: number) => boolean;
  salvo: (indice: number) => boolean;
  salvando: number | null;
  camposTravados: (indice: number) => boolean;
  rotuloDaLixeira: (indice: number) => string | undefined;
  onRemover: (indice: number) => void;
  confirmacaoDeRemocao: (indice: number) => ConfirmacaoDeRemocao | undefined;
  envios: (indice: number) => EnviosDaLinha | undefined;
  existentes: (indice: number) => ExistentesDaLinha | undefined;
  numeroRepetido: (indice: number) => NumeroRepetidoDaLinha | undefined;
  onSairDoTelefone: (indice: number) => void;
  visivel: (indice: number) => boolean;
  numero: (indice: number) => number;
  aviso?: string;
  avisoVez?: number;
  erroDaLinha: (indice: number) => string | undefined;
  onEditar: (indice: number) => void;
  onSalvar: (indice: number) => void;
  onCancelar: (indice: number) => void;
  motivoDoBloqueio?: string;
};

type ContatosDoCadastroProps = {
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  readOnly: boolean;
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="pointer-coarse:h-11"
            onClick={onAdicionar}
          >
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
                numeroRepetido={linhas.numeroRepetido(indice)}
                somenteLeitura={readOnly}
                nome={register(`contatos.${indice}.nome`)}
                telefone={{
                  name,
                  value,
                  ref,
                  onBlur: () => {
                    onBlur();
                    linhas.onSairDoTelefone(indice);
                  },
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
                confirmacaoDeRemocao={linhas.confirmacaoDeRemocao(indice)}
                erroDaLinha={linhas.erroDaLinha(indice)}
                envios={readOnly ? undefined : linhas.envios(indice)}
                onEditar={() => linhas.onEditar(indice)}
                onSalvar={() => linhas.onSalvar(indice)}
                onCancelar={() => linhas.onCancelar(indice)}
                onRemover={readOnly ? undefined : () => linhas.onRemover(indice)}
              />
            )}
          />
        ),
      )}
      <Texto variante="nota" aria-live="polite" className="sr-only">
        {linhas.aviso}
        {(linhas.avisoVez ?? 0) % 2 === 1 && "​"}
      </Texto>
      {errors.contatos && typeof errors.contatos.message === "string" && (
        <FieldError>{errors.contatos.message}</FieldError>
      )}
    </Pilha>
  );
}
