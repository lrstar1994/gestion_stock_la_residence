import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyTasks } from '../../api/modules/tasks.api'
import { useAuth } from '../../hooks/useAuth'
import type { UserTask, UserTaskCategory } from '../../lib/tasks'
import { userTaskCategoryLabels, userTaskPriorityLabels } from '../../lib/tasks'

const categoryOrder: Array<UserTaskCategory | 'all'> = ['all', 'achats', 'caisse', 'stock', 'inventaires', 'articles', 'receptions', 'factures']

export function MyTasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<UserTask[]>([])
  const [category, setCategory] = useState<UserTaskCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const rows = await listMyTasks(profile?.role, profile?.id)
        if (!ignore) setTasks(rows)
      } catch {
        if (!ignore) setError('Impossible de charger les actions a traiter pour le moment.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    load()
    return () => {
      ignore = true
    }
  }, [profile?.role, profile?.id])

  const filteredTasks = useMemo(
    () => tasks.filter((task) => category === 'all' || task.category === category),
    [category, tasks],
  )

  const urgentCount = tasks.filter((task) => task.priority === 'haute').length
  const alertCount = tasks.filter((task) => task.alert).length
  const visibleCategoryOrder = profile?.role === 'caisse'
    ? ['all', 'achats', 'caisse'] as const
    : profile?.role === 'chef_cuisine'
      ? ['all', 'achats', 'receptions'] as const
      : categoryOrder

  return (
    <div className="space-y-6">
      <header className="surface flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Accueil</p>
          <h1 className="page-title mt-2">Taches a traiter</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Vue operationnelle des actions ouvertes accessibles a votre role. Elle indique le dossier concerne, le responsable actuel, l'action attendue et le lien vers le traitement. Les decisions Direction restent regroupees dans Mes validations.
          </p>
        </div>
        {profile?.role === 'direction' && <Link to="/validations/my" className="btn-secondary">Mes validations</Link>}
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Actions ouvertes" value={tasks.length} />
        <Metric label="Urgentes" value={urgentCount} />
        <Metric label="Avec alerte" value={alertCount} />
      </section>

      <section className="surface p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleCategoryOrder.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-3 py-2 text-sm font-bold ${category === item ? 'bg-[#10285f] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {item === 'all' ? 'Toutes' : userTaskCategoryLabels[item]}
            </button>
          ))}
        </div>
      </section>

      {loading && <div className="surface p-5 text-sm text-slate-600">Chargement des actions a traiter...</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {!loading && !error && (
        <section className="surface overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task) => (
              <div key={task.id} className="grid gap-4 px-5 py-4 xl:grid-cols-[150px_150px_1.2fr_170px_1fr_170px_160px_90px] xl:items-start">
                <span>
                  <span className="block w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1E3A8A]">{task.source}</span>
                  
                </span>
                <TaskCell label="Reference" value={task.reference} />
                <span>
                  <span className="block font-bold text-slate-950">{task.title}</span>
                  <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-slate-600">{task.description}</span>
                  {task.alert && <span className="mt-2 block text-sm font-semibold text-amber-800">{task.alert}</span>}
                </span>
                <TaskCell label="Responsable actuel" value={task.responsible} />
                <TaskCell label="Action attendue" value={task.expectedAction} />
                <TaskCell label="Prochain responsable" value={task.nextResponsible || '-'} />
                <span>
                  <span className={task.priority === 'haute' ? 'w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700' : 'w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700'}>
                    {task.status} - {userTaskPriorityLabels[task.priority]}
                  </span>
                  {task.nextStatus && <span className="mt-2 block text-xs text-slate-600">Puis : {task.nextStatus}</span>}
                </span>
                <Link to={task.targetUrl} className="btn-secondary justify-center">Ouvrir</Link>
              </div>
            ))}
            {filteredTasks.length === 0 && <p className="px-5 py-6 text-sm text-slate-600">Aucune action ouverte dans cette categorie.</p>}
          </div>
        </section>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value.toLocaleString('fr-FR')}</p>
    </div>
  )
}

function TaskCell({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-sm text-slate-700">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      {value}
    </span>
  )
}
