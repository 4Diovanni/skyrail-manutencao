# SkyRail Manutenção — guia para quem programa (pessoas e IA)

App de manutenção da Linha 17 Ouro (monotrilho BYD SkyRail): Relatório de atividades (com PDF),
Preventivas e Passagem de turno. Responder e documentar em português.

## Uso e design (diretriz do produto)

- **O uso é essencialmente pelo celular.** Técnicos preenchem relatórios, fotos e assinaturas em campo,
  com uma mão, às vezes sem internet. Toda tela de técnico é pensada primeiro para ~360–430 px de largura.
- **Configuração e gerenciamento são feitos no PC**, por quem tem cargo maior (perfis `supervisor` e `admin`):
  aprovar reprogramação, baixar PDFs, gerenciar usuários e, no futuro, checklists e relatórios gerenciais.
  Essas telas podem aproveitar a largura do PC, mas continuam funcionando no celular.
- **Design simples, direto ao ponto e agradável.** Poucos elementos por tela, texto claro, sem enfeite.
  O objetivo é o técnico terminar o registro rápido e sem erro.

Regras práticas de layout:

- Mobile first: escreva o CSS para o celular e use `@media (min-width: …)` para ampliar no PC.
- Alvos de toque com pelo menos 40–44 px de altura; nada de botões minúsculos.
- Nenhuma rolagem horizontal da página. Em grids, itens com `min-width: 0` e colunas `minmax(0, 1fr)`.
- Imagens com `<img>` e `object-fit: contain` dentro de uma caixa de proporção fixa, sempre com estado
  de carregando/erro visível (nunca uma caixa cinza vazia).
- Verifique toda mudança visual em largura de celular (ex.: Pixel 5) e de PC (1280 px) antes do PR.

## Stack

React + TypeScript (strict) + Vite, Supabase (Postgres, Auth, Storage), PWA com suporte offline
(Dexie/IndexedDB para rascunhos, fila e fotos). PDFs com pdf-lib. Não trocar a stack sem aprovação do Giovanni.

Comandos: `npm run dev`, `npm run build`, `npm test` (Vitest), `npx oxlint src`, `scripts/test-db.sh` (RLS em Postgres local).

## Segurança (não negociável)

- Login obrigatório; nenhuma tela com dados sem autenticação.
- RLS em todas as tabelas; cada usuário vê só o que deve. Tabela nova precisa de policy e de teste em `supabase/tests/`.
- Assinatura enviada e aplicada apenas pela própria pessoa; nunca embutida no código.
- Nenhum dado pessoal real (nomes, matrículas, assinaturas), segredo ou chave privada no repositório, no bundle,
  em seeds, testes ou exemplos. No front só vai a anon key; a service_role nunca sai do servidor/script local.
- Nunca montar HTML com `innerHTML` a partir de dados do usuário.
- Site fora dos buscadores (noindex, robots.txt, `X-Robots-Tag`).

## Arquitetura

- Módulos pequenos e tipados em `src/modules/<modulo>/{domain,data,ui,pdf}`.
- Regras de negócio ficam em `domain/` (sem Supabase nem DOM) e têm testes.
- Checklists são dados no banco, renderizados por um componente genérico.
- Passagem de turno consulta o banco, não PDFs.

## Git

Branch por funcionalidade, commits pequenos e descritivos, PR para revisão do Giovanni (4Diovanni).
Nunca commitar direto na `main`.

### Homologação antes da produção (regra do Giovanni)

- **Tudo é aplicado primeiro em homologação e só depois na `main` (produção).** Vale para código,
  migrações do banco, configuração do Supabase (Auth, Storage) e variáveis da Netlify.
- PR de funcionalidade aponta para a branch `homologacao`, nunca direto para a `main`.
- Depois do merge na `homologacao`, a Netlify publica o site de homol (Supabase de homologação) e o
  workflow `Homologação` testa o site publicado. Se falhar, ele abre uma issue, comenta no PR e nada sobe.
- Só com o `Homologação` verde abre-se o PR `homologacao` → `main`. O CI recusa PR para a `main`
  que venha de outra branch.
- Migração nova roda primeiro no Supabase de homologação; na produção, só depois de testada lá.

### Pipelines (GitHub Actions)

- `ci.yml` (todo PR): tipos, oxlint, Vitest, build, testes de RLS, checagem de segredos no repositório
  e no bundle (`scripts/checar-segredos.mjs`), `npm audit` das dependências do app e a regra do fluxo acima.
- `homologacao.yml` (merge na `homologacao`): espera a Netlify publicar o commit (`/versao.json`) e roda
  `scripts/testar-homol.mjs` (página, noindex, bundle apontando para o Supabase de homol, Auth no ar,
  login de usuário fictício, tela de login no Pixel 5 sem erro de JS).

### Prova de teste em todo PR (regra do Giovanni)

- Toda mudança testada no app vem com **prints do celular (ex.: Pixel 5) e do PC (1280 px)** mostrando o efeito,
  na descrição do PR e na conversa com o Giovanni. PDFs gerados entram como imagem da página.
- Se o teste foi **só de código** (testes automáticos, sem abrir o app), o PR diz isso com todas as letras.
- Diga também com que dados foi testado: Supabase real ou servidor simulado, sempre com dados fictícios.
- As imagens dos PRs ficam na branch `prints` (pasta `pr-<número>/`), fora do código do app.
