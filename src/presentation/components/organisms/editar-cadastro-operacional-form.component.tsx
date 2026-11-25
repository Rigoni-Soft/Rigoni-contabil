import { type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { AcoesDoFormulario } from "@/presentation/components/molecules/acoes-do-formulario.component";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";
import type { DasStatusValor } from "@/shared/kernel/das-status";
import type { DocumentoObrigatorioStatusValor } from "@/shared/kernel/documento-obrigatorio-status";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";

import type { CabecalhoCliente } from "./cabecalho-do-cadastro.component";
import { CartaoDoCadastro } from "./cartao-do-cadastro.component";
import { ContatosDoCadastro, type AcoesDasLinhasDeContato } from "./contatos-do-cadastro.component";
import { DasDoCadastro } from "./das-do-cadastro.component";
import {
  motivoDeLeituraEmAndamento,
  ParcelamentosDoCadastro,
  type LeituraDaLinha,
  type ParcelamentoLinha,
  type ParcelamentosProps,
} from "./parcelamentos-do-cadastro.component";
import { ResponsavelDoCadastro, type ResponsavelCampo } from "./responsavel-do-cadastro.component";

export type { LeituraDaLinha, ParcelamentoLinha };

export type EditarCadastroOperacionalFormValues = {
  formaEnvio: FormaEnvioValor;
  contatos: {
    id?: string;
    nome: string;
    telefone: string;
    email: string;
    donoSetor?: string | null;
    tipos?: string[];
    canal?: string;
    setores?: readonly string[];
  }[];
  documentoObrigatorio: DocumentoObrigatorioStatusValor | null;
  dasStatus: DasStatusValor | null;
  dataEnvioDas: string | null;
  parcelamentos: ParcelamentoLinha[];
  observacoesGerais: string;
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  responsavelId: string;
};

type Opcao = { valor: string; rotulo: string };

type EditarCadastroOperacionalFormProps = ParcelamentosProps & {
  cabecalho: CabecalhoCliente;
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  responsavel: ResponsavelCampo;
  dasEnviadoPeloSistema: boolean;
  opcoes: { documento: Opcao[]; das: Opcao[] };
  erroServidor?: string;
  sucesso?: boolean;
  oculto?: boolean;
  contatos: { id: string }[];
  onAdicionarContato: () => void;
  linhasDeContato: AcoesDasLinhasDeContato;
  onLimpar: () => void;
  onCancelar?: () => void;
  documentoContratual?: React.ReactNode;
};

export function EditarCadastroOperacionalForm({
  cabecalho,
  register,
  control,
  errors,
  onSubmit,
  pendente,
  readOnly,
  responsavel,
  parcelamentos,
  dasEnviadoPeloSistema,
  opcoes,
  erroServidor,
  sucesso,
  oculto,
  contatos,
  onAdicionarContato,
  linhasDeContato,
  parcelamentoCampos,
  onAdicionarParcelamento,
  onRemoverParcelamento,
  leituras,
  onArquivoEscolhido,
  onLimpar,
  onCancelar,
  documentoContratual,
  guiasDaParcela,
}: EditarCadastroOperacionalFormProps) {
  return (
    <CartaoDoCadastro
      cabecalho={cabecalho}
      onSubmit={onSubmit}
      pendente={pendente}
      readOnly={readOnly}
      oculto={oculto}
      documentoContratual={documentoContratual}
      responsavel={
        <ResponsavelDoCadastro
          responsavel={responsavel}
          select={register("responsavelId")}
          desabilitado={pendente}
        />
      }
      acoes={
        <AcoesDoFormulario
          pendente={pendente}
          motivoDoBloqueio={
            motivoDeLeituraEmAndamento(leituras) ?? linhasDeContato.motivoDoBloqueio
          }
          onLimpar={onLimpar}
          onCancelar={onCancelar}
        />
      }
      erroServidor={erroServidor}
      sucesso={
        sucesso && <AvisoDeStatus tipo="sucesso" legivel texto="Cadastro operacional atualizado." />
      }
    >
      <DasDoCadastro
        register={register}
        opcoes={opcoes}
        dasEnviadoPeloSistema={dasEnviadoPeloSistema}
      />

      <ContatosDoCadastro
        register={register}
        control={control}
        errors={errors}
        readOnly={readOnly}
        contatos={contatos}
        onAdicionar={onAdicionarContato}
        linhas={linhasDeContato}
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
        <Label htmlFor="observacoesGerais">Observações gerais</Label>
        <Textarea id="observacoesGerais" {...register("observacoesGerais")} rows={3} />
      </Pilha>
    </CartaoDoCadastro>
  );
}
