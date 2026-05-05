<img src="logo.webp" alt="Texto alternativo" width="500">

# GitHub Commit Fetcher

## Descrição

O **GitHub Commit Fetcher** é um script Node.js que coleta commits de um usuário específico dentro de uma organização no GitHub e os organiza por data em um arquivo JSON.

## Requisitos

- **Node.js v16 ou superior** (recomendado v18+ para suporte nativo ao fetch)
- **Token de acesso do GitHub** com permissões adequadas para acessar os repositórios da organização
- **Acesso à API do GitHub** (rate limit: 5000 requisições/hora para tokens autenticados)

## Dependências

### Dependências de Produção

- `dotenv`: Carregamento de variáveis de ambiente
- `node-fetch`: Requisições HTTP (fallback para Node < 18)

### Dependências de Desenvolvimento

- `typescript`: Compilador TypeScript
- `ts-node`: Execução direta de arquivos TypeScript
- `@types/node` e `@types/node-fetch`: Definições de tipos

> **Nota**: O script detecta automaticamente se o fetch está disponível nativamente (Node 18+) ou usa o node-fetch como fallback.

## Configuração

1. Clone este repositório:

   ```bash
   git clone https://github.com/seu-usuario/seu-repositorio.git
   cd seu-repositorio
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Crie um arquivo `.env` na raiz do projeto e adicione as seguintes variáveis:

   ```env
   GITHUB_TOKEN=seu_token_aqui
   ORG_NAME=nome_da_organizacao
   TARGET_USER=usuario_alvo
   OPENAI_API_KEY=sua_chave_openai_aqui
   OPENAI_MODEL=gpt-5
   OPENAI_INSTRUCTION=Analise os commits retornados do GitHub e gere um resumo executivo com principais entregas, riscos e destaques por repositorio.
   ```

   **Variáveis obrigatórias:**

   - `GITHUB_TOKEN`: Token de acesso do GitHub com permissões adequadas
   - `ORG_NAME` (ou `ACCOUNT`): Nome da organização ou usuário no GitHub
   - `OPENAI_API_KEY`: Chave da API da OpenAI
   - `OPENAI_INSTRUCTION`: Instrução enviada para a OpenAI junto com os commits

   **Variáveis opcionais:**

   - `TARGET_USER`: Usuário específico para filtrar commits (obrigatório quando não usar `--all-users`)
   - `MONTH`: Mês padrão (1-12)
   - `YEAR`: Ano padrão
   - `LAST_DAYS`: Número de dias para análise retrospectiva
   - `TODAY_ONLY`: `true` para processar apenas commits de hoje
   - `ALL_BRANCHES`: `true` para incluir todas as branches (padrão: apenas branch principal)
   - `ALL_USERS`: `true` para incluir commits de todos os usuários
   - `MAIN_ONLY`: `true` para forçar apenas branch principal
   - `QUIET`: `true` para reduzir logs de saída
   - `NO_RAW`: `true` para não salvar arquivo raw de commits
   - `OUT_DIR`: Diretório base para arquivos de saída
   - `OPENAI_MODEL`: Modelo usado na análise da OpenAI (padrão: `gpt-5`)
   - `OPENAI_OUTPUT_FILE`: Caminho customizado para salvar a resposta da OpenAI

## Uso

### Comando Básico

```bash
npm start
```

### Opções de Linha de Comando

O script suporta as seguintes opções via argumentos de linha de comando:

#### Período de Tempo (Precedência: today > last-days > month/year)

- `--today`: Coleta apenas commits do dia atual
- `--last-days=<número>`: Analisa os últimos N dias (ex.: `--last-days=10`)
- `--month=<número>`: Especifica o mês (1-12)
- `--year=<número>`: Especifica o ano

#### Configuração de Branches

- `--all-branches`: Inclui commits de todas as branches
- `--main-only`: Processa apenas a branch padrão (default)

#### Configuração de Usuários

- `--all-users`: Inclui commits de todos os usuários
- Por padrão: apenas commits do usuário definido em `TARGET_USER`

#### Outras Opções

- `--quiet`: Reduz a quantidade de logs de saída
- `--no-raw`: Não salva o arquivo `raw_commits_*.json`
- `--out-dir=<caminho>`: Define diretório base para arquivos de saída
- `--help` ou `-h`: Exibe ajuda completa

### Exemplos de Uso

#### Exemplos básicos:

```bash
# Commits do mês atual (apenas do usuário TARGET_USER)
npm start

