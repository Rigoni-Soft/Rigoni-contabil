import { type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { AcoesDoFormulario } from "@/presentation/components/molecules/acoes-do-formulario.component";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";

import type { CabecalhoCliente } from "./cabecalho-do-cadastro.component";
import { CartaoDoCadastro } from "./cartao-do-cadastro.component";
import { ContatosDoCadastro } from "./contatos-do-cadastro.component";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";
import {
  motivoDeLeituraEmAndamento,
  ParcelamentosDoCadastro,
  type ParcelamentosProps,
} from "./parcelamentos-do-cadastro.component";

type EditarCadastroRhFormProps = ParcelamentosProps & {
  cabecalho: CabecalhoCliente;
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
  // O mês do acompanhamento: o cabeçalho do cartão, logo depois da nota de obrigatórios.
  mesDoAcompanhamento?: React.ReactNode;
  // Os serviços do mês: uma seção do próprio cartão, depois do cabeçalho do cadastro.
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
  parcelamentos,
  parcelamentoCampos,
  onAdicionarParcelamento,
  onRemoverParcelamento,
  leituras,
  onArquivoEscolhido,
  guiasDaParcela,
  onLimpar,
  documentoContratual,
  responsavel,
  mesDoAcompanhamento,
  acompanhamento,
}: EditarCadastroRhFormProps) {
  return (
    <CartaoDoCadastro
      cabecalho={cabecalho}
      onSubmit={onSubmit}
      pendente={pendente}
      readOnly={readOnly}
      oculto={oculto}
      mesDoAcompanhamento={mesDoAcompanhamento}
      documentoContratual={documentoContratual}
      responsavel={responsavel}
      acompanhamento={acompanhamento}
      acoes={
        <AcoesDoFormulario
          pendente={pendente}
          motivoDoBloqueio={motivoDeLeituraEmAndamento(leituras)}
          onLimpar={onLimpar}
        />
      }
      erroServidor={erroServidor}
      sucesso={
        sucesso && <AvisoDeStatus tipo="sucesso" legivel texto="Cadastro do RH atualizado." />
      }
    >
      <ContatosDoCadastro
        register={register}
        control={control}
        errors={errors}
        readOnly={readOnly}
        contatos={contatos}
        onAdicionar={onAdicionarContato}
        onRemover={onRemoverContato}
      />

      <ParcelamentosDoCadastro
        register={register}
        control={control}
        errors={errors}
        readOnly={readOnly}
        parcelamentos={parcelamentos}
        parcelamentoCampos={parcelamentoCampos}
        onAdicionar={onAdicionarParcelamento}
        onRemover={onRemoverParcelamento}
        leituras={leituras}
        onArquivoEscolhido={onArquivoEscolhido}
        guiasDaParcela={guiasDaParcela}
      />

      <Pilha espaco={1} className="sm:col-span-2 lg:col-span-4">
        <Label htmlFor="observacoesGerais">Observações gerais do RH</Label>
        <Textarea id="observacoesGerais" {...register("observacoesGerais")} rows={3} />
        {errors.observacoesGerais?.message && (
          <FieldError>{errors.observacoesGerais.message}</FieldError>
        )}
      </Pilha>
    </CartaoDoCadastro>
  );
}
