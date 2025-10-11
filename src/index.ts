// src/index.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

type RepoRaw = any;
type CommitRaw = any;
type BranchRaw = any;

async function getFetch(): Promise<any> {
  if (typeof (globalThis as any).fetch === "function") {
    return (globalThis as any).fetch;
  }
  try {
    const mod = await import("node-fetch");
    return mod.default ?? mod;
  } catch {
    throw new Error(
      "fetch não disponível. Use Node >=18 ou instale node-fetch (npm i node-fetch)."
    );
  }
}

function parseCliArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : undefined;
}

function hasCliFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function toIntOrUndefined(val?: string): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : undefined;
}

// Utilitários de data
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isDateInRange(d: Date, from: Date, to: Date): boolean {
  return d >= from && d <= to;
}

function subDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

class GitHubCommitFetcher {
  private token: string;
  private account: string;
  private targetUser?: string;
  private quiet: boolean;
  private saveRaw: boolean;
  private HEADERS: Record<string, string>;
  private commitsByDay: Record<
    string,
    Record<
      string,
      Array<{ message: string; author: string; date: string; branch: string }>
    >
  > = {};
  private commitsByUser: Record<string, number> = {};
  private rawCommits: CommitRaw[] = [];
  private processedCommitShas: Set<string> = new Set();
  private fetch: any;

  // Cache para evitar requisições duplicadas
  private branchCache: Map<string, BranchRaw[]> = new Map();

  // Concorrência para branches
  private readonly BRANCH_CONCURRENCY = 5;

  constructor(
    token: string,
    account: string,
    targetUser?: string,
    quiet: boolean = false,
    saveRaw: boolean = true
  ) {
    this.token = token;
    this.account = account;
    this.targetUser = targetUser;
    this.quiet = quiet;
    this.saveRaw = saveRaw;
    this.HEADERS = {
      Authorization: `token ${this.token}`,
      "User-Agent": "github-commit-fetcher",
      Accept: "application/vnd.github+json",
    };
  }

  private log(message: string): void {
    if (!this.quiet) {
      console.log(message);
    }
  }

  private async initFetch() {
    if (!this.fetch) {
      this.fetch = await getFetch();
    }
  }

  private async fetchJson(url: string): Promise<any> {
    await this.initFetch();
    const res = await this.fetch(url, { headers: this.HEADERS });
    const rl = res.headers?.get
      ? res.headers.get("x-ratelimit-remaining")
      : null;
    if (rl !== null && parseInt(rl) < 100) {
      console.log(`[RateLimit] remaining: ${rl}`);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt}`);
    }
    return res.json();
  }

  // Pool de concorrência simples
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    let i = 0;
    const runners = new Array(Math.min(limit, items.length))
      .fill(0)
      .map(async () => {
        while (i < items.length) {
          const idx = i++;
          results[idx] = await worker(items[idx]);
        }
      });
    await Promise.all(runners);
    return results;
  }

  private async getRepos(): Promise<RepoRaw[]> {
    const endpoints = [
      `https://api.github.com/orgs/${this.account}/repos`,
      `https://api.github.com/users/${this.account}/repos`,
    ];

    let allRepos: RepoRaw[] = [];

    for (const base of endpoints) {
      let page = 1;
      let foundAny = false;
      try {
        while (true) {
          const url = `${base}?page=${page}&per_page=100&type=all`;
          const data = await this.fetchJson(url);
          if (!Array.isArray(data)) break;
          if (data.length === 0) break;
          allRepos = allRepos.concat(data);
          foundAny = true;
          page++;
        }
      } catch (err) {
        // Detecta erros de autenticação e aborta imediatamente
        const msg = err instanceof Error ? err.message : String(err);
        if (
          /401|403/.test(msg) ||
          /Bad credentials/i.test(msg) ||
          /Requires authentication/i.test(msg)
        ) {
          throw new Error(
            `❌ Falha de autenticação na API do GitHub.\n` +
              `Verifique seu GITHUB_TOKEN e permissões para a conta "${this.account}".\n` +
              `Detalhes: ${msg}`
          );
        }
        // Outros erros (ex.: rede temporária), apenas avisa e tenta o próximo endpoint
        console.warn(`Aviso ao consultar ${base}: ${msg}`);
      }
      if (foundAny) break;
    }

