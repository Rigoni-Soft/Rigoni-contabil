import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { AcoesDoFormulario } from "@/presentation/components/molecules/acoes-do-formulario.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { CampoResponsavel } from "@/presentation/components/molecules/campo-responsavel.component";
import { LinhaDeContato } from "@/presentation/components/molecules/linha-de-contato.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";
import { formatarTelefone } from "@/presentation/lib/telefone-mask";
import { DAS_STATUS_LABEL, DAS_STATUSES, type DasStatusValor } from "@/shared/kernel/das-status";
import {
  DOCUMENTO_OBRIGATORIO_STATUS_LABEL,
  DOCUMENTO_OBRIGATORIO_STATUSES,
  type DocumentoObrigatorioStatusValor,
} from "@/shared/kernel/documento-obrigatorio-status";
import { FORMA_ENVIO_LABEL, FORMAS_ENVIO, type FormaEnvioValor } from "@/shared/kernel/forma-envio";
import { SEM_RESPONSAVEL_LABEL } from "@/shared/kernel/papeis";
import {
  PARCELAMENTO_STATUS_LABEL,
  PARCELAMENTO_STATUSES,
  type ParcelamentoStatusValor,
} from "@/shared/kernel/parcelamento-status";
import { REGIME_LABEL } from "@/shared/kernel/regimes";

// Opções dos selects de status (valor/rótulo), montadas uma vez.
const opcoes = <T extends string>(valores: readonly T[], rotulos: Record<T, string>) =>
  valores.map((valor) => ({ valor, rotulo: rotulos[valor] }));
const OPCOES_FORMA_ENVIO = opcoes(FORMAS_ENVIO, FORMA_ENVIO_LABEL);
const OPCOES_DOCUMENTO = opcoes(DOCUMENTO_OBRIGATORIO_STATUSES, DOCUMENTO_OBRIGATORIO_STATUS_LABEL);
const OPCOES_DAS = opcoes(DAS_STATUSES, DAS_STATUS_LABEL);
const OPCOES_PARCELAMENTO = opcoes(PARCELAMENTO_STATUSES, PARCELAMENTO_STATUS_LABEL);

// View global não importa módulos (arquitetura.md §3.4) — o shape espelha
// EditarCadastroOperacionalFormValues (módulo clientes) por estrutura, não
// por import; o Container (dentro do módulo) garante a compatibilidade.
export type EditarCadastroOperacionalFormValues = {
  formaEnvio: FormaEnvioValor;
  contatos: { id?: string; nome: string; telefone: string; padrao: boolean }[];
  documentoObrigatorio: DocumentoObrigatorioStatusValor | null;
  dasStatus: DasStatusValor | null;
  dataEnvioDas: string | null;
  temParcelamento: boolean;
  parcelamentoStatus: ParcelamentoStatusValor | null;
  observacoesGerais: string;
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  // "" = Sem responsável (#65).
  responsavelId: string;
};

// Responsável (#65): só o Líder do SN edita (Select); os demais veem o nome.
type ResponsavelCampo = {
  editavel: boolean;
  nomeAtual: string;
  opcoes: { id: string; nome: string }[];
  // Lista carrega só quando o Select é aberto; enquanto isso (ou se falhar)
  // aparece como opção desabilitada.
  onAbrir: () => void;
  // "erro": aviso próprio com saída (tentar de novo), nunca só uma opção.
  estadoLista: "ok" | "carregando" | "erro";
  onTentarNovamente: () => void;
};

type CabecalhoCliente = { empresa: string; cnpj: string; regime: string };

