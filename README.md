# Prumo — API (Node.js)

Backend do Prumo: Express + TypeScript + Prisma (SQLite em dev, Postgres em produção).

## Rodar

```bash
npm install
cp .env.example .env
npx prisma migrate dev --name init
npm run dev
```

API em `http://localhost:3333`.

## Endpoints principais

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/auth/register` | Cria usuário e retorna JWT |
| POST | `/auth/login` | Autentica e retorna JWT |
| GET | `/accounts` | Contas com saldo **derivado** dos lançamentos |
| POST | `/transactions/expenses` | Despesa (conta ou cartão, com parcelas) |
| POST | `/transactions/incomes` | Receita |
| POST | `/transactions/transfers` | Transferência (origem ≠ destino) |
| PATCH | `/transactions/:id/pay` | Marca lançamento pendente como pago |
| GET | `/cards` | Cartões com limite usado/disponível |
| POST | `/cards/invoices/:id/pay` | Paga fatura debitando uma conta |
| GET/POST | `/recurring`, `/debts`, `/goals` | Contas fixas, dívidas e metas |

## Arquitetura

- `src/modules/<feature>/` — rotas + serviços por domínio
- `src/domain/finance.ts` — regras financeiras puras (parcelas, faturas, saldos),
  espelhando as regras do app
- `src/middlewares/` — auth JWT e tratamento central de erros (inclui Zod)
- `prisma/schema.prisma` — modelo relacional completo

Saldos nunca são armazenados: `GET /accounts` calcula a partir dos lançamentos,
então editar/excluir qualquer lançamento mantém tudo consistente.
# prumo-api
