# SkyRail L17 · Manutenção

Reconstrução do app de manutenção da Linha 17 Ouro (monotrilho BYD SkyRail): Preventivas, Relatório de atividades e Passagem de turno.

[![Netlify Status](https://api.netlify.com/api/v1/badges/f54c196e-ada1-470f-8617-3b024992a76e/deploy-status)](https://app.netlify.com/projects/skyrail/deploys)

## Stack
React + TypeScript + Vite, PWA (vite-plugin-pwa), Supabase (Auth, Postgres com RLS, Storage), Dexie (fila offline).

## Rodar localmente
```bash
cp .env.example .env.local   # preencha URL e chave anon do Supabase
npm install
npm run dev
```

## Scripts
- `npm run dev` servidor local
- `npm run build` typecheck + build de produção
- `npm test` testes (regras de negócio)
- `npm run lint` lint

## Banco
Migrações em `supabase/migrations`. Aplique com a Supabase CLI (`supabase db push`) ou cole no SQL Editor, em ordem.

Testes de RLS num Postgres local (aplica as migrações num banco descartável):
```bash
PGHOST=localhost PGUSER=postgres npm run test:db
```

No painel do Supabase, em Authentication: desative o cadastro público (só o admin cria contas)
e a confirmação de e-mail.

## Usuários
Login com matrícula (RE) e senha pessoal. O admin cria cada conta com uma senha provisória
aleatória, e a troca é obrigatória no primeiro acesso. Os scripts de admin leem um arquivo `.env.admin`
na raiz (fora do git pela regra `.env.*`), sem prefixo `VITE_`:
```bash
# .env.admin
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret key>
LOGIN_DOMAIN=l17.local
```
```bash
npm run criar-usuario -- --re 53000000 --nome "Nome Sobrenome" --perfil tecnico
```
As variáveis também podem vir do ambiente (`SUPABASE_URL=... npm run criar-usuario ...`), que tem prioridade.
A `service_role` fica só na máquina do admin, nunca no repositório nem no `.env` do front
(tudo com `VITE_` vai para o bundle público). Requer Node 22.9 ou mais novo.

## Checklists das preventivas
Os 47 checklists (itens, grupos, portas, medições, guias e ferramentas) são dados no banco, na tabela
`checklist_modelos`. O pacote inicial, convertido do app antigo, fica em `supabase/seed/checklists.json`.
Depois de aplicar a migração `0004_preventivas.sql`, importe com:
```bash
npm run importar-checklists   # usa o .env.admin
```
Pode rodar de novo: atualiza pelo id, e a versão do modelo sobe se o conteúdo mudar.

## Segurança
- Login obrigatório: todas as rotas passam por `RequireAuth`.
- RLS ativo em todas as tabelas; perfis `tecnico`, `supervisor`, `admin`.
- Só a chave **anon** no front. A `service_role` nunca entra no repositório nem no bundle.
- Nenhum dado pessoal (nomes, matrículas, assinaturas) no código, seeds ou testes.
- Fora dos buscadores: meta `noindex`, `robots.txt` e header `X-Robots-Tag` (netlify.toml).

## Fluxo de trabalho
Um branch por funcionalidade, PR revisado antes do merge. Nunca commitar direto na `main`.
