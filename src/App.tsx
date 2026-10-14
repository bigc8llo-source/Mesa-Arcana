import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { backend } from './data'
import { useGame } from './store/game'
import { HomePage, InvitePage } from './pages/Home'
import { Spinner } from './components/ui'

const TablePage = lazy(() => import('./pages/TablePage'))
const LobbyPage = lazy(() => import('./pages/LobbyPage'))

function Loading({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="bg-arcane grid h-full place-items-center">
      <div className="flex items-center gap-3 text-parch-300">
        <Spinner /> {text}
      </div>
    </div>
  )
}

export function App() {
  const [ready, setReady] = useState(false)
  const setUser = useGame((s) => s.setUser)

  useEffect(() => {
    void backend.getUser().then((u) => {
      setUser(u)
      setReady(true)
    })
    return backend.onAuthChange((u) => setUser(u))
  }, [setUser])

  if (!ready) return <Loading />
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading text="Preparando a mesa…" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/convite/:code" element={<InvitePage />} />
          <Route path="/c/:id" element={<LobbyPage />} />
          <Route path="/c/:id/mesa" element={<TablePage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
