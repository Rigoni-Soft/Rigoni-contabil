import { type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { AcoesDoFormulario } from "@/presentation/components/molecules/acoes-do-formulario.component";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";
import { cn } from "@/presentation/lib/utils";

import { CabecalhoDoCadastro } from "./cabecalho-do-cadastro.component";
import { ContatosDoCadastro } from "./contatos-do-cadastro.component";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

type EditarCadastroRhFormProps = {
  cabecalho: { empresa: string; cnpj: string };
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  erroServidor?: string;
  sucesso?: boolean;
  // Até hidratar, os campos (não controlados) ainda não têm os valores: oculto sem sair do layout.
  oculto?: boolean;
  contatos: { id: string }[];
  onAdicionarContato: () => void;
  onRemoverContato: (indice: number) => void;
  onLimpar: () => void;
  // Cartão do documento contratual com "Abrir em nova aba" (só leitura).
  documentoContratual?: React.ReactNode;
  // O Responsável do RH: um campo do cabeçalho, na mesma coluna do SN.
  responsavel?: React.ReactNode;
  // O acompanhamento do mês: uma seção do próprio cartão, depois do cabeçalho.
  acompanhamento?: React.ReactNode;
};

// O cadastro do Cliente no RH: o mesmo desenho do cadastro operacional do SN, com o que é do RH (as
// observações gerais do RH) e o que é de todos os Setores (os contatos); o que é do SN não aparece.
export function EditarCadastroRhForm({
  cabecalho,
  register,
  control,
  errors,
  onSubmit,
  pendente,
  readOnly,
  erroServidor,
  sucesso,
  oculto,
  contatos,
  onAdicionarContato,
  onRemoverContato,
  onLimpar,
  documentoContratual,
  responsavel,
  acompanhamento,
}: EditarCadastroRhFormProps) {
  return (
    <Pilha
      espaco="formulario"
      como="form"
      onSubmit={onSubmit}
      className={cn(
        "rc-guilloche-frame rounded-lg border border-border bg-card p-5 shadow-sm",
        oculto && "rc-oculto-ate-hidratar",
      )}
    >
      {!readOnly && <NotaDeObrigatorio />}

      <CabecalhoDoCadastro cabecalho={cabecalho} documentoContratual={documentoContratual}>
        {responsavel && <Caixa className="lg:col-start-4">{responsavel}</Caixa>}
      </CabecalhoDoCadastro>

      {acompanhamento}

      <Grade colunas="1>2>4" como="fieldset" disabled={readOnly || pendente} className="gap-4">
        <ContatosDoCadastro
          register={register}
          control={control}
          errors={errors}
          readOnly={readOnly}
          contatos={contatos}
          onAdicionar={onAdicionarContato}
          onRemover={onRemoverContato}
        />

        <Pilha espaco={1} className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor="observacoesGerais">Observações gerais do RH</Label>
          <Textarea id="observacoesGerais" {...register("observacoesGerais")} rows={3} />
          {errors.observacoesGerais?.message && (
            <FieldError>{errors.observacoesGerais.message}</FieldError>
          )}
        </Pilha>

        {!readOnly && <AcoesDoFormulario pendente={pendente} onLimpar={onLimpar} />}
      </Grade>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {sucesso && <AvisoDeStatus tipo="sucesso" texto="Cadastro do RH atualizado." />}
    </Pilha>
  );
}
