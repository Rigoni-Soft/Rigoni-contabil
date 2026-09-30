import type {
  CadastroOperacionalClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ok, type Result } from "@/shared/kernel/result";

import { ConsultarCadastroOperacionalCliente } from "./consultar-cadastro-operacional-cliente.use-case";

const DTO: CadastroOperacionalClienteDto = {
  id: "11111111-1111-1111-1111-111111111111",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  regime: "simples_nacional",
  formaEnvio: "whatsapp",
  contatos: [],
  documentoObrigatorio: null,
  dasStatus: null,
  dataEnvioDas: null,
  temParcelamento: false,
  parcelamentoStatus: null,
  observacoesGerais: "",
  atividadeMes: { industria: false, comercio: false, servico: false },
};

const sessaoCom = (autenticado: boolean): SessaoPort => ({
  usuarioAtual: async () =>
    autenticado ? { id: "u1", papel: "funcionario", setor: "financeiro" } : null,
});

class ClienteQueryPortFalso implements ClienteQueryPort {
  constructor(private dto: CadastroOperacionalClienteDto | null) {}
  async buscarCadastroOperacional(): Promise<
    Result<CadastroOperacionalClienteDto | null, AppError>
  > {
    return ok(this.dto);
  }

  async buscarPorTermo() {
    return ok([]);
  }
}

describe("ConsultarCadastroOperacionalCliente", () => {
  it("devolve o cadastro operacional, nunca com contrato social/alterações no DTO", async () => {
    const query = new ClienteQueryPortFalso(DTO);

    const resultado = await new ConsultarCadastroOperacionalCliente(sessaoCom(true), query).execute(
      DTO.id,
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value?.empresa).toBe("Padaria Pão Quente Ltda");
      expect(resultado.value).not.toHaveProperty("contratoSocialCaminho");
      expect(resultado.value).not.toHaveProperty("alteracoesContratuais");
    }
  });

  it("devolve null quando o Cliente não existe", async () => {
    const query = new ClienteQueryPortFalso(null);

    const resultado = await new ConsultarCadastroOperacionalCliente(sessaoCom(true), query).execute(
      "inexistente",
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.value).toBeNull();
  });

  it("sem sessão devolve erro e não consulta o Cliente", async () => {
    const query = new ClienteQueryPortFalso(DTO);
    const buscar = jest.spyOn(query, "buscarCadastroOperacional");

    const resultado = await new ConsultarCadastroOperacionalCliente(
      sessaoCom(false),
      query,
    ).execute(DTO.id);

    expect(resultado.ok).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });
});
