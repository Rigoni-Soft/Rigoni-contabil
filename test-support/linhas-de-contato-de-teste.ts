// As ações das linhas de contato para os specs de View: nenhuma linha em edição, nada a gravar. O formato é o
// de `AcoesDasLinhasDeContato`; a View global não importa módulo, então o tipo fica estrutural.
export const LINHAS_DE_CONTATO_DE_TESTE = {
  editando: () => false,
  salvo: () => true,
  salvando: null,
  camposTravados: () => false,
  rotuloDaLixeira: () => undefined,
  confirmacaoDeRemocao: () => undefined,
  onRemover: jest.fn(),
  envios: () => undefined,
  existentes: () => undefined,
  numeroRepetido: () => undefined,
  onSairDoTelefone: jest.fn(),
  visivel: () => true,
  numero: (indice: number) => indice + 1,
  erroDaLinha: () => undefined,
  onEditar: jest.fn(),
  onSalvar: jest.fn(),
  onCancelar: jest.fn(),
};
