import { Plus, Trash2 } from "lucide-react";
import { type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Button } from "@/presentation/components/ui/button";
import { FieldError } from "@/presentation/components/ui/field-error";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { DAS_STATUS_LABEL, DAS_STATUSES, type DasStatusValor } from "@/shared/kernel/das-status";
import {
  DOCUMENTO_OBRIGATORIO_STATUS_LABEL,
  DOCUMENTO_OBRIGATORIO_STATUSES,
  type DocumentoObrigatorioStatusValor,
} from "@/shared/kernel/documento-obrigatorio-status";
import { FORMA_ENVIO_LABEL, FORMAS_ENVIO, type FormaEnvioValor } from "@/shared/kernel/forma-envio";
import {
  PARCELAMENTO_STATUS_LABEL,
  PARCELAMENTO_STATUSES,
  type ParcelamentoStatusValor,
} from "@/shared/kernel/parcelamento-status";

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
};

type CabecalhoCliente = { empresa: string; cnpj: string; regime: string };

type EditarCadastroOperacionalFormProps = {
  cabecalho: CabecalhoCliente;
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  temParcelamento: boolean;
  erroServidor?: string;
  sucesso?: boolean;
  // Lista de campos do useFieldArray, montada no Container (View burra: sem hooks).
  contatos: { id: string }[];
  onAdicionarContato: () => void;
  onRemoverContato: (indice: number) => void;
};

export function EditarCadastroOperacionalForm({
  cabecalho,
  register,
  errors,
  onSubmit,
  pendente,
  readOnly,
  temParcelamento,
  erroServidor,
  sucesso,
  contatos,
  onAdicionarContato,
  onRemoverContato,
}: EditarCadastroOperacionalFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3" disabled>
        <div className="space-y-1">
          <Label>Empresa</Label>
          <Input value={cabecalho.empresa} disabled readOnly />
        </div>
        <div className="space-y-1">
          <Label>CNPJ</Label>
          <Input value={cabecalho.cnpj} disabled readOnly />
        </div>
        <div className="space-y-1">
          <Label>Regime</Label>
          <Input value={cabecalho.regime} disabled readOnly />
        </div>
      </fieldset>

      <fieldset disabled={readOnly || pendente} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="formaEnvio">Forma de envio</Label>
          <Select id="formaEnvio" {...register("formaEnvio")}>
            {FORMAS_ENVIO.map((valor) => (
              <option key={valor} value={valor}>
                {FORMA_ENVIO_LABEL[valor]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="documentoObrigatorio">Documento recebido</Label>
          <Select id="documentoObrigatorio" {...register("documentoObrigatorio")}>
            <option value="">Não definido</option>
            {DOCUMENTO_OBRIGATORIO_STATUSES.map((valor) => (
              <option key={valor} value={valor}>
                {DOCUMENTO_OBRIGATORIO_STATUS_LABEL[valor]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="dasStatus">DAS</Label>
          <Select id="dasStatus" {...register("dasStatus")}>
            <option value="">Não definido</option>
            {DAS_STATUSES.map((valor) => (
              <option key={valor} value={valor}>
                {DAS_STATUS_LABEL[valor]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dataEnvioDas">Data de envio</Label>
          <Input id="dataEnvioDas" type="date" {...register("dataEnvioDas")} />
        </div>

        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" {...register("temParcelamento")} />
            Tem parcelamento
          </label>
          {temParcelamento && (
            <Select id="parcelamentoStatus" {...register("parcelamentoStatus")}>
              <option value="">Não definido</option>
              {PARCELAMENTO_STATUSES.map((valor) => (
                <option key={valor} value={valor}>
                  {PARCELAMENTO_STATUS_LABEL[valor]}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="space-y-1">
          <Label>Atividade do mês</Label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" {...register("atividadeMes.industria")} />
              Indústria
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" {...register("atividadeMes.comercio")} />
              Comércio
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" {...register("atividadeMes.servico")} />
              Serviço
            </label>
          </div>
        </div>

        <div className="space-y-3 sm:col-span-2">
          <Label className="block">Contatos</Label>
          {contatos.map((campo, indice) => (
            <div
              key={campo.id}
              className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label htmlFor={`contatos.${indice}.nome`}>Nome</Label>
                <Input id={`contatos.${indice}.nome`} {...register(`contatos.${indice}.nome`)} />
                {errors.contatos?.[indice]?.nome && (
                  <FieldError>{errors.contatos[indice]?.nome?.message}</FieldError>
                )}
              </div>
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label htmlFor={`contatos.${indice}.telefone`}>Telefone</Label>
                <Input
                  id={`contatos.${indice}.telefone`}
                  {...register(`contatos.${indice}.telefone`)}
                />
                {errors.contatos?.[indice]?.telefone && (
                  <FieldError>{errors.contatos[indice]?.telefone?.message}</FieldError>
                )}
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-sm">
                <input type="checkbox" {...register(`contatos.${indice}.padrao`)} />
                Padrão
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoverContato(indice)}
                aria-label="Remover contato"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          {errors.contatos && typeof errors.contatos.message === "string" && (
            <FieldError>{errors.contatos.message}</FieldError>
          )}
          <Button type="button" variant="outline" onClick={onAdicionarContato}>
            <Plus className="size-4" aria-hidden="true" />
            Adicionar contato
          </Button>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="observacoesGerais">Observações gerais</Label>
          <textarea
            id="observacoesGerais"
            {...register("observacoesGerais")}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {!readOnly && (
          <Button type="submit" className="sm:col-span-2 sm:w-fit">
            {pendente ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </fieldset>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {sucesso && <p className="text-sm text-primary">Cadastro operacional atualizado.</p>}
    </form>
  );
}
