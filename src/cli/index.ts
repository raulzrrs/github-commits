import path from "path";
import { CliConfig } from "../types";
import {
  parseCliArg,
  hasCliFlag,
  toIntOrUndefined,
} from "../utils/generalUtils";

/**
 * Mostra a ajuda do comando
 */
export function showHelp(): void {
  console.log(`
Uso: ts-node src/index.ts [flags]

Periodo (precedencia: today > last-days > month/year):
  --today                  Usa apenas o dia de hoje
  --last-days=N            Usa os ultimos N dias (ex.: --last-days=10)
  --month=MM               Mes (1..12) para report mensal
  --year=YYYY              Ano (ex.: 2026) para report mensal

Branches:
  --all-branches           Processa todas as branches
  --main-only              Processa apenas a branch padrao (default)
                           (padrao: main-only, a menos que --all-branches seja informado)

Usuarios:
  --all-users              Lista commits de todos os usuarios
                           (padrao: apenas TARGET_USER definido no .env)

Outros:
  --quiet                  Menos logs
  --no-raw                 Nao salva o arquivo raw_commits_*.json
  --out-dir=PATH           Diretorio base de saida (default: ./output)
  --help | -h              Mostra esta ajuda

OpenAI (opcional):
  Defina OPENAI_API_KEY e OPENAI_INSTRUCTION para gerar o resumo com IA
  OPENAI_MODEL default: gpt-5-nano
  OPENAI_OUTPUT_FILE pode sobrescrever o caminho do arquivo de resposta

Exemplos:
  ts-node src/index.ts --today --all-branches
  ts-node src/index.ts --last-days=15 --main-only
  ts-node src/index.ts --month=9 --year=2026
  ts-node src/index.ts --today --all-users --all-branches
  ts-node src/index.ts --today --out-dir=./data --no-raw
`);
}

/**
 * Verifica se deve mostrar ajuda e sai se necessario
 */
export function maybeShowHelp(): void {
  if (hasCliFlag("help") || hasCliFlag("h")) {
    showHelp();
    process.exit(0);
  }
}

/**
 * Valida as variaveis de ambiente obrigatorias
 */
export function validateEnvironment(
  githubToken: string,
  account: string,
  targetUser: string,
  allUsers: boolean
): void {
  if (!githubToken || !account) {
    console.error(
      "Erro: defina GITHUB_TOKEN e ORG_NAME (ou ACCOUNT) no .env ou variaveis de ambiente."
    );
    process.exit(1);
  }

  if (!allUsers && !targetUser) {
    console.error(
      "Erro de configuracao: por padrao so listamos um usuario, mas TARGET_USER nao foi definido.\n" +
        "   Defina TARGET_USER no .env ou use a flag --all-users para listar todos os usuarios."
    );
    process.exit(1);
  }
}

/**
 * Le e processa todas as configuracoes da linha de comando e variaveis de ambiente
 */
export function parseCliConfig(): CliConfig {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const ACCOUNT = process.env.ORG_NAME || process.env.ACCOUNT || "";
  const TARGET_USER = process.env.TARGET_USER || "";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
  const OPENAI_INSTRUCTION = process.env.OPENAI_INSTRUCTION || "";
  const OPENAI_OUTPUT_FILE = process.env.OPENAI_OUTPUT_FILE || "";

  const QUIET = hasCliFlag("quiet") || process.env.QUIET === "true";
  const NO_RAW = hasCliFlag("no-raw") || process.env.NO_RAW === "true";
  const ALL_USERS = hasCliFlag("all-users") || process.env.ALL_USERS === "true";

  const monthArg = parseCliArg("month") || process.env.MONTH;
  const yearArg = parseCliArg("year") || process.env.YEAR;
  const lastDaysArg = parseCliArg("last-days") || process.env.LAST_DAYS;
  const todayOnly = hasCliFlag("today") || process.env.TODAY_ONLY === "true";

  const allBranches =
    hasCliFlag("all-branches") ||
    (!(hasCliFlag("main-only") || process.env.MAIN_ONLY === "true") &&
      process.env.ALL_BRANCHES === "true");

  const outDirBase =
    parseCliArg("out-dir") ||
    process.env.OUT_DIR ||
    path.join(__dirname, "../../output");

  const monthNum = toIntOrUndefined(monthArg);
  const yearNum = toIntOrUndefined(yearArg);
  const lastDaysNum = toIntOrUndefined(lastDaysArg);

  return {
    githubToken: GITHUB_TOKEN,
    account: ACCOUNT,
    targetUser: TARGET_USER || undefined,
    openaiApiKey: OPENAI_API_KEY,
    openaiModel: OPENAI_MODEL,
    openaiInstruction: OPENAI_INSTRUCTION,
    openaiOutputFile: OPENAI_OUTPUT_FILE || undefined,
    month: monthNum,
    year: yearNum,
    todayOnly,
    allBranches,
    lastDays: lastDaysNum,
    outDirBase,
    allUsers: ALL_USERS,
    quiet: QUIET,
    saveRaw: !NO_RAW,
  };
}
