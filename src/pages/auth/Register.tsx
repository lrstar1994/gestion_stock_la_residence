import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AuthShell } from '../../components/AuthShell'
import { useAuth } from '../../hooks/useAuth'
import { registerSchema } from '../../lib/validation'
import type { ReactNode } from 'react'
import type { z } from 'zod'

type RegisterForm = z.infer<typeof registerSchema>

export function Register() {
  const { register: createAccount } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (values: RegisterForm) => {
    try {
      await createAccount({ email: values.email, password: values.password, fullName: values.fullName })
      toast.success('Votre inscription a ete enregistree. Votre compte doit etre valide par la Direction.')
      navigate('/pending', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'inscription a echoue")
    }
  }

  return (
    <AuthShell title="Demande d'acces" subtitle="Creez votre compte. La Direction validera ensuite votre acces et votre role.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Field label="Email" error={errors.email?.message}>
          <input {...register('email')} type="email" className="input mt-2" autoComplete="email" placeholder="nom@laresidence.mg" />
        </Field>

        <Field label="Prenom et nom" error={errors.fullName?.message}>
          <input {...register('fullName')} type="text" className="input mt-2" autoComplete="name" placeholder="Votre nom complet" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Mot de passe" error={errors.password?.message}>
            <input {...register('password')} type="password" className="input mt-2" autoComplete="new-password" />
          </Field>
          <Field label="Confirmation" error={errors.confirmPassword?.message}>
            <input {...register('confirmPassword')} type="password" className="input mt-2" autoComplete="new-password" />
          </Field>
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Inscription...' : "Envoyer la demande"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Deja inscrit ?{' '}
          <Link to="/login" className="font-semibold text-[#1E3A8A] hover:text-blue-950">
            Se connecter
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="mt-2 block text-sm text-red-600">{error}</span>}
    </label>
  )
}
