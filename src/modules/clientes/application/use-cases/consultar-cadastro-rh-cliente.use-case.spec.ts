import type {
  CadastroRhClienteDto,
  ClienteQueryPort,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import { ok } from "@/shared/kernel/result";

import { ConsultarCadastroRhCliente } from "./consultar-cadastro-rh-cliente.use-case";

const DTO: CadastroRhClienteDto = {
  id: "11111111-1111-1111-1111-111111111111",
  empresa: "Padaria Pão Quente Ltda",
  cnpj: "11444777000161",
  contatos: [{ id: "c1", nome: "Maria", telefone: "11999990000", padrao: true }],
  observacoes: "Pagar a folha no 5º dia útil.",
  parcelamentos: [],
};

const sessaoCom = (autenticado: boolean, papel = "lider_setor", setor = "rh"): SessaoPort => ({
  usuarioAtual: async () => (autenticado ? { id: "u1", papel, setor } : null),
});

const queryCom = (dto: CadastroRhClienteDto | null) =>
  ({ buscarCadastroRh: async () => ok(dto) }) as unknown as ClienteQueryPort;

describe("ConsultarCadastroRhCliente", () => {
  it("devolve empresa, CNPJ, contatos e as observações do RH, sem o Regime", async () => {
    const r = await new ConsultarCadastroRhCliente(sessaoCom(true), queryCom(DTO)).execute(DTO.id);

    expect(r.ok && r.value).toEqual(DTO);
  });

  it.each([
    ["lider_setor", "financeiro"],
    ["lider_setor", "simples_nacional"],
  ])("recusa quem vê o cadastro completo (%s de %s)", async (papel, setor) => {
    const r = await new ConsultarCadastroRhCliente(
      sessaoCom(true, papel, setor),
      queryCom(DTO),
    ).execute(DTO.id);

    expect(r.ok).toBe(false);
  });

  it("o Admin lê o cadastro do RH, para ver as observações do RH na tela dele", async () => {
    const r = await new ConsultarCadastroRhCliente(
      sessaoCom(true, "admin", "administrativo"),
      queryCom(DTO),
    ).execute(DTO.id);

    expect(r.ok && r.value).toEqual(DTO);
  });

  it("recusa quem não está autenticado", async () => {
    const r = await new ConsultarCadastroRhCliente(sessaoCom(false), queryCom(DTO)).execute(DTO.id);

    expect(r.ok).toBe(false);
  });
});
