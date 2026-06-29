import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function Pending() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4 py-10">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="h-1 bg-[#D4AF37]" />
        <div className="p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-blue-50 text-lg font-black text-[#1E3A8A]">
            LR
          </div>
          <p className="eyebrow mt-6">Validation requise</p>
          <h1 className="mt-3 text-3xl font-bold text-[#132b67]">Compte en attente</h1>
          <p className="mx-auto mt-4 max-w-md leading-7 text-slate-600">
            Votre compte est en attente de validation par la Direction.
          </p>
          <button type="button" onClick={handleLogout} className="btn-primary mt-7">
            Deconnexion
          </button>
        </div>
      </div>
    </div>
  )
}
