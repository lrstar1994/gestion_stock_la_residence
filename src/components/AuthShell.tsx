import type { ReactNode } from 'react'

type AuthShellProps = {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden bg-[#10285f] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D4AF37]" />
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#D4AF37] text-xl font-black text-[#10285f]">
              LR
            </div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
              La Residence
            </p>
            <h1 className="mt-3 max-w-sm text-4xl font-bold leading-tight">
              Stock & Production
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100">
              Un acces controle pour suivre les operations, les roles et les validations internes.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border border-white/10 bg-white/[0.08] p-3">
              <p className="text-lg font-bold">01</p>
              <p className="mt-1 text-blue-100">Inscription</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.08] p-3">
              <p className="text-lg font-bold">02</p>
              <p className="mt-1 text-blue-100">Validation</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.08] p-3">
              <p className="text-lg font-bold">03</p>
              <p className="mt-1 text-blue-100">Acces</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <p className="eyebrow">La Residence</p>
            <h2 className="mt-3 text-3xl font-bold text-[#132b67]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
