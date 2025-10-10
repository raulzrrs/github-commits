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

class GitHubCommitFetcher {
  private token: string;
  private account: string;
  private targetUser?: string;
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
  private processedCommitShas: Set<string> = new Set(); // Para evitar duplicados

  constructor(token: string, account: string, targetUser?: string) {
    this.token = token;
    this.account = account;
    this.targetUser = targetUser;
    this.HEADERS = {
      Authorization: `token ${this.token}`,
      "User-Agent": "github-commit-fetcher",
      Accept: "application/vnd.github+json",
    };
  }

  private async fetchJson(url: string): Promise<any> {
    const fetch = await getFetch();
    const res = await fetch(url, { headers: this.HEADERS });
    const rl = res.headers?.get
      ? res.headers.get("x-ratelimit-remaining")
      : null;
    if (rl !== null) {
      console.log(`[RateLimit] remaining: ${rl}`);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt}`);
    }
    return res.json();
  }

  // tenta orgs primeiro, se não retornar repositórios tenta users
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
        console.warn(
          `Aviso ao consultar ${base}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
      if (foundAny) break; // se achou em um endpoint, não tenta o outro
    }

    return allRepos;
  }

  private async getBranches(repoFullName: string): Promise<BranchRaw[]> {
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
        // warnings (ex: 409 repo vazio) e continua
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
    // prioriza login, depois nome do author do commit, depois committer, enfim "unknown"
    return (
      commit.author?.login ||
      commit.commit?.author?.name ||
      commit.commit?.committer?.name ||
      "unknown"
    );
  }

  public async run(
    month?: number,
    year?: number,
    todayOnly: boolean = false,
    allBranches: boolean = true
  ): Promise<void> {
    const today = new Date();
    let firstDay: Date;
    let lastDay: Date;

    if (todayOnly) {
      // Apenas hoje
      firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      lastDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
        999
      );
    } else {
      const m = month ?? today.getMonth() + 1; // 1..12
      const y = year ?? today.getFullYear();
      firstDay = new Date(y, m - 1, 1);
      lastDay = new Date(y, m, 0); // último dia do mês
      lastDay.setHours(23, 59, 59, 999); // garante inclusão do dia todo
    }

    console.log(
      `Coletando commits da conta ${this.account} de ${this.formatDatePtBR(
        firstDay
      )} a ${this.formatDatePtBR(lastDay)}.`
    );
    console.log(
      `Modo: ${allBranches ? "TODAS as branches" : "apenas branch padrão"}`
    );

    const repos = await this.getRepos();
    console.log(`Repositórios encontrados: ${repos.length}`);

    // percorre sequencialmente (menos chance de estourar rate limit)
    for (const repo of repos) {
      const repoFull = repo.full_name || `${repo.owner?.login}/${repo.name}`;
      console.log(`-> repo: ${repoFull}`);

      // Busca todas as branches do repositório
      const branches = await this.getBranches(repoFull);
      console.log(`   branches encontradas: ${branches.length}`);

      if (branches.length === 0) continue;

      // Se não for --all-branches, filtrar só a default branch
      const branchesToUse = allBranches
        ? branches
        : branches.filter((b) => b.name === repo.default_branch);

      console.log(`   branches a processar: ${branchesToUse.length}`);

      // Para cada branch, busca os commits
      for (const branch of branchesToUse) {
        const branchName = branch.name;
        console.log(`   -> branch: ${branchName}`);

        const commits = await this.getCommits(
          repoFull,
          branchName,
          firstDay,
          lastDay
        );
        console.log(
          `      commits encontrados nesta branch: ${commits.length}`
        );

        if (commits.length === 0) continue;

        for (const c of commits) {
          // Evita duplicados usando SHA do commit
          if (this.processedCommitShas.has(c.sha)) {
            continue;
          }
          this.processedCommitShas.add(c.sha);

          // salvar raw para debug
          this.rawCommits.push({
            ...c,
            _branch: branchName, // adiciona info da branch
            _repo: repoFull,
          });

          // data do commit (author.date ou committer.date)
          const dateStr = c.commit?.author?.date || c.commit?.committer?.date;
          if (!dateStr) continue;
          const commitDate = new Date(dateStr);
          if (commitDate < firstDay || commitDate > lastDay) continue;

          const dayKey = this.formatDatePtBR(commitDate);
          const authorKey = this.getAuthorKey(c);

          // Estrutura aninhada: dia -> repo -> lista de commits
          if (!this.commitsByDay[dayKey]) {
            this.commitsByDay[dayKey] = {};
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

          this.commitsByUser[authorKey] =
            (this.commitsByUser[authorKey] || 0) + 1;
        }
      }
    }

    // grava arquivos
    const outDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const yearStr = (year ?? today.getFullYear()).toString();
    const monthStr = String(month ?? today.getMonth() + 1).padStart(2, "0");

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

    await fs.promises.writeFile(
      rawFile,
      JSON.stringify(this.rawCommits, null, 2)
    );

    // ordena as datas do objeto
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

    await fs.promises.writeFile(
      byDayFile,
      JSON.stringify(orderedCommitsByDay, null, 2)
    );

    const ranking = Object.entries(this.commitsByUser).sort(
      (a, b) => b[1] - a[1]
    );
    await fs.promises.writeFile(rankingFile, JSON.stringify(ranking, null, 2));

    console.log(`\nArquivos gerados:`);
    console.log(` - raw: ${rawFile}`);
    console.log(` - por dia: ${byDayFile}`);
    console.log(` - ranking: ${rankingFile}`);

    // NOVA LÓGICA: Ranking específico do TARGET_USER
    if (this.targetUser) {
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

      // Filtra commits apenas do TARGET_USER
      Object.entries(orderedCommitsByDay).forEach(([day, repoCommits]) => {
        Object.entries(repoCommits).forEach(([repo, commits]) => {
          const userCommits = commits.filter(
            (commit) =>
              commit.author === this.targetUser ||
              commit.author.toLowerCase() === this.targetUser?.toLowerCase()
          );
          if (userCommits.length > 0) {
            if (!targetUserCommitsByDay[day]) {
              targetUserCommitsByDay[day] = {};
            }
            targetUserCommitsByDay[day][repo] = userCommits;
          }
        });
      });

      const targetUserFile = path.join(
        outDir,
        `commits_${this.targetUser}_${yearStr}_${monthStr}.json`
      );

      await fs.promises.writeFile(
        targetUserFile,
        JSON.stringify(targetUserCommitsByDay, null, 2)
      );

      console.log(
        ` - commits do usuário ${this.targetUser}: ${targetUserFile}`
      );

      // Conta total de commits do TARGET_USER
      const totalUserCommits = Object.values(targetUserCommitsByDay)
        .flatMap((dayRepos) => Object.values(dayRepos))
        .flat().length;

      console.log(
        `\n👤 Commits de ${this.targetUser}: ${totalUserCommits} commits no período`
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

// leitura de variáveis
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const ACCOUNT = process.env.ORG_NAME || process.env.ACCOUNT || "";
const TARGET_USER = process.env.TARGET_USER || "";
const monthArg = parseCliArg("month") || process.env.MONTH;
const yearArg = parseCliArg("year") || process.env.YEAR;
const todayOnly = hasCliFlag("today") || process.env.TODAY_ONLY === "true";
const allBranches =
  hasCliFlag("all-branches") || process.env.ALL_BRANCHES === "true";

if (!GITHUB_TOKEN || !ACCOUNT) {
  console.error(
    "Erro: defina GITHUB_TOKEN e ORG_NAME (ou ACCOUNT) no .env ou variáveis de ambiente."
  );
  process.exit(1);
}

const monthNum = monthArg ? parseInt(monthArg, 10) : undefined;
const yearNum = yearArg ? parseInt(yearArg, 10) : undefined;

const fetcher = new GitHubCommitFetcher(
  GITHUB_TOKEN,
  ACCOUNT,
  TARGET_USER || undefined
);

fetcher.run(monthNum, yearNum, todayOnly, allBranches).catch((err) => {
  console.error("Erro fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
