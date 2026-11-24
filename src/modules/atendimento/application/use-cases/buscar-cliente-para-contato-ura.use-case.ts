import type {
  BuscaClienteContatoUraInput,
  BuscarClienteParaContatoUraPort,
  ClienteParaConfirmar,
} from "@/modules/atendimento/application/ports/in/cadastrar-contato-ura.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { ContatoUraPort } from "@/modules/atendimento/application/ports/out/contato-ura.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { podeCadastrarContatoUra } from "@/modules/atendimento/domain/services/contato-ura.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { cnpjValido, normalizarCnpj } from "@/shared/kernel/cnpj";
import { err, ok, type Result } from "@/shared/kernel/result";

// A Recepção confirma o Cliente pelo CNPJ (o da URA é só sugestão) antes de cadastrar o contato.
// Só quem pode cadastrar consulta: a Recepção enxerga os Clientes, mas este caminho não é uma busca geral.
export class BuscarClienteParaContatoUra implements BuscarClienteParaContatoUraPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly contatos: ContatoUraPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute({
    atendimentoId,
    cnpj,
  }: BuscaClienteContatoUraInput): Promise<Result<ClienteParaConfirmar, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para buscar o Cliente."));

    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    if (!encontrado.value) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeCadastrarContatoUra(ator, encontrado.value)) {
      return err(new ForbiddenError("Só o dono do Atendimento da Recepção busca o Cliente."));
    }

    const normalizado = normalizarCnpj(cnpj);
    if (!cnpjValido(normalizado)) return err(new ValidationError("Informe um CNPJ válido."));

    const cliente = await this.contatos.clientePorCnpj(normalizado);
    if (!cliente.ok) return cliente;

    // Atendimento já ligado a um Cliente só cadastra contato nesse Cliente (o banco confere de novo).
    const doAtendimento = encontrado.value.clienteId;
    const outroCliente =
      cliente.value !== null && doAtendimento !== null && cliente.value.id !== doAtendimento;
    // Toda busca de quem pode cadastrar fica na trilha: o service_role lê qualquer Cliente por CNPJ,
    // e a busca repetida CNPJ a CNPJ (a carteira inteira) tem de aparecer na auditoria.
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: "contato.buscar-cliente-ura",
      alvo: normalizado,
      resultado: cliente.value !== null && !outroCliente ? "sucesso" : "falha",
    });

    if (!cliente.value) return err(new NotFoundError("Nenhum Cliente com este CNPJ."));
    if (outroCliente) {
      return err(
        new ValidationError(
          "Este Atendimento já é de outro Cliente. Confirme o CNPJ do Cliente do Atendimento.",
        ),
      );
    }
    return ok(cliente.value);
  }
}
