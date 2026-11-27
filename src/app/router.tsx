import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '../auth/LoginPage'
import { MeuPerfilPage } from '../auth/MeuPerfilPage'
import { RequireAuth } from '../auth/RequireAuth'
import { TrocarSenhaPage } from '../auth/TrocarSenhaPage'
import { importarModulo } from '../lib/versaoNova'

/**
 * Telas carregadas sob demanda: a tela de login abre sem o resto do app; depois do login vêm o menu
 * e as filas, e cada tela vem quando é aberta (o service worker já guarda todas para o uso sem internet).
 * importarModulo recarrega a página se um deploy novo apagou o arquivo antigo.
 */
function tela<M>(carregar: () => Promise<M>, nome: keyof M) {
  return async () => ({ Component: (await importarModulo(carregar))[nome] as ComponentType })
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: 'trocar-senha', element: <TrocarSenhaPage /> },
      {
        lazy: tela(() => import('./AppLayout'), 'AppLayout'),
        children: [
          { index: true, element: <Navigate to="/relatorio" replace /> },
          { path: 'preventivas', lazy: tela(() => import('../modules/preventivas/ui/PreventivasPage'), 'PreventivasPage') },
          { path: 'preventivas/nova', lazy: tela(() => import('../modules/preventivas/ui/NovaPreventivaPage'), 'NovaPreventivaPage') },
          { path: 'preventivas/:id', lazy: tela(() => import('../modules/preventivas/ui/PreventivaPage'), 'PreventivaPage') },
          { path: 'relatorio', lazy: tela(() => import('../modules/relatorio/ui/DiaPage'), 'DiaPage') },
          { path: 'relatorio/atividade/nova', lazy: tela(() => import('../modules/relatorio/ui/AtividadePage'), 'AtividadePage') },
          { path: 'relatorio/atividade/:id', lazy: tela(() => import('../modules/relatorio/ui/AtividadePage'), 'AtividadePage') },
          { path: 'relatorio/reprogramacoes', lazy: tela(() => import('../modules/relatorio/ui/ReprogramacoesPage'), 'ReprogramacoesPage') },
          { path: 'documentos', lazy: tela(() => import('../modules/relatorio/ui/DocumentosPage'), 'DocumentosPage') },
          { path: 'perfil', element: <MeuPerfilPage /> },
          { path: 'perfil/assinatura', lazy: tela(() => import('../modules/relatorio/ui/MinhaAssinaturaPage'), 'MinhaAssinaturaPage') },
          { path: 'passagem', lazy: tela(() => import('../modules/passagem/ui/PassagemPage'), 'PassagemPage') },
          { path: 'politica', lazy: tela(() => import('../modules/politica/ui/PoliticaPage'), 'PoliticaPage') },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
