import { useMemo, useState } from 'react'
import type { Supplier } from '../../lib/suppliers'

type Props = {
  suppliers: Supplier[]
  value: string
  onChange: (supplierId: string) => void
  onCreate: () => void
  disabled?: boolean
  emptyLabel?: string
}

function normalize(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function SupplierSearchSelect({ suppliers, value, onChange, onCreate, disabled, emptyLabel = 'Aucun fournisseur' }: Props) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const term = normalize(search.trim())
    if (!term) return suppliers
    return suppliers.filter((supplier) => supplier.id === value || normalize([
      supplier.name,
      supplier.contact,
      supplier.nif,
      supplier.stat,
      supplier.address,
      supplier.notes,
    ].filter(Boolean).join(' ')).includes(term))
  }, [search, suppliers, value])

  return (
    <div className="space-y-2">
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        disabled={disabled}
        className="input disabled:bg-slate-100"
        placeholder="Rechercher : nom, raison sociale, alias, NIF, STAT..."
      />
      <select
        value={value}
        onChange={(event) => {
          if (event.target.value === '__new__') onCreate()
          else onChange(event.target.value)
        }}
        disabled={disabled}
        className="input disabled:bg-slate-100"
      >
        <option value="">{emptyLabel}</option>
        {filtered.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}{supplier.nif ? ` - NIF ${supplier.nif}` : ''}{supplier.stat ? ` - STAT ${supplier.stat}` : ''}
          </option>
        ))}
        <option value="__new__">+ Nouveau fournisseur</option>
      </select>
      {search && filtered.length === 0 && <p className="text-xs font-semibold text-amber-700">Aucun fournisseur proche. Utilisez + Nouveau fournisseur.</p>}
    </div>
  )
}
