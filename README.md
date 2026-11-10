# SkyRail L17 · Manutenção

Reconstrução do app de manutenção da Linha 17 Ouro (monotrilho BYD SkyRail): Preventivas, Relatório de atividades e Passagem de turno.

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
aleatória, e a troca é obrigatória no primeiro acesso:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LOGIN_DOMAIN=l17.local \
  npm run criar-usuario -- --re 53000000 --nome "Nome Sobrenome" --perfil tecnico
```
A `service_role` fica só na máquina do admin, nunca no repositório nem no `.env.local` do front.

## Segurança
- Login obrigatório: todas as rotas passam por `RequireAuth`.
- RLS ativo em todas as tabelas; perfis `tecnico`, `supervisor`, `admin`.
- Só a chave **anon** no front. A `service_role` nunca entra no repositório nem no bundle.
- Nenhum dado pessoal (nomes, matrículas, assinaturas) no código, seeds ou testes.
- Fora dos buscadores: meta `noindex`, `robots.txt` e header `X-Robots-Tag` (netlify.toml).

## Fluxo de trabalho
Um branch por funcionalidade, PR revisado antes do merge. Nunca commitar direto na `main`.
