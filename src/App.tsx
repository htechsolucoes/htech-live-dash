import { Board } from './components/Board'
import { Header } from './components/Header'
import { AccessDenied } from './components/AccessDenied'
import { useNow, useSnapshot, useUrlParam } from './hooks'

export default function App() {
  const [department, setDepartment] = useUrlParam('equipe')
  const [user, setUser] = useUrlParam('atendente')
  const { snapshot, status, error } = useSnapshot(department, user)

  // trocar de equipe limpa o filtro de usuário (a pessoa pode não ser da nova equipe)
  const changeDepartment = (id: string) => {
    setUser('')
    setDepartment(id)
  }
  const now = useNow(1000)

  if (status === 'denied') return <AccessDenied message={error} />

  if (!snapshot) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center text-gray">
        {status === 'error' ? 'Erro ao carregar os dados.' : 'Carregando os dados de hoje…'}
      </div>
    )
  }

  return (
    <div>
      <Header
        snapshot={snapshot}
        error={error}
        now={now}
        department={department}
        onDepartmentChange={changeDepartment}
        user={user}
        onUserChange={setUser}
      />
      <Board agents={snapshot.agents} live={snapshot.live} now={now} />
    </div>
  )
}