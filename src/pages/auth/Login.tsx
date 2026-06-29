import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthShell } from '../../components/AuthShell'
import { useAuth } from '../../hooks/useAuth'
import { loginSchema } from '../../lib/validation'
import type { z } from 'zod'

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const { signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (values: LoginForm) => {
    try {
      const profile = await signIn(values.email, values.password)

      if (profile.status === 'pending_validation') {
        toast('Votre compte est en attente de validation par la Direction.')
        navigate('/pending', { replace: true })
        return
      }

      if (profile.status === 'rejected') {
        await signOut()
        toast.error('Votre compte a ete refuse. Veuillez contacter la Direction.')
        return
      }

      if (profile.status === 'inactive') {
        await signOut()
        toast.error('Votre compte a ete desactive. Veuillez contacter la Direction.')
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connexion impossible')
    }
  }

  return (
    <AuthShell title="Connexion" subtitle="Accedez a votre espace de travail securise.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <label className="block">
          <span className="field-label">Email</span>
          <input {...register('email')} type="email" className="input mt-2" autoComplete="email" placeholder="nom@laresidence.mg" />
          {errors.email?.message && <span className="mt-2 block text-sm text-red-600">{errors.email.message}</span>}
        </label>

        <label className="block">
          <span className="field-label">Mot de passe</span>
          <input {...register('password')} type="password" className="input mt-2" autoComplete="current-password" placeholder="Minimum 8 caracteres" />
          {errors.password?.message && <span className="mt-2 block text-sm text-red-600">{errors.password.message}</span>}
        </label>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-semibold text-[#1E3A8A] hover:text-blue-950">
            Creer un compte
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
