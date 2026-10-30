import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";

import { CabecalhoDoCadastro } from "./cabecalho-do-cadastro.component";
import { ContatosDoCadastro } from "./contatos-do-cadastro.component";
import { DasDoCadastro } from "./das-do-cadastro.component";
import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";
import { ParcelamentosDoCadastro } from "./parcelamentos-do-cadastro.component";
import { ResponsavelDoCadastro } from "./responsavel-do-cadastro.component";

const opcoes = {
  formaEnvio: [{ valor: "email", rotulo: "E-mail" }],
  documento: [{ valor: "recebido", rotulo: "Recebido" }],
  das: [{ valor: "pendente", rotulo: "Pendente" }],
};

const parcelamento = {
  id: "p1",
  codigo: "123",
  parcelasRestantes: 3,
  interno: false,
  quitado: false,
  temEnvio: false,
  enviadoNoMes: true,
  arquivoNome: "acordo.pdf",
};

function Wrapper({ dasEnviado = false }: { dasEnviado?: boolean }) {
  const {
    register,
    control,
    formState: { errors },
  } = useForm<EditarCadastroOperacionalFormValues>();
  return (
    <form>
      <CabecalhoDoCadastro
        cabecalho={{ empresa: "ACME", cnpj: "00.000.000/0001-00", regime: "simples_nacional" }}
        documentoContratual={<p>cartão do documento</p>}
      >
        <ResponsavelDoCadastro
          responsavel={{
            editavel: false,
            nomeAtual: "Ana",
            opcoes: [],
            onAbrir: jest.fn(),
            estadoLista: "ok",
            onTentarNovamente: jest.fn(),
          }}
          select={register("responsavelId")}
          desabilitado={false}
        />
      </CabecalhoDoCadastro>
      <DasDoCadastro register={register} opcoes={opcoes} dasEnviadoPeloSistema={dasEnviado} />
      <ContatosDoCadastro
        register={register}
        control={control}
        errors={errors}
        readOnly={false}
        contatos={[]}
        onAdicionar={() => adicionar()}
        onRemover={jest.fn()}
      />
      <ParcelamentosDoCadastro
        register={register}
        control={control}
        errors={errors}
        readOnly={false}
        parcelamentos={[parcelamento]}
        parcelamentoCampos={[{ id: "f1" }]}
        onAdicionar={jest.fn()}
        onRemover={jest.fn()}
        leituras={{}}
        onArquivoEscolhido={jest.fn()}
      />
    </form>
  );
}

const adicionar = jest.fn();

describe("regiões do cadastro operacional", () => {
  it("cabeçalho mostra a identidade, o Responsável e o documento", () => {
    render(<Wrapper />);
    expect(screen.getByLabelText("Empresa")).toHaveValue("ACME");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("00.000.000/0001-00");
    expect(screen.getByText("cartão do documento")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsável")).toBeDisabled();
  });

  it("DAS usa as opções recebidas e trava o select quando o sistema já enviou", () => {
    const { rerender } = render(<Wrapper />);
    expect(screen.getByRole("option", { name: "E-mail" })).toBeInTheDocument();
    expect(screen.getByLabelText("DAS")).toBeEnabled();
    rerender(<Wrapper dasEnviado />);
    expect(screen.getByLabelText("DAS")).toBeDisabled();
  });

  it("contatos chama onAdicionar", async () => {
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: /adicionar contato/i }));
    expect(adicionar).toHaveBeenCalled();
  });

  it("parcelamentos resume os salvos e exibe o PDF anexado", () => {
    render(<Wrapper />);
    expect(screen.getByRole("status")).toHaveTextContent("Tem parcelamento: Sim (1)");
    expect(screen.getByText(/PDF anexado: acordo\.pdf/)).toBeInTheDocument();
  });
});