    return allRepos;
  }

  private async getBranches(repoFullName: string): Promise<BranchRaw[]> {
    if (this.branchCache.has(repoFullName)) {
      return this.branchCache.get(repoFullName)!;
    }

    let branches: BranchRaw[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const url = `https://api.github.com/repos/${repoFullName}/branches?page=${page}&per_page=${perPage}`;
      try {
        const data = await this.fetchJson(url);
        if (!Array.isArray(data) || data.length === 0) break;
        branches.push(...data);
        page++;
      } catch (err) {
        console.warn(
          `Warn getBranches ${repoFullName}: ${
            err instanceof Error ? err.message : err
          }`
        );
        break;
      }
    }

    this.branchCache.set(repoFullName, branches);
    return branches;
  }

  private async getCommits(
    repoFullName: string,
    branchName: string,
    since: Date,
    until: Date
  ): Promise<CommitRaw[]> {
    let page = 1;
    const perPage = 100;
    const commits: CommitRaw[] = [];

    while (true) {
      const url = `https://api.github.com/repos/${repoFullName}/commits?sha=${branchName}&since=${since.toISOString()}&until=${until.toISOString()}&page=${page}&per_page=${perPage}`;
      try {
        const data = await this.fetchJson(url);
        if (!Array.isArray(data) || data.length === 0) break;
        commits.push(...data);
        page++;
      } catch (err) {
        console.warn(
          `Warn getCommits ${repoFullName}/${branchName}: ${
            err instanceof Error ? err.message : err
          }`
        );
        break;
      }
    }

    return commits;
  }

  private formatDatePtBR(dateString: string | Date): string {
    const d =
      typeof dateString === "string" ? new Date(dateString) : dateString;
    return d.toLocaleDateString("pt-BR");
  }

  private getAuthorKey(commit: CommitRaw): string {
    const raw =
      commit.author?.login ||
      commit.commit?.author?.name ||
      commit.commit?.committer?.name ||
      "unknown";
    return String(raw).trim();
  }

  public async run(
    month?: number,
    year?: number,
    todayOnly: boolean = false,
    allBranches: boolean = true,
    lastDays?: number,
    outDirBase: string = path.join(__dirname, "../output"),
    allUsers: boolean = false
  ): Promise<void> {
    const today = new Date();

    // Determina janela de datas pela precedência: today > lastDays > month/year
    let firstDay: Date;
    let lastDay: Date;

    if (todayOnly) {
      firstDay = startOfDay(today);
      lastDay = endOfDay(today);
    } else if (typeof lastDays === "number" && lastDays > 0) {
      lastDay = endOfDay(today);
      firstDay = startOfDay(subDays(today, lastDays - 1)); // últimos N dias incluindo hoje
    } else {
      const m = month ?? today.getMonth() + 1;
      const y = year ?? today.getFullYear();
      firstDay = new Date(y, m - 1, 1);
      lastDay = new Date(y, m, 0);
      lastDay.setHours(23, 59, 59, 999);
    }

    // Informação do modo branches
    const branchesMode = allBranches
      ? "TODAS as branches"
      : "apenas branch padrão";

    // Informação do escopo de usuários
    const scopeLabel = allUsers
      ? "todos os usuários"
      : this.targetUser
      ? `apenas o usuário ${this.targetUser}`
      : "apenas usuário (TARGET_USER não definido)";

    console.log(
      `Coletando commits da conta ${this.account} de ${this.formatDatePtBR(
        firstDay
      )} a ${this.formatDatePtBR(lastDay)}.`
    );
    console.log(`Modo branches: ${branchesMode}`);
    console.log(`Escopo de usuários: ${scopeLabel}`);

    const repos = await this.getRepos();
    console.log(`Repositórios encontrados: ${repos.length}`);

    if (repos.length === 0) {
      console.warn(
        `⚠️  Nenhum repositório encontrado para a conta "${this.account}".\n` +
          `Verifique se:\n` +
          `  - A conta/organização existe\n` +
          `  - Seu token tem permissão para acessar os repositórios\n` +
          `  - O nome da conta está correto (case-sensitive)`
      );
      return;
    }

    // Filtro por atividade recente usando pushed_at (+7 dias de folga)
    const sinceForFilter = new Date(firstDay);
    sinceForFilter.setDate(sinceForFilter.getDate() - 7);

    const activeRepos = repos.filter((repo) => {
      const pushed = repo.pushed_at ? new Date(repo.pushed_at) : null;
      return pushed ? isDateInRange(pushed, sinceForFilter, lastDay) : true;
    });

    console.log(
      `Repositórios ativos no período (pushed_at recente): ${activeRepos.length}`
    );

    if (activeRepos.length === 0) {
      console.warn(
        `⚠️  Nenhum repositório com atividade recente no período especificado.`
      );
      return;
    }

    // Processa repos sequencialmente (evita estourar rate limit)
    for (const repo of activeRepos) {
      const repoFull = repo.full_name || `${repo.owner?.login}/${repo.name}`;
      this.log(`-> repo: ${repoFull}`);

      const branches = await this.getBranches(repoFull);
      this.log(`   branches encontradas: ${branches.length}`);

      if (branches.length === 0) continue;

      const branchesToUse = allBranches
        ? branches
        : branches.filter((b) => b.name === repo.default_branch);

      this.log(`   branches a processar: ${branchesToUse.length}`);

      await this.mapWithConcurrency(
        branchesToUse,
        this.BRANCH_CONCURRENCY,
        async (branch) => {
          const branchName = branch.name;
          this.log(`   -> branch: ${branchName}`);

          const commits = await this.getCommits(
            repoFull,
            branchName,
            firstDay,
            lastDay
          );
          this.log(`      commits encontrados nesta branch: ${commits.length}`);

          if (commits.length === 0) return;

          for (const c of commits) {
            // data do commit primeiro (para evitar trabalho desnecessário)
            const dateStr = c.commit?.author?.date || c.commit?.committer?.date;
            if (!dateStr) continue;
            const commitDate = new Date(dateStr);
            if (commitDate < firstDay || commitDate > lastDay) continue;

            const authorKey = this.getAuthorKey(c);
            const authorKeyLower = authorKey.toLowerCase();

            // Aplica escopo: se não for allUsers, mantém apenas TARGET_USER (case-insensitive)
            if (!allUsers) {
              const targetLower = this.targetUser?.toLowerCase();
              if (!targetLower || authorKeyLower !== targetLower) {
                continue;
              }
            }

            // Evita duplicados por SHA depois do filtro de usuário
            if (this.processedCommitShas.has(c.sha)) continue;
            this.processedCommitShas.add(c.sha);

            if (this.saveRaw) {
              this.rawCommits.push({
                ...c,
                _branch: branchName,
                _repo: repoFull,
              });
            }

            const dayKey = this.formatDatePtBR(commitDate);

            if (!this.commitsByDay[dayKey]) {
              this.commitsByDay[dayKey] = {};
            }
            if (!this.commitsByDay[dayKey][repoFull]) {
              this.commitsByDay[dayKey][repoFull] = [];
            }

            this.commitsByDay[dayKey][repoFull].push({
              message: c.commit?.message ?? "",
              author: authorKey,
              date: dateStr,
              branch: branchName,
            });

            this.commitsByUser[authorKeyLower] =
              (this.commitsByUser[authorKeyLower] || 0) + 1;
          }
        }
      );
    }

    // Organização de saída por pastas: outDirBase/YYYY/MM/
    // Se período for "last-days" que cruza meses, ainda usamos o mês/ano do 'lastDay' para padronizar
    const yearStr = String(lastDay.getFullYear());
    const monthStr = String(lastDay.getMonth() + 1).padStart(2, "0");

    const outDir = path.join(outDirBase, yearStr, monthStr);
    ensureDir(outDir);

    const rawFile = path.join(
      outDir,
      `raw_commits_${yearStr}_${monthStr}.json`
    );
    const byDayFile = path.join(
      outDir,
      `commits_by_day_${yearStr}_${monthStr}.json`
    );
    const rankingFile = path.join(
      outDir,
      `ranking_${yearStr}_${monthStr}.json`
    );

    const orderedCommitsByDay = Object.fromEntries(
      Object.entries(this.commitsByDay).sort(([dayA], [dayB]) => {
        const [dA, mA, yA] = dayA.split("/").map(Number);
        const [dB, mB, yB] = dayB.split("/").map(Number);
        return (
          new Date(yA, mA - 1, dA).getTime() -
          new Date(yB, mB - 1, dB).getTime()
        );
      })
    );

    const ranking = Object.entries(this.commitsByUser).sort(
      (a, b) => b[1] - a[1]
    );

    const writePromises: Array<Promise<any>> = [
      fs.promises.writeFile(
        byDayFile,
        JSON.stringify(orderedCommitsByDay, null, 2)
      ),
      fs.promises.writeFile(rankingFile, JSON.stringify(ranking, null, 2)),
    ];

    if (this.saveRaw) {
      writePromises.push(
        fs.promises.writeFile(rawFile, JSON.stringify(this.rawCommits, null, 2))
      );
    }

    // TARGET_USER: só gera arquivo específico se não for allUsers
    let targetUserFile = "";
    if (!allUsers && this.targetUser) {
      const targetUserLower = this.targetUser.toLowerCase();
      const targetUserCommitsByDay: Record<
        string,
        Record<
          string,
          Array<{
            message: string;
            author: string;
            date: string;
            branch: string;
          }>
        >
      > = {};

      Object.entries(orderedCommitsByDay).forEach(([day, repoCommits]) => {
        Object.entries(repoCommits).forEach(([repo, commits]) => {
          const userCommits = commits.filter(
            (commit) => commit.author.toLowerCase() === targetUserLower
          );
          if (userCommits.length > 0) {
            if (!targetUserCommitsByDay[day]) {
              targetUserCommitsByDay[day] = {};
            }
            targetUserCommitsByDay[day][repo] = userCommits;
          }
        });
      });

      targetUserFile = path.join(
        outDir,
        `commits_${this.targetUser}_${yearStr}_${monthStr}.json`
      );

      writePromises.push(
        fs.promises.writeFile(
          targetUserFile,
          JSON.stringify(targetUserCommitsByDay, null, 2)
        )
      );

      const totalUserCommits = Object.values(targetUserCommitsByDay)
        .flatMap((dayRepos) => Object.values(dayRepos))
        .flat().length;

      console.log(
        `\n👤 Commits de ${this.targetUser}: ${totalUserCommits} commits no período`
      );
    }

    await Promise.all(writePromises);

    console.log(`\n✅ Arquivos gerados com sucesso:`);
    if (this.saveRaw) console.log(` - raw: ${rawFile}`);
    console.log(` - por dia: ${byDayFile}`);
    console.log(` - ranking: ${rankingFile}`);
    if (targetUserFile) {
      console.log(
        ` - commits do usuário ${this.targetUser}: ${targetUserFile}`
      );
    }

    console.log(`\n📊 Estatísticas gerais:`);
    console.log(
      `Total de commits únicos processados: ${this.processedCommitShas.size}`
    );
    console.log(`Total de commits raw coletados: ${this.rawCommits.length}`);

    console.log("\n🏆 Ranking (console):");
    if (ranking.length === 0) {
      console.log("Nenhum commit encontrado no período.");
    } else {
      ranking.forEach(([user, count], i) => {
        console.log(`${i + 1}. ${user}: ${count} commits`);
      });
    }
  }
}

