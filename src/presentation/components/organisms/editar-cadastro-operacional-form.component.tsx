import { type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { AcoesDoFormulario } from "@/presentation/components/molecules/acoes-do-formulario.component";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";
import { cn } from "@/presentation/lib/utils";
import type { DasStatusValor } from "@/shared/kernel/das-status";
import type { DocumentoObrigatorioStatusValor } from "@/shared/kernel/documento-obrigatorio-status";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";

import { CabecalhoDoCadastro, type CabecalhoCliente } from "./cabecalho-do-cadastro.component";
import { ContatosDoCadastro } from "./contatos-do-cadastro.component";
import { DasDoCadastro } from "./das-do-cadastro.component";
import {
  ParcelamentosDoCadastro,
  type LeituraDaLinha,
  type ParcelamentoLinha,
} from "./parcelamentos-do-cadastro.component";
import { ResponsavelDoCadastro, type ResponsavelCampo } from "./responsavel-do-cadastro.component";

export type { LeituraDaLinha, ParcelamentoLinha };

// View global não importa módulos (arquitetura.md §3.4) — o shape espelha
// EditarCadastroOperacionalFormValues (módulo clientes) por estrutura, não
// por import; o Container (dentro do módulo) garante a compatibilidade.
export type EditarCadastroOperacionalFormValues = {
  formaEnvio: FormaEnvioValor;
  contatos: { id?: string; nome: string; telefone: string; padrao: boolean }[];
  documentoObrigatorio: DocumentoObrigatorioStatusValor | null;
  dasStatus: DasStatusValor | null;
  dataEnvioDas: string | null;
  parcelamentos: ParcelamentoLinha[];
  observacoesGerais: string;
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  // "" = Sem responsável.
  responsavelId: string;
};

type Opcao = { valor: string; rotulo: string };

type EditarCadastroOperacionalFormProps = {
  cabecalho: CabecalhoCliente;
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  responsavel: ResponsavelCampo;
  // Linhas atuais do formulário (acompanham a edição): resumo "Sim (n)", selo e nome do PDF.
  parcelamentos: ParcelamentoLinha[];
  // DAS já `enviado` pelo sistema: a opção aparece só pra exibir o valor atual.
  dasEnviadoPeloSistema: boolean;
  // Opções dos selects de status (valor/rótulo), vindas do Container (dado de domínio fora da View).
  opcoes: { formaEnvio: Opcao[]; documento: Opcao[]; das: Opcao[] };
  erroServidor?: string;
  sucesso?: boolean;
  // Até hidratar, os campos (não controlados) ainda não têm os valores: o HTML do servidor mostraria
  // placeholders no lugar do dado. Oculto sem sair do layout (e revelado após 3 s se a hidratação falhar), aparece já preenchido.
  oculto?: boolean;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  contatos: { id: string }[];
  onAdicionarContato: () => void;
  onRemoverContato: (indice: number) => void;
  parcelamentoCampos: { id: string }[];
  onAdicionarParcelamento: () => void;
  onRemoverParcelamento: (indice: number) => void;
  // Leitura do PDF por linha (chave = id do campo do useFieldArray). Com leitura em andamento o
  // Salvar fica desabilitado; o PDF escolhido (ou removido) volta ao Container para ser lido.
  leituras: Record<string, LeituraDaLinha>;
  onArquivoEscolhido: (indice: number, arquivo: File | undefined) => void;
  onLimpar: () => void;
  // Sem callback (uso em /clientes/[id]): "Cancelar" navega pro mesmo destino
  // do "Voltar" do topo. Com callback (uso inline na busca do dashboard):
  // já está em "/" — um <Link href="/"> não dispara navegação nem reseta nada,
  // então o Container que abriu o form inline fecha o painel diretamente.
  onCancelar?: () => void;
  // Cartão do documento contratual com "Abrir em nova aba" (só leitura); ausente = ator sem acesso.
  documentoContratual?: React.ReactNode;
  // Guias mensais de um Parcelamento PGFN já salvo: o Container monta a região (ela tem estado próprio).
  // `codigo` nomeia a região de cada Parcelamento para o leitor de tela.
  guiasDaParcela?: (parcelamentoId: string, codigo: string, interno: boolean) => React.ReactNode;
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
  onRemoverContato,
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
        <ResponsavelDoCadastro
          responsavel={responsavel}
          select={register("responsavelId")}
          desabilitado={pendente}
        />
      </CabecalhoDoCadastro>

      <Grade colunas="1>2>4" como="fieldset" disabled={readOnly || pendente} className="gap-4">
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
          <Label htmlFor="observacoesGerais">Observações gerais</Label>
          <Textarea id="observacoesGerais" {...register("observacoesGerais")} rows={3} />
        </Pilha>

        {!readOnly && (
          <AcoesDoFormulario
            pendente={pendente}
            motivoDoBloqueio={
              Object.values(leituras).some((l) => l.estado === "lendo")
                ? "Aguarde a leitura do PDF para salvar."
                : undefined
            }
            onLimpar={onLimpar}
            onCancelar={onCancelar}
          />
        )}
      </Grade>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {sucesso && <AvisoDeStatus tipo="sucesso" texto="Cadastro operacional atualizado." />}
    </Pilha>
  );
}
