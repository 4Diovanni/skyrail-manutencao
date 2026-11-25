# Histórico de versões

O número da versão aparece no app em **Meu perfil** e na tela de login.
Cada versão publicada para teste vem com o aviso de alteração do Anexo III do contrato.

Formato do número: `0.<marco>.<correção>`. Ex.: `0.2.1` é a primeira rodada de correções da versão do Marco 2.

## 0.2.0 — versão de testes do Marco 2

O que mudou para o usuário:

- **Envio sem depender da tela aberta:** relatórios, preventivas e passagens que ficaram na fila são enviados
  sozinhos ao abrir o app, quando a internet volta e a cada 30 minutos.
- **Aviso claro de envio** nas três telas: enviado, na fila (sem internet) ou falhou, com o motivo.
  O que falhou continua salvo no aparelho e é tentado de novo.
- **Rascunhos separados por usuário:** num aparelho compartilhado, cada pessoa vê só os próprios rascunhos e fila.
- **Meu perfil:** nome, RE e perfil de quem está logado, para conferir a conta antes de enviar.
  No PC, fica no menu da conta, no canto superior direito.
- **Documentos do turno:** qualquer usuário ativo vê os PDFs do turno (antes cada um via só os seus).
- **Corretiva:** saiu o campo "Resultado (opcional)".
- **Depois de uma atualização do app**, gerar PDF não falha mais com "Failed to fetch dynamically imported module".

O que não mudou:

- Regras de preenchimento, modelos de PDF e checklists das preventivas.

Ainda falta nesta versão:

- Tela da política de uso com aceite registrado: aguardando o texto da política.

## 0.1.0 — base do Marco 1

Relatório de atividades (com PDFs), Preventivas (47 checklists) e Passagem de turno, com login por RE,
assinatura cadastrada pela própria pessoa e funcionamento sem internet.
