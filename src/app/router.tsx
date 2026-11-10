import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '../auth/LoginPage'
import { RequireAuth } from '../auth/RequireAuth'
import { TrocarSenhaPage } from '../auth/TrocarSenhaPage'
import { PassagemPage } from '../modules/passagem/ui/PassagemPage'
import { NovaPreventivaPage } from '../modules/preventivas/ui/NovaPreventivaPage'
import { PreventivaPage } from '../modules/preventivas/ui/PreventivaPage'
import { PreventivasPage } from '../modules/preventivas/ui/PreventivasPage'
import { AtividadePage } from '../modules/relatorio/ui/AtividadePage'
import { DiaPage } from '../modules/relatorio/ui/DiaPage'
import { DocumentosPage } from '../modules/relatorio/ui/DocumentosPage'
import { MinhaAssinaturaPage } from '../modules/relatorio/ui/MinhaAssinaturaPage'
import { ReprogramacoesPage } from '../modules/relatorio/ui/ReprogramacoesPage'
import { AppLayout } from './AppLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: 'trocar-senha', element: <TrocarSenhaPage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/relatorio" replace /> },
          { path: 'preventivas', element: <PreventivasPage /> },
          { path: 'preventivas/nova', element: <NovaPreventivaPage /> },
          { path: 'preventivas/:id', element: <PreventivaPage /> },
          { path: 'relatorio', element: <DiaPage /> },
          { path: 'relatorio/atividade/nova', element: <AtividadePage /> },
          { path: 'relatorio/atividade/:id', element: <AtividadePage /> },
          { path: 'relatorio/reprogramacoes', element: <ReprogramacoesPage /> },
          { path: 'documentos', element: <DocumentosPage /> },
          { path: 'perfil/assinatura', element: <MinhaAssinaturaPage /> },
          { path: 'passagem', element: <PassagemPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
