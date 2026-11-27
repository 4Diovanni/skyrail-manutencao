# Manual de uso · SkyRail L17 Manutenção

Guia curto para começar a usar o app. A parte 1 é para técnicos (uso no celular, em campo).
A parte 2 é para supervisores e administradores (uso no PC). A instalação técnica está no `README.md`.

---

## Parte 1 · Técnico

### Instalar no celular

1. Abra o link do app no navegador do celular (Chrome no Android, Safari no iPhone).
2. No menu do navegador, toque em **Adicionar à tela inicial** (ou **Instalar app**).
3. A partir daí, abra pelo ícone. O app funciona mesmo sem internet depois do primeiro acesso.

### Entrar

1. Digite a sua **matrícula (RE)**, só números, e a senha.
2. No **primeiro acesso**, o app pede para trocar a senha provisória por uma senha só sua.
3. Depois, o app mostra a **política de uso**. Marque "Li e aceito" e toque em **Aceitar e continuar** (precisa de internet).
   Quando o texto da política mudar, o app pede o aceite de novo. Para reler, abra **Política de uso** no menu.
4. Esqueceu a senha? Peça ao administrador uma nova senha provisória.

O selo no topo mostra **Online** ou **Sem internet**. O menu (☰) leva a todas as telas.

### Cadastrar a sua assinatura (uma vez)

1. Menu → **Minha assinatura**.
2. Assine com o dedo no quadro, ou envie uma foto da assinatura em fundo branco, e toque em salvar.
3. A assinatura **só aparece num documento quando você toca em “Assinar”** na atividade ou preventiva.
   Só você pode enviar ou trocar a sua assinatura.

### Relatório de atividades (corretivas e preventivas do dia)

1. Menu → **Relatório**. Escolha o dia e a categoria (Corretiva ou Preventiva).
2. Toque em **+ Nova corretiva** (ou **+ Nova preventiva**) e preencha: título, local, sistema, equipe, tempos da atuação, status e fotos.
   - As fotos são comprimidas no aparelho. A legenda aparece embaixo de cada foto no PDF.
   - Se a atividade **não foi realizada** ou precisa de outra data, marque **Pedir reprogramação** e
     escreva o motivo.
3. Tudo fica **salvo no aparelho** enquanto você preenche. Só vai para o servidor ao tocar em **Enviar**.
4. Depois de enviada, na lista do dia:
   - **Assinar**: confirma a sua assinatura nesta versão da atividade.
   - **PDF**: gera o relatório (e a OS ou RM) e guarda em **Documentos**.

Para corrigir uma atividade enviada, toque nela, ajuste e envie de novo. O servidor guarda a versão anterior.

### Preventivas (checklists)

1. Menu → **Preventivas** → **+ Nova preventiva**.
2. Escolha o **sistema** e depois a **preventiva**. O checklist abre já montado.
3. Preencha identificação, itens do checklist (OK / NOK, medições), ocorrências e fotos, tempos e situação.
4. Toque em **Enviar**. Depois, use **Assinar** e **PDF** como no Relatório.

Os checklists ficam guardados no aparelho depois que a tela é aberta com internet uma vez.

### Passagem de turno

1. Menu → **Passagem de turno**. O app já abre no dia e turno atuais (Diurno ou Noturno).
2. **Atividades do turno** vem sozinho do Relatório e das Preventivas enviados. Para corrigir algo ali,
   edite a atividade no módulo dela.
3. Preencha **Encerramento e transferência** e toque em **Enviar**.
4. Depois de enviada: **PDF** gera e guarda em Documentos; **E-mail** copia o texto pronto para colar
   no e-mail da passagem.

Se outra pessoa enviou a passagem do mesmo turno depois que você abriu, o app avisa antes de substituir.
A versão anterior fica no histórico.

### Sem internet

- Pode preencher e tocar em **Enviar** normalmente. O registro fica **na fila** no aparelho.
- O app envia sozinho quando a internet volta, ao abrir o app e a cada 30 minutos, **com o app aberto**.
- Um aviso no topo da tela mostra o resultado: **enviado**, **na fila** ou **falhou** (com o motivo).
  Se falhar, o registro continua salvo no aparelho e é tentado de novo.
- Na lista, cada item mostra se está como rascunho, na fila ou com erro, e há o botão **Tentar agora** (Relatório) ou **Enviar agora** (Preventivas).

### Celular compartilhado

- Cada pessoa vê e envia **só os próprios rascunhos**. Ao trocar de usuário, os rascunhos de quem saiu
  ficam guardados, mas escondidos, e são enviados quando essa pessoa entrar de novo.
- Antes de **Sair**, o app avisa se você ainda tem registros não enviados.

---

## Parte 2 · Supervisor e administrador

As telas funcionam no celular, mas são mais confortáveis no PC.

### Documentos (todos os usuários ativos)

Menu → **Documentos**: PDFs gerados no app (registros de manutenção e passagens de turno), separados por dia
e turno. Toque no item para baixar.

### Pedidos de reprogramação (administrador)

1. Menu → **Relatório** → link **Pedidos de reprogramação** (aparece só para o perfil admin).
2. Para cada pedido, veja o motivo e a data sugerida e toque em **Aprovar** ou **Recusar**.

### Criar usuário, nova senha e desativar (administrador, no PC)

Feito pelo script do projeto, na máquina do administrador (detalhes no `README.md`, seção *Usuários*):

```bash
npm run criar-usuario -- --re 53000000 --nome "Nome Sobrenome" --perfil tecnico
```

- Perfis: `tecnico`, `supervisor` ou `admin`.
- O script mostra uma **senha provisória**. Entregue pessoalmente; a troca é obrigatória no primeiro acesso.
- Para **desativar** alguém, no painel do Supabase, tabela `profiles`, mude `ativo` para `false`.
  A pessoa deixa de ver os dados na hora.
- Para **nova senha**, no painel do Supabase, em Authentication, redefina a senha do usuário
  (`<RE>@<domínio>`) e marque `deve_trocar_senha = true` no `profiles`.

### Checklists

Os checklists são dados no banco. Para atualizar a partir de `supabase/seed/checklists.json`:

```bash
npm run importar-checklists
```

Pode rodar de novo: atualiza pelo id, e a versão do modelo sobe se o conteúdo mudar.