# Commits de janeiro de 2024
npm start -- --month=1 --year=2024

# Commits de dezembro de 2023, todas as branches
npm start -- --month=12 --year=2023 --all-branches

# Apenas commits de hoje
npm start -- --today

# Commits de hoje, todas as branches
npm start -- --today --all-branches

# Últimos 7 dias, todos os usuários
npm start -- --last-days=7 --all-users

# Últimos 30 dias, todas as branches, todos os usuários
npm start -- --last-days=30 --all-branches --all-users
```

#### Usando variáveis de ambiente:

```bash
# Definir variáveis e executar
MONTH=10 YEAR=2024 ALL_BRANCHES=true npm start

# Apenas hoje via variável
TODAY_ONLY=true npm start

# Todos os usuários via variável
ALL_USERS=true npm start

# Últimos 15 dias via variável
LAST_DAYS=15 npm start
```

#### Exemplos avançados:

```bash
# Salvar em diretório personalizado
npm start -- --today --out-dir=./data

# Modo silencioso sem arquivo raw
npm start -- --month=10 --year=2024 --quiet --no-raw

# Ajuda completa
npm start -- --help
```

## Estrutura dos Arquivos de Saída

O script gera automaticamente os seguintes arquivos na pasta `output/YYYY/MM/`:

### 1. Commits por Dia (`commits_by_day_YYYY_MM.json`)

Organiza os commits por data e repositório:

```json
{
  "01/10/2024": {
    "organizacao/repo1": [
      {
        "message": "Correção de bug no sistema",
        "author": "Nome do Autor",
        "date": "2024-10-01T12:34:56Z",
        "branch": "main"
      }
    ]
  },
  "02/10/2024": {
    "organizacao/repo2": [
      {
        "message": "Adicionando nova funcionalidade",
        "author": "Outro Autor",
        "date": "2024-10-02T15:20:10Z",
        "branch": "feature/nova-func"
      }
    ]
  }
}
```

### 2. Ranking de Commits (`ranking_YYYY_MM.json`)

Lista ordenada dos autores por número de commits:

```json
[
  ["joão.silva", 45],
  ["maria.santos", 32],
  ["pedro.oliveira", 28]
]
```

### 3. Commits Brutos (`raw_commits_YYYY_MM.json`)

Dados completos dos commits retornados pela API do GitHub, incluindo:

- Informações detalhadas do commit
- Metadados da branch (`_branch`)
- Metadados do repositório (`_repo`)

### 4. Commits por Usuário (`commits_USUARIO_YYYY_MM.json`)

**Gerado apenas quando `TARGET_USER` está definido e não está usando `--all-users`**

Filtra e organiza commits de um usuário específico:

```json
{
  "01/10/2024": {
    "organizacao/repo1": [
      {
        "message": "Fix: correção no login",
        "author": "raulzrrs",
        "date": "2024-10-01T09:15:30Z",
        "branch": "hotfix/login"
      }
    ]
  }
}
```

### 5. Resposta da OpenAI (`openai_response_YYYY_MM.md`)

Arquivo em Markdown com o retorno da OpenAI, gerado a partir dos commits por dia, ranking, período, escopo de usuários e estatísticas da coleta. O conteúdo é guiado pela variável `OPENAI_INSTRUCTION`.

**Nota:** O arquivo por usuário específico só é gerado quando não está no modo `--all-users`.

## Funcionalidades

### 🚀 Principais Recursos

- **Coleta de commits**: Busca commits de organizações ou usuários do GitHub
- **Filtro por período flexível**: Suporte a:
  - Dia específico (`--today`)
  - Últimos N dias (`--last-days=N`)
  - Mês/ano específico (`--month=MM --year=YYYY`)
- **Suporte a múltiplas branches**: Opção de incluir todas as branches ou apenas a principal
- **Filtro por usuário**: Modo específico para um usuário ou todos os usuários
- **Otimização de performance**:
  - Cache de branches para evitar requisições duplicadas
  - Filtro por repositórios ativos (baseado em `pushed_at`)
  - Controle de concorrência para branches
- **Prevenção de duplicados**: Usa SHA do commit para evitar commits duplicados
- **Rate limit**: Monitora e exibe informações do rate limit da API
- **Suporte a orgs e users**: Funciona com organizações e usuários individuais
- **Ordenação cronológica**: Commits organizados por data
- **Configuração flexível**: Suporte a variáveis de ambiente e flags de linha de comando
- **Organização de arquivos**: Estrutura hierárquica por ano/mês
- **Detecção de erros**: Validação de autenticação e tratamento de erros da API

### 📊 Estatísticas Geradas

- Total de commits únicos processados
- Ranking de autores por número de commits
- Commits específicos por usuário (quando configurado)
- Estatísticas por repositório e branch

## Erros Comuns e Soluções

### Problemas de Configuração

- **Erro: `Erro: defina GITHUB_TOKEN e ORG_NAME (ou ACCOUNT) no .env ou variáveis de ambiente`**

  - Certifique-se de que o arquivo `.env` está configurado corretamente com as variáveis obrigatórias.

- **Erro: `Erro de configuração: por padrão só listamos um usuário, mas TARGET_USER não foi definido`**
  - Defina `TARGET_USER` no `.env` ou use a flag `--all-users` para incluir todos os usuários.

- **Erro: `Erro: defina OPENAI_API_KEY e OPENAI_INSTRUCTION no .env ou variáveis de ambiente`**
  - Defina a chave da OpenAI e a instrução que deve guiar a análise dos commits.

### Problemas de API

- **Erro: `HTTP 404 Not Found`**

  - Verifique se o nome da organização (`ORG_NAME`) está correto.
  - Certifique-se de que o token do GitHub tem permissões para acessar os repositórios.

- **Erro: `Falha de autenticação na API do GitHub`**

  - Verifique se o `GITHUB_TOKEN` está correto e não expirou.
  - Confirme se o token tem as permissões necessárias para acessar a organização/conta.

- **Erro: `API rate limit exceeded`**
  - O GitHub tem limites de requisições (5000/hora para tokens autenticados).
  - Aguarde um tempo ou use um token com permissões elevadas.
  - O script monitora automaticamente o rate limit e exibe informações no console.

### Problemas de Dependências

- **Erro: `fetch não disponível`**
  - Use Node.js versão 18 ou superior (fetch nativo).
  - Ou instale o node-fetch: `npm install node-fetch`

### Problemas de Dados

- **Warning: `Warn getCommits repo/branch: HTTP 409`**

  - Indica repositório vazio ou branch sem commits.
  - Não é um erro crítico, o script continua processando outros repositórios.

- **Warning: `Nenhum repositório encontrado para a conta`**

  - Verifique se a conta/organização existe.
  - Confirme se o token tem permissão para acessar os repositórios.
  - Verifique se o nome da conta está correto (case-sensitive).

- **Warning: `Nenhum repositório com atividade recente no período especificado`**

  - Indica que não há repositórios com commits no período selecionado.
  - Tente expandir o período ou usar `--all-branches`.

- **Nenhum commit encontrado no período**
  - Verifique se o período especificado está correto.
  - Confirme se há commits no período para a organização/usuário especificado.
  - Use `--all-branches` se os commits estão em outras branches.
  - Use `--all-users` se estiver filtrando apenas um usuário específico.

## Scripts Disponíveis

- `npm start`: Executa o script principal com ts-node
- `npm start -- <opções>`: Executa com opções específicas

## Exemplos Avançados

### Análise Completa de uma Organização

```bash
# Todos os commits de 2024, todas as branches, todos os usuários
npm start -- --year=2024 --all-branches --all-users
```

### Monitoramento Diário

```bash
# Commits de hoje com usuário específico
TARGET_USER=raulzrrs npm start -- --today --all-branches

# Commits de hoje, todos os usuários
npm start -- --today --all-users --all-branches
```

### Relatórios Retrospectivos

```bash
# Últimos 15 dias, todos os usuários
npm start -- --last-days=15 --all-users --all-branches

# Últimos 7 dias, apenas usuário específico
npm start -- --last-days=7
```

### Relatórios Mensais

```bash
# Outubro 2024 com filtro de usuário
npm start -- --month=10 --year=2024

# Outubro 2024, todos os usuários
npm start -- --month=10 --year=2024 --all-users
```

### Configurações Específicas

```bash
# Salvar em diretório personalizado, modo silencioso
npm start -- --today --out-dir=./reports --quiet

# Sem arquivo raw, apenas estatísticas
npm start -- --month=10 --year=2024 --no-raw
```

## Contribuição

Contribuições são bem-vindas! Para contribuir:

1. Fork este repositório
2. Crie uma branch (`git checkout -b minha-feature`)
3. Commit suas modificações (`git commit -m 'Minha nova feature'`)
4. Envie para a branch principal (`git push origin minha-feature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).