type EditarCadastroOperacionalFormProps = {
  cabecalho: CabecalhoCliente;
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  responsavel: ResponsavelCampo;
  temParcelamento: boolean;
  erroServidor?: string;
  sucesso?: boolean;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  contatos: { id: string }[];
  onAdicionarContato: () => void;
  onRemoverContato: (indice: number) => void;
  onLimpar: () => void;
  // Sem callback (uso em /clientes/[id]): "Cancelar" navega pro mesmo destino
  // do "Voltar" do topo. Com callback (uso inline na busca do dashboard, #35):
  // já está em "/" — um <Link href="/"> não dispara navegação nem reseta nada,
  // então o Container que abriu o form inline fecha o painel diretamente.
  onCancelar?: () => void;
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
  temParcelamento,
  erroServidor,
  sucesso,
  contatos,
  onAdicionarContato,
  onRemoverContato,
  onLimpar,
  onCancelar,
}: EditarCadastroOperacionalFormProps) {
  return (
    <Pilha
      espaco={6}
      como="form"
      onSubmit={onSubmit}
      className="rc-guilloche-frame rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      {!readOnly && <NotaDeObrigatorio />}

      <Caixa className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr]">
        <Pilha espaco={1}>
          <Label>Empresa</Label>
          <Input value={cabecalho.empresa} disabled readOnly />
        </Pilha>
        <Pilha espaco={1}>
          <Label>CNPJ</Label>
          <Input value={cabecalho.cnpj} disabled readOnly />
        </Pilha>
        <Pilha espaco={1}>
          <Label>Regime</Label>
          <Input value={REGIME_LABEL[cabecalho.regime] ?? cabecalho.regime} disabled readOnly />
        </Pilha>
        <CampoResponsavel
          editavel={responsavel.editavel}
          nomeAtual={responsavel.nomeAtual}
          opcoes={responsavel.opcoes}
          semResponsavel={SEM_RESPONSAVEL_LABEL}
          estadoLista={responsavel.estadoLista}
          onAbrir={responsavel.onAbrir}
          onTentarNovamente={responsavel.onTentarNovamente}
          select={register("responsavelId")}
          desabilitado={pendente}
        />
      </Caixa>

      <Caixa
        como="fieldset"
        disabled={readOnly || pendente}
        className="grid grid-cols-1 gap-6 sm:grid-cols-2"
      >
        <CampoDeOpcoes
          id="formaEnvio"
          rotulo="Forma de envio"
          opcoes={OPCOES_FORMA_ENVIO}
          className="gap-1"
          {...register("formaEnvio")}
        />
        <CampoDeOpcoes
          id="documentoObrigatorio"
          rotulo="Documento recebido"
          opcoes={OPCOES_DOCUMENTO}
          placeholder="Não definido"
          className="gap-1"
          {...register("documentoObrigatorio")}
        />
        <CampoDeOpcoes
          id="dasStatus"
          rotulo="DAS"
          opcoes={OPCOES_DAS}
          placeholder="Não definido"
          className="gap-1"
          {...register("dasStatus")}
        />
        <CampoDeTexto
          id="dataEnvioDas"
          rotulo="Data de envio"
          type="date"
          className="gap-1"
          {...register("dataEnvioDas")}
        />

        <Pilha espaco={1}>
          <CaixaDeMarcacao rotulo="Tem parcelamento" {...register("temParcelamento")} />
          {temParcelamento && (
            <CampoDeOpcoes
              id="parcelamentoStatus"
              rotulo="Status do parcelamento"
              opcoes={OPCOES_PARCELAMENTO}
              placeholder="Não definido"
              className="gap-1"
              {...register("parcelamentoStatus")}
            />
          )}
        </Pilha>

        <Pilha espaco={1}>
          <Label>Atividade do mês</Label>
          <Caixa className="flex gap-4 text-sm">
            <CaixaDeMarcacao rotulo="Indústria" {...register("atividadeMes.industria")} />
            <CaixaDeMarcacao rotulo="Comércio" {...register("atividadeMes.comercio")} />
            <CaixaDeMarcacao rotulo="Serviço" {...register("atividadeMes.servico")} />
          </Caixa>
        </Pilha>

        <Pilha espaco={3} className="sm:col-span-2">
          <Label className="block">Contatos</Label>
          {contatos.map((campo, indice) => (
            <Controller
              key={campo.id}
              control={control}
              name={`contatos.${indice}.telefone`}
              render={({ field: { onChange, onBlur, value, name } }) => (
                <LinhaDeContato
                  indice={indice}
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
                  onRemover={() => onRemoverContato(indice)}
                />
              )}
            />
          ))}
          {errors.contatos && typeof errors.contatos.message === "string" && (
            <FieldError>{errors.contatos.message}</FieldError>
          )}
          <Button type="button" variant="outline" onClick={onAdicionarContato}>
            <Plus className="size-4" aria-hidden="true" />
            Adicionar contato
          </Button>
        </Pilha>

        <Pilha espaco={1} className="sm:col-span-2">
          <Label htmlFor="observacoesGerais">Observações gerais</Label>
          <Textarea id="observacoesGerais" {...register("observacoesGerais")} rows={4} />
        </Pilha>

        {!readOnly && (
          <AcoesDoFormulario pendente={pendente} onLimpar={onLimpar} onCancelar={onCancelar} />
        )}
      </Caixa>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {sucesso && <AvisoDeStatus tipo="sucesso" texto="Cadastro operacional atualizado." />}
    </Pilha>
  );
}
