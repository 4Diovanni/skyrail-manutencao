import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage } from '../auth/LoginPage'
import { RequireAuth } from '../auth/RequireAuth'
import { PassagemPage } from '../modules/passagem/PassagemPage'
import { PreventivasPage } from '../modules/preventivas/PreventivasPage'
import { RelatorioPage } from '../modules/relatorio/RelatorioPage'
import { AppLayout } from './AppLayout'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/preventivas" replace /> },
          { path: 'preventivas', element: <PreventivasPage /> },
          { path: 'relatorio', element: <RelatorioPage /> },
          { path: 'passagem', element: <PassagemPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