// HELP
function maybeShowHelp() {
  if (hasCliFlag("help") || hasCliFlag("h")) {
    console.log(`
Uso: ts-node src/index.ts [flags]

Período (precedência: today > last-days > month/year):
  --today                  Usa apenas o dia de hoje
  --last-days=N            Usa os últimos N dias (ex.: --last-days=10)
  --month=MM               Mês (1..12) para report mensal
  --year=YYYY              Ano (ex.: 2025) para report mensal

Branches:
  --all-branches           Processa todas as branches
  --main-only              Processa apenas a branch padrão (default)
                           (padrão: main-only, a menos que --all-branches seja informado)

Usuários:
  --all-users              Lista commits de todos os usuários
                           (padrão: apenas TARGET_USER definido no .env)

Outros:
  --quiet                  Menos logs
  --no-raw                 Não salva o arquivo raw_commits_*.json
  --out-dir=PATH           Diretório base de saída (default: ./output)
  --help | -h              Mostra esta ajuda

Exemplos:
  ts-node src/index.ts --today --all-branches
  ts-node src/index.ts --last-days=15 --main-only
  ts-node src/index.ts --month=9 --year=2025
  ts-node src/index.ts --today --all-users --all-branches
  ts-node src/index.ts --today --out-dir=./data --no-raw
`);
    process.exit(0);
  }
}

