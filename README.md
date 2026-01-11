# 📚 Biblioteca Popular - Backend API
API RESTful desenvolvida para gerenciar o sistema de biblioteca do Cursinho Popular. O sistema controla o acervo de livros, exemplares físicos, empréstimos, reservas e penalidades de usuários, garantindo a integridade dos dados e regras de negócio automatizadas.


## 🛠 Tecnologias utilizadas
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=neon&logoColor=black)
![Render](https://img.shields.io/badge/Render-%46E3B7.svg?style=for-the-badge&logo=render&logoColor=white)

- **Node.js e Express**: servidor e rotas da API.
- **PostgreSQL**: banco de dados relacional robusto.
- **Neon DB**: hospedagem do banco de dados na nuvem.
- **Render**: plataforma de hospedagem onde a API está rodando.


## ✨ Funcionalidades principais

### Gestão de acervo inteligente
- **Livro e exemplar**: diferenciação clara entre a obra (título, autor) e o item físico (cópia na estante).
- **Etiquetas automáticas**: geração de códigos únicos para cada cópia.
- **Importação em massa**: upload de arquivos CSV para cadastrar centenas de livros de uma vez, com tratamento inteligente de duplicatas.

### Empréstimos e devoluções
- **Validação de estoque**: impede o empréstimo de livros que não têm cópias disponíveis na prateleira.
- **Baixa automática de reservas**: ao efetuar um empréstimo para um aluno que tinha reservado aquele livro, o sistema remove a reserva automaticamente da fila.

### Reservas
- **Fila de espera**: permite reservar apenas livros que estão indisponíveis.
- **Validação de disponibilidade**: impede a reserva de livros que estão sobrando na prateleira.

### Usuários e penalidades
- **Cadastro completo de alunos e administradores**.
- **Histórico de penalidades e bloqueios**.


## 🚀 Como rodar o projeto

### Pré-requisitos
- Node.js (v18 ou superior)
- Banco de Dados PostgreSQL (Local ou Neon)

### Passo a passo
Clone o repositório e instale as dependências: 
```shell
cd biblioteca_cursinho_backend 
npm install
```

Configure as variáveis de ambiente: Crie um arquivo .env na raiz do projeto e preencha com suas credenciais do banco:
```shell
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_HOST=seu_host_neon.aws.neon.tech
DB_PORT=5432
DB_DATABASE=nome_do_banco
DB_SSL=true PORT=3001
```
Inicie o servidor (para desenvolvimento com auto-reload):

```
npm run dev
```

Para produção:

```
npm start
```

O servidor rodará em http://localhost:3001.

## ✏️ Comandos úteis (SQL)
Caso precise limpar os dados de teste (empréstimos/reservas) mantendo os cadastros de livros e usuários intactos:

- Limpa todo o histórico de movimentação 
```
TRUNCATE TABLE emprestimo, reserva, penalidade CASCADE;
```

- Reseta todos os livros para "Disponível" na estante 
```
UPDATE exemplar SET status_disponibilidade = TRUE;
```

## 📝 Formato do CSV para importação
O arquivo deve ser um CSV padrão separado por vírgulas com o seguinte cabeçalho: 
```
isbn,titulo,editora,edicao,categoria,autores,quantidade_exemplares
```
<br>

<div align="center">

**Desenvolvido com 🧡💙 por Inovatec**

</div>
