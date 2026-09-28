import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createArticle, getArticle, listFamilies, listUnits } from '../../api/modules/catalog.api'
import { listSuppliers } from '../../api/modules/suppliers.api'
import type { Article, Family, Unit } from '../../lib/catalog'
import type { Supplier } from '../../lib/suppliers'

type Props = {
  open: boolean
  profileId?: string
  initialName?: string
  defaultLocationId?: string
  defaultSupplierId?: string
  onClose: () => void
  onCreated: (article: Article) => void
}

type CompletionStatus = 'provisoire' | 'a_completer' | 'actif'

export function QuickArticleDrawer({ open, profileId, initialName = '', defaultSupplierId = '', onClose, onCreated }: Props) {
  const [families, setFamilies] = useState<Family[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [name, setName] = useState(initialName)
  const [familyId, setFamilyId] = useState('')
  const [subFamily, setSubFamily] = useState('')
  const [stockUnitId, setStockUnitId] = useState('')
  const [purchaseUnitId, setPurchaseUnitId] = useState('')
  const [stockable, setStockable] = useState(true)
  const [supplierId, setSupplierId] = useState(defaultSupplierId)
  const [indicativePrice, setIndicativePrice] = useState<number | null>(null)
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>('a_completer')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    Promise.all([listFamilies(), listUnits(), listSuppliers()])
      .then(([loadedFamilies, loadedUnits, loadedSuppliers]) => {
        setFamilies(loadedFamilies)
        setUnits(loadedUnits)
        setSuppliers(loadedSuppliers)
        setFamilyId((current) => current || loadedFamilies[0]?.id || '')
        setStockUnitId((current) => current || loadedUnits[0]?.id || '')
        setPurchaseUnitId((current) => current || loadedUnits[0]?.id || '')
        setSupplierId((current) => current || defaultSupplierId)
      })
      .catch(() => toast.error('Impossible de charger la fiche article rapide'))
  }, [defaultSupplierId, initialName, open])

  if (!open) return null

  const save = async () => {
    if (!name.trim() || !familyId || !stockUnitId) {
      toast.error('Nom, famille et unite de stock obligatoires')
      return
    }
    try {
      setSaving(true)
      const purchaseUnit = units.find((unit) => unit.id === purchaseUnitId)
      const supplier = suppliers.find((item) => item.id === supplierId)
      const incomplete = completionStatus !== 'actif'
      const notes = [
        incomplete ? '[A_COMPLETER] Article a completer / a rapprocher' : '',
        purchaseUnitId && purchaseUnitId !== stockUnitId ? `Unite achat envisagee : ${purchaseUnit?.name ?? purchaseUnit?.abbreviation}` : '',
        `Statut saisie rapide : ${completionStatus}`,
        comment.trim(),
      ].filter(Boolean).join(' - ')
      const articleId = await createArticle({
        name: name.trim(),
        family_id: familyId,
        sub_family: subFamily.trim(),
        unit_id: stockUnitId,
        packaging: '',
        default_supplier: supplier?.name ?? '',
        min_stock: 0,
        sellable_without_transformation: false,
        usable_in_recipes: false,
        nature: 'autre',
        stockable,
        locations_restricted: false,
        durable_equipment: false,
        indicative_price: indicativePrice,
        indicative_price_note: notes,
        status: 'active',
        location_ids: [],
      }, profileId)
      const article = await getArticle(articleId)
      toast.success(incomplete ? 'Article provisoire cree ; tache de completion disponible' : 'Article cree')
      onCreated(article)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de creer l article')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 p-5">
          <div><p className="eyebrow">Article</p><h2 className="mt-2 text-xl font-black">Creation rapide article</h2><p className="mt-1 text-sm text-slate-600">Verifiez les articles proches avant creation. L article sera selectionne automatiquement au retour.</p></div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nom article"><input value={name} onChange={(event) => setName(event.target.value)} className="input mt-2" /></Field>
            <Field label="Famille"><select value={familyId} onChange={(event) => setFamilyId(event.target.value)} className="input mt-2"><option value="">Selectionner</option>{families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></Field>
            <Field label="Sous-famille si connue"><input value={subFamily} onChange={(event) => setSubFamily(event.target.value)} className="input mt-2" /></Field>
            <Field label="Unite de stock"><select value={stockUnitId} onChange={(event) => setStockUnitId(event.target.value)} className="input mt-2"><option value="">Selectionner</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select></Field>
            <Field label="Unite d achat si connue"><select value={purchaseUnitId} onChange={(event) => setPurchaseUnitId(event.target.value)} className="input mt-2"><option value="">Non definie</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}</select></Field>
            <Field label="Fournisseur possible"><select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="input mt-2"><option value="">Non defini</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
            <Field label="Prix indicatif"><input type="number" min="0" value={indicativePrice ?? ''} onChange={(event) => setIndicativePrice(event.target.value === '' ? null : Number(event.target.value))} className="input mt-2" /></Field>
            <Field label="Statut"><select value={completionStatus} onChange={(event) => setCompletionStatus(event.target.value as CompletionStatus)} className="input mt-2"><option value="provisoire">Provisoire</option><option value="a_completer">A completer</option><option value="actif">Actif</option></select></Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={stockable} onChange={(event) => setStockable(event.target.checked)} className="h-4 w-4" /> Stockable</label>
            <label className="block md:col-span-2"><span className="field-label">Commentaire</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} className="input mt-2 min-h-20" /></label>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" onClick={onClose} className="btn-secondary">Annuler</button><button type="button" onClick={save} disabled={saving} className="btn-primary">{saving ? 'Creation...' : 'Creer et selectionner'}</button></footer>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>
}
