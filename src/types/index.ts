// Tipos para os dados da API do GitHub
export type RepoRaw = any;
export type CommitRaw = any;
export type BranchRaw = any;

// Tipos para estruturas internas
export interface CommitInfo {
  message: string;
  author: string;
  date: string;
  branch: string;
}

export interface CommitsByDay {
  [day: string]: {
    [repo: string]: CommitInfo[];
  };
}

export interface CommitsByUser {
  [user: string]: number;
}

export interface CliConfig {
  month?: number;
  year?: number;
  todayOnly: boolean;
  allBranches: boolean;
  lastDays?: number;
  outDirBase: string;
  allUsers: boolean;
  quiet: boolean;
  saveRaw: boolean;
  githubToken: string;
  account: string;
  targetUser?: string;
}

export interface FetcherOptions {
  token: string;
  account: string;
  targetUser?: string;
  quiet?: boolean;
  saveRaw?: boolean;
}
