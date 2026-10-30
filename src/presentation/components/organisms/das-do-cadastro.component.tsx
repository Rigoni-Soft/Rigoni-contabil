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
  // Opções dos selects (valor/rótulo), já montadas pelo Container.
  opcoes: { formaEnvio: Opcao[]; documento: Opcao[]; das: Opcao[] };
  // DAS já `enviado` pelo sistema: o select fica travado, exibindo o valor atual.
  dasEnviadoPeloSistema: boolean;
};

// Células da grade do fieldset: forma de envio, documento, DAS, data de envio e atividade do mês.
export function DasDoCadastro({ register, opcoes, dasEnviadoPeloSistema }: DasDoCadastroProps) {
  return (
    <>
      <CampoDeOpcoes
        id="formaEnvio"
        rotulo="Forma de envio"
        opcoes={opcoes.formaEnvio}
        className="gap-1"
        {...register("formaEnvio")}
      />
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
        // "Enviado" é do sistema: nem o Admin troca depois que o envio foi concluído. Fica
        // esmaecido, como todo campo desativado: o esmaecimento é o sinal de não editável (DESIGN.md).
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
        // Só o sistema define a data: desativada, com o esmaecimento de qualquer campo travado.
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
