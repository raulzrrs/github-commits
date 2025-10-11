/**
 * Utilitários para manipulação de datas
 */

/**
 * Retorna o início do dia (00:00:00.000)
 */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Retorna o final do dia (23:59:59.999)
 */
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Verifica se uma data está dentro de um intervalo
 */
export function isDateInRange(d: Date, from: Date, to: Date): boolean {
  return d >= from && d <= to;
}

/**
 * Subtrai dias de uma data
 */
export function subDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
}

/**
 * Formata data no padrão brasileiro (DD/MM/YYYY)
 */
export function formatDatePtBR(dateString: string | Date): string {
  const d = typeof dateString === "string" ? new Date(dateString) : dateString;
  return d.toLocaleDateString("pt-BR");
}
