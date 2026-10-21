// Teto de 4,5 MB do corpo de uma Server Action na Vercel (ADR 0007): 4 MB deixa folga para o resto do formulário.
export const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024;
export const ERRO_DATA_FUTURA = "A data da alteração não pode ser futura.";
export const ERRO_ARQUIVO_GRANDE = "O arquivo passa de 4 MB. Envie um arquivo menor.";
