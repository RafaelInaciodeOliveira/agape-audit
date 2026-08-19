# Auditoria Ágape

Ferramenta interna da Prover para auditar o atendimento do **Ágape**, o agente de IA que responde clientes via WhatsApp através da [Umbler UTalk](https://www.umbler.com/br/utalk). Permite revisar cada resposta do Ágape individualmente (não só a conversa inteira), classificar por tópico/subtópico, sinalizar falhas na base de conhecimento, gerar pares de pergunta/resposta para retreinar o agente, e acompanhar tudo isso em relatórios.

## O que dá para fazer

- **Lista de chats sincronizada com a Umbler**, filtrável por atendente (com o Ágape como padrão), status (Entrada / Esperando / Finalizados) e busca por contato/assunto.
- **Auditoria geral do atendimento**: nota de 1 a 5 estrelas + observação, para o chat como um todo.
- **Auditoria por resposta**: clique em qualquer resposta do Ágape na conversa para classificar por tópico/subtópico, marcar violação de diretriz ou falha na base de conhecimento, deixar uma observação, e opcionalmente enviar um par de pergunta/resposta ideal para treinar o agente.
- **CRUD de Tópicos e Subtópicos**, usado para classificar as respostas auditadas.
- **Relatórios** (`/relatorios`): volume de perguntas por tema, qualidade das respostas ao longo do tempo, e exportação em CSV de tudo que foi auditado.

## Stack

**Backend** — `backend/`
- Node.js + [Express](https://expressjs.com/) + TypeScript (rodando via [tsx](https://github.com/privatenumber/tsx))
- [MongoDB](https://www.mongodb.com/) (driver oficial `mongodb`, hospedado no MongoDB Atlas)
- Integração com a API da [Umbler UTalk](https://app-utalk.umbler.com/api/docs/index.html) via `axios` (chats, mensagens, base de conhecimento)

**Frontend** — `frontend/`
- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [lucide-react](https://lucide.dev/) para ícones

## Estrutura

```
backend/
  src/
    server.ts            # API Express: chats, auditorias, tópicos, relatórios
    services/umbler.ts    # integração com a API da Umbler
frontend/
  src/app/
    page.tsx              # tela principal: lista de chats + auditoria
    relatorios/page.tsx   # dashboard de relatórios
```

## Rodando localmente

### Backend

```bash
cd backend
npm install
cp .env.example .env   # preencher com suas credenciais
npm run dev             # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:3000
```

### Variáveis de ambiente (backend/.env)

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor Express (padrão `3001`) |
| `MONGODB_URI` | Connection string do MongoDB Atlas |
| `UMBLER_TOKEN` | Token de API da Umbler UTalk |
| `UMBLER_ORGANIZATION_ID` | ID da organização na Umbler |
| `UMBLER_KB_ID` | ID da base de conhecimento onde os Q&As de treino são salvos |

O frontend aponta para a API em `http://localhost:3001/api` por padrão — ajuste antes de subir em produção.

## Deploy

Pensado para rodar em [Coolify](https://coolify.io/), subindo backend e frontend juntos.
