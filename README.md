GitHub Commit Fetcher

Descrição

O GitHub Commit Fetcher é um script Node.js que coleta commits de um usuário específico dentro de uma organização no GitHub e os organiza por data em um arquivo JSON.

Requisitos

Node.js v16 ou superior

Um token de acesso do GitHub com permissões adequadas para acessar os repositórios da organização

Um arquivo .env com as credenciais necessárias

Configuração

Clone este repositório:

git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio

Instale as dependências:

npm install

Crie um arquivo .env na raiz do projeto e adicione as seguintes variáveis:

GITHUB_TOKEN=seu_token_aqui
ORG_NAME=nome_da_organizacao
TARGET_USER=usuario_alvo

Uso

Para rodar o script, utilize o seguinte comando:

npm start -- --month <mês> --year <ano>

Exemplos:

Para obter commits de janeiro de 2024:

npm start -- --month 1 --year 2024

Para obter commits do mês atual:

npm start

Estrutura do Arquivo de Saída

Os commits serão salvos em um arquivo JSON no seguinte formato:

{
  "01/02/2024": [
    {
      "repo": "organizacao/repo1",
      "message": "Correção de bug no sistema",
      "author": "Nome do Autor",
      "date": "2024-02-01T12:34:56Z"
    }
  ],
  "02/02/2024": [
    {
      "repo": "organizacao/repo2",
      "message": "Adicionando nova funcionalidade",
      "author": "Outro Autor",
      "date": "2024-02-02T15:20:10Z"
    }
  ]
}

Erros Comuns e Soluções

Erro: Erro na requisição: 404 Not Found

Verifique se o nome da organização (ORG_NAME) está correto.

Certifique-se de que o token do GitHub tem permissões para acessar os repositórios.

Erro: Erro: O token do GitHub não está definido

Certifique-se de que o arquivo .env está configurado corretamente e carregado no ambiente.

Erro: Erro ao obter repositórios: API rate limit exceeded

O GitHub tem limites de requisições. Caso atinja o limite, aguarde um tempo ou use um token com permissões elevadas.

Contribuição

Contribuições são bem-vindas! Para contribuir:

Fork este repositório

Crie uma branch (git checkout -b minha-feature)

Commit suas modificações (git commit -m 'Minha nova feature')

Envie para a branch principal (git push origin minha-feature)

Abra um Pull Request

Licença

Este projeto está licenciado sob a MIT License.
