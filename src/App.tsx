import { Board } from './components/Board'
import { Header } from './components/Header'
import { AccessDenied } from './components/AccessDenied'
import { useDepartmentParam, useNow, useSnapshot } from './hooks'

export default function App() {
  const [department, setDepartment] = useDepartmentParam()
  const { snapshot, status, error } = useSnapshot(department)
  const now = useNow(1000)

  if (status === 'denied') return <AccessDenied message={error} />

  if (!snapshot) {
    return (
      <div className="p-20 text-center text-gray">
        {status === 'error' ? `Não foi possível carregar os dados. Tentando de novo… (${error})` : 'Carregando os dados de hoje…'}
      </div>
    )
  }

  return (
    <div>
      <Header snapshot={snapshot} error={error} now={now} department={department} onDepartmentChange={setDepartment} />
      <Board agents={snapshot.agents} live={snapshot.live} now={now} />
    </div>
  )
}
