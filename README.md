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
   ```

   **Variáveis obrigatórias:**

   - `GITHUB_TOKEN`: Token de acesso do GitHub com permissões adequadas
   - `ORG_NAME` (ou `ACCOUNT`): Nome da organização ou usuário no GitHub

   **Variáveis opcionais:**

   - `TARGET_USER`: Usuário específico para filtrar commits (gera arquivo adicional)
   - `MONTH`: Mês padrão (1-12)
   - `YEAR`: Ano padrão
   - `TODAY_ONLY`: `true` para processar apenas commits de hoje
   - `ALL_BRANCHES`: `true` para incluir todas as branches (padrão: apenas branch principal)

## Uso

### Comando Básico

```bash
npm start
```

### Opções de Linha de Comando

O script suporta as seguintes opções via argumentos de linha de comando:

#### Período de Tempo

- `--month=<número>`: Especifica o mês (1-12)
- `--year=<número>`: Especifica o ano
- `--today`: Coleta apenas commits do dia atual

#### Configuração de Branches

- `--all-branches`: Inclui commits de todas as branches (padrão: apenas branch principal)

### Exemplos de Uso

#### Exemplos básicos:

```bash
# Commits do mês atual
npm start

# Commits de janeiro de 2024
npm start -- --month=1 --year=2024

# Commits de dezembro de 2023, todas as branches
npm start -- --month=12 --year=2023 --all-branches

# Apenas commits de hoje
npm start -- --today

# Commits de hoje, todas as branches
npm start -- --today --all-branches
```

#### Usando variáveis de ambiente:

```bash
# Definir variáveis e executar
MONTH=10 YEAR=2024 ALL_BRANCHES=true npm start

# Apenas hoje via variável
TODAY_ONLY=true npm start
```

## Estrutura dos Arquivos de Saída

O script gera automaticamente os seguintes arquivos na pasta `output/`:

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

**Gerado apenas quando `TARGET_USER` está definido**

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

## Funcionalidades

### 🚀 Principais Recursos

- **Coleta de commits**: Busca commits de organizações ou usuários do GitHub
- **Filtro por período**: Suporte a mês/ano específico ou apenas dia atual
- **Suporte a múltiplas branches**: Opção de incluir todas as branches ou apenas a principal
- **Filtro por usuário**: Geração de relatório específico para um usuário
- **Prevenção de duplicados**: Usa SHA do commit para evitar commits duplicados
- **Rate limit**: Monitora e exibe informações do rate limit da API
- **Suporte a orgs e users**: Funciona com organizações e usuários individuais
- **Ordenação cronológica**: Commits organizados por data

### 📊 Estatísticas Geradas

- Total de commits únicos processados
- Ranking de autores por número de commits
- Commits específicos por usuário (quando configurado)
- Estatísticas por repositório e branch

## Erros Comuns e Soluções

### Problemas de Configuração

- **Erro: `Erro: defina GITHUB_TOKEN e ORG_NAME (ou ACCOUNT) no .env ou variáveis de ambiente`**
  - Certifique-se de que o arquivo `.env` está configurado corretamente com as variáveis obrigatórias.

### Problemas de API

- **Erro: `HTTP 404 Not Found`**

  - Verifique se o nome da organização (`ORG_NAME`) está correto.
  - Certifique-se de que o token do GitHub tem permissões para acessar os repositórios.

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

- **Nenhum commit encontrado no período**
  - Verifique se o período especificado está correto.
  - Confirme se há commits no período para a organização/usuário especificado.
  - Use `--all-branches` se os commits estão em outras branches.

## Scripts Disponíveis

- `npm start`: Executa o script principal com ts-node
- `npm start -- <opções>`: Executa com opções específicas

## Exemplos Avançados

### Análise Completa de uma Organização

```bash
# Todos os commits de 2024, todas as branches
npm start -- --year=2024 --all-branches
```

### Monitoramento Diário

```bash
# Commits de hoje com usuário específico
TARGET_USER=raulzrrs npm start -- --today --all-branches
```

### Relatórios Mensais

```bash
# Outubro 2024 com filtro de usuário
npm start -- --month=10 --year=2024
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
