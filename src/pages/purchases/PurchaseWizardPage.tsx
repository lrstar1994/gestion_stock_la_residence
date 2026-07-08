import { ArrowRight, Banknote, ClipboardList, FileCheck2, ShoppingCart } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { canCreateCashPurchases } from '../../lib/cashPurchases'
import { canCreatePurchaseNeeds } from '../../lib/purchaseNeeds'
import { canCreatePurchaseOrders } from '../../lib/purchaseOrders'

type PurchaseChoice = {
  title: string
  description: string
  example: string
  to: string
  action: string
  enabled: boolean
  icon: ReactNode
}

export function PurchaseWizardPage() {
  const { profile } = useAuth()
  const canCreateNeed = canCreatePurchaseNeeds(profile?.role)
  const canCreateCash = canCreateCashPurchases(profile?.role)
  const canCreateOrder = canCreatePurchaseOrders(profile?.role)

  const choices: PurchaseChoice[] = [
    {
      title: 'Demander un achat',
      description: "J'ai besoin de quelque chose, mais l'achat n'est pas encore organise.",
      example: 'Exemple : la cuisine demande 10 kg de beurre pour la semaine prochaine.',
      to: '/purchase-needs/new',
      action: "Creer un besoin d'achat",
      enabled: canCreateNeed,
      icon: <ClipboardList className="h-6 w-6" />,
    },
    {
      title: 'Acheter en especes',
      description: "Quelqu'un doit acheter rapidement avec de l'argent remis.",
      example: 'Exemple : donner 100 000 Ar pour acheter des legumes au marche.',
      to: '/cash-purchases/new',
      action: 'Creer un achat especes',
      enabled: canCreateCash,
      icon: <Banknote className="h-6 w-6" />,
    },
    {
      title: 'Commander a un fournisseur',
      description: 'On sait deja quel fournisseur va livrer, avec une reception future.',
      example: "Exemple : commander 10 cartons d'eau chez le fournisseur habituel.",
      to: '/purchase-orders/new',
      action: 'Creer une commande',
      enabled: canCreateOrder,
      icon: <ShoppingCart className="h-6 w-6" />,
    },
  ]

  return (
    <div className="space-y-6">
      <header className="surface p-6">
        <p className="eyebrow">Achats</p>
        <h1 className="page-title mt-2">Nouvel achat</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Choisissez la situation qui correspond le mieux. Les modules restent separes derriere, mais cette page vous oriente vers le bon document.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {choices.map((choice) => (
          <PurchaseChoiceCard key={choice.title} choice={choice} />
        ))}
      </section>

      <section className="surface flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <FileCheck2 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-bold text-slate-950">Deja achete ? Regulariser</h2>
            <p className="mt-1 text-sm text-slate-600">
              A utiliser quand l'achat a deja ete fait et qu'il faut enregistrer le justificatif ou remettre le dossier au propre.
            </p>
          </div>
        </div>
        {canCreateCash ? (
          <Link to="/cash-purchases/new" className="btn-secondary">
            Regulariser un achat
          </Link>
        ) : (
          <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500">
            Non disponible pour votre role
          </span>
        )}
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-bold text-slate-950">Les trois circuits restent separes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info title="Besoin d'achat" text="On exprime un besoin. L'achat n'est pas encore organise." />
          <Info title="Achat especes" text="Une personne achete directement avec des especes remises." />
          <Info title="Commande fournisseur" text="Une commande structuree est envoyee a un fournisseur." />
        </div>
      </section>
    </div>
  )
}

function PurchaseChoiceCard({ choice }: { choice: PurchaseChoice }) {
  const content = (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-[#1E3A8A]/10 text-[#1E3A8A]">
        {choice.icon}
      </span>
      <div className="mt-5">
        <h2 className="text-xl font-black text-slate-950">{choice.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{choice.description}</p>
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">{choice.example}</p>
      </div>
      <span className={`mt-5 inline-flex items-center text-sm font-bold ${choice.enabled ? 'text-[#1E3A8A]' : 'text-slate-400'}`}>
        {choice.enabled ? choice.action : 'Non disponible pour votre role'}
        {choice.enabled && <ArrowRight className="ml-2 h-4 w-4" />}
      </span>
    </>
  )

  if (!choice.enabled) {
    return <div className="surface p-5 opacity-75">{content}</div>
  }

  return (
    <Link to={choice.to} className="surface block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      {content}
    </Link>
  )
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="font-bold text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  )
}
