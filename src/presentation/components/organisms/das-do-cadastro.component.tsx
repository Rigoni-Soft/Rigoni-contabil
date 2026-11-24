import type { UseFormRegister } from "react-hook-form";

import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Label } from "@/presentation/components/ui/label";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

type Opcao = { valor: string; rotulo: string };

type DasDoCadastroProps = {
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  opcoes: { documento: Opcao[]; das: Opcao[] };
  dasEnviadoPeloSistema: boolean;
};

export function DasDoCadastro({ register, opcoes, dasEnviadoPeloSistema }: DasDoCadastroProps) {
  return (
    <>
      <CampoDeOpcoes
        id="documentoObrigatorio"
        rotulo="Documento recebido"
        opcoes={opcoes.documento}
        placeholder="Não definido"
        className="gap-1"
        {...register("documentoObrigatorio")}
      />
      <CampoDeOpcoes
        id="dasStatus"
        rotulo="DAS"
        opcoes={opcoes.das}
        placeholder="Não definido"
        className="gap-1"
        disabled={dasEnviadoPeloSistema}
        ajuda={dasEnviadoPeloSistema ? "Definido pelo sistema." : undefined}
        {...register("dasStatus")}
      />
      <CampoDeTexto
        id="dataEnvioDas"
        rotulo="Data de envio"
        type="date"
        className="gap-1"
        readOnly
        disabled
        ajuda="Preenchida pelo sistema quando o DAS é enviado."
        {...register("dataEnvioDas")}
      />

      <Pilha espaco={1} className="lg:col-span-2">
        <Label>Atividade do mês</Label>
        <Linha espaco={4} quebra className="text-sm">
          <CaixaDeMarcacao rotulo="Indústria" {...register("atividadeMes.industria")} />
          <CaixaDeMarcacao rotulo="Comércio" {...register("atividadeMes.comercio")} />
          <CaixaDeMarcacao rotulo="Serviço" {...register("atividadeMes.servico")} />
        </Linha>
      </Pilha>
    </>
  );
}