// leitura de variáveis / flags
maybeShowHelp();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const ACCOUNT = process.env.ORG_NAME || process.env.ACCOUNT || "";
const TARGET_USER = process.env.TARGET_USER || "";

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
    process.env.ALL_BRANCHES === "true"); // compatibilidade com envs

const outDirBase =
  parseCliArg("out-dir") ||
  process.env.OUT_DIR ||
  path.join(__dirname, "../output");

if (!GITHUB_TOKEN || !ACCOUNT) {
  console.error(
    "❌ Erro: defina GITHUB_TOKEN e ORG_NAME (ou ACCOUNT) no .env ou variáveis de ambiente."
  );
  process.exit(1);
}

// Validação: se não for all-users, precisa de TARGET_USER
if (!ALL_USERS && !TARGET_USER) {
  console.error(
    "❌ Erro de configuração: por padrão só listamos um usuário, mas TARGET_USER não foi definido.\n" +
      "   Defina TARGET_USER no .env ou use a flag --all-users para listar todos os usuários."
  );
  process.exit(1);
}

const monthNum = toIntOrUndefined(monthArg);
const yearNum = toIntOrUndefined(yearArg);
const lastDaysNum = toIntOrUndefined(lastDaysArg);

const fetcher = new GitHubCommitFetcher(
  GITHUB_TOKEN,
  ACCOUNT,
  TARGET_USER || undefined,
  QUIET,
  !NO_RAW
);

fetcher
  .run(
    monthNum,
    yearNum,
    todayOnly,
    allBranches,
    lastDaysNum,
    outDirBase,
    ALL_USERS
  )
  .catch((err) => {
    console.error("\n❌ Erro fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
