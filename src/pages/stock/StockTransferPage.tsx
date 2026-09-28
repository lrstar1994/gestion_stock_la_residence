import { ArrowDownToLine, ArrowLeftRight, Clock3, Plus, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { getStockQuantity, listStockTransferDrafts, saveStockTransferDraft, deleteStockTransferDraft, prepareStockTransfer, listTransferDestinations } from '../../api/modules/stock.api'
import type { StockTransferDraft, StockTransferDraftPayload } from '../../api/modules/stock.api'
import { listAllArticles, listLocations } from '../../api/modules/catalog.api'
import { ArticleSearchSelect } from '../../components/articles/ArticleSearchSelect'
import { QuickArticleDrawer } from '../../components/articles/QuickArticleDrawer'
import { StockTransferWorkflowPanel } from './StockTransferWorkflowPanel'
import { useAuth } from '../../hooks/useAuth'
import type { Article, Location } from '../../lib/catalog'
import { getArticleAllowedLocationIds } from '../../lib/articleLocations'

type TransferLine = {
  key: string
  article_id: string
  unit_id: string
  quantity: string
  line_comment: string
  available: number | null
}

type DraftValues = {
  from_location_id: string
  to_location_id: string
  movement_date: string
  reason: string
  comment: string
}

type LocalDraft = { transferId: string | null; values: DraftValues; lines: TransferLine[] }
const today = new Date().toISOString().slice(0, 10)
const blankValues = (): DraftValues => ({ from_location_id: '', to_location_id: '', movement_date: today, reason: '', comment: '' })

export function StockTransferPage() {
  const { profile } = useAuth()
  const [mode, setMode] = useState<'list' | 'edit'>('list')
  const [drafts, setDrafts] = useState<StockTransferDraft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [draftsError, setDraftsError] = useState<string | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [values, setValues] = useState<DraftValues>(blankValues)
  const [lines, setLines] = useState<TransferLine[]>([])
  const [candidateArticleId, setCandidateArticleId] = useState('')
  const [searchSelectKey, setSearchSelectKey] = useState(0)
  const [destinationChoices, setDestinationChoices] = useState<Array<Pick<Location, 'id' | 'name'>>>([])
  const [destinationsLoading, setDestinationsLoading] = useState(false)
  const [hydratingDraft, setHydratingDraft] = useState(false)
  const [quickArticleOpen, setQuickArticleOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draftId, setDraftIdState] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState('Les modifications sont sauvegardées localement au fil de la saisie.')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const draftIdRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const revisionRef = useRef(0)
  const storageKey = profile?.id ? `stock-transfer-draft:${profile.id}` : null

  const reloadDrafts = useCallback(async () => {
    try {
      setDraftsError(null)
      const result = await listStockTransferDrafts()
      setDrafts(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de charger les brouillons de transfert.'
      setDraftsError(message)
      setDrafts([])
    } finally {
      setDraftsLoading(false)
    }
  }, [])

  useEffect(() => {
    reloadDrafts()
    Promise.all([listAllArticles({ status: 'active' }), listLocations()])
      .then(([loadedArticles, loadedLocations]) => {
        setArticles(loadedArticles)
        setLocations(loadedLocations)
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Impossible de charger le formulaire de transfert.'))
  }, [reloadDrafts])

  useEffect(() => {
    if (mode !== 'edit' || !storageKey) return
    const localDraft: LocalDraft = { transferId: draftIdRef.current, values, lines }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(localDraft))
    } catch {
      setSaveMessage('Brouillon en cours de synchronisation avec le serveur.')
    }

    const revision = ++revisionRef.current
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const payload = toPayload(values, lines)
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
        setSaving(true)
        setSaveMessage('Synchronisation du brouillon…')
        try {
          const id = await saveStockTransferDraft(draftIdRef.current, payload)
          draftIdRef.current = id
          if (revision === revisionRef.current) {
            setDraftIdState(id)
            setSaveMessage('Brouillon sauvegardé sur le serveur')
            setSavedAt(new Date().toISOString())
            try { window.localStorage.setItem(storageKey, JSON.stringify({ transferId: id, values, lines } satisfies LocalDraft)) } catch { /* Le brouillon serveur reste sauvegardé. */ }
          }
        } catch (error) {
          if (revision === revisionRef.current) setSaveMessage(error instanceof Error ? `Sauvegarde locale active — serveur indisponible : ${error.message}` : 'Sauvegarde locale active — serveur indisponible')
        } finally {
          if (revision === revisionRef.current) setSaving(false)
        }
      })
    }, 450)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [mode, storageKey, values, lines])

  useEffect(() => {
    if (!storageKey || draftsLoading) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const local = JSON.parse(raw) as LocalDraft
      if (!local.values || !Array.isArray(local.lines)) return
      draftIdRef.current = local.transferId
      setDraftIdState(local.transferId)
      setValues(local.values)
      setLines(local.lines)
      setMode('edit')
      setSaveMessage('Brouillon local récupéré ; synchronisation en cours')
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey, draftsLoading])

  useEffect(() => {
    if (mode !== 'edit' || !values.from_location_id) {
      setDestinationChoices([])
      return
    }
    let cancelled = false
    const articleIds = [...new Set(lines.map((line) => line.article_id).filter(Boolean))]
    if (articleIds.length === 0) {
      setDestinationsLoading(false)
      setDestinationChoices(locations.filter((location) => location.id !== values.from_location_id))
      setHydratingDraft(false)
      return
    }
    setDestinationsLoading(true)
    Promise.all(articleIds.map((articleId) => listTransferDestinations(articleId, values.from_location_id)))
      .then((choicesByArticle) => {
        const allowedByAll = choicesByArticle.slice(1).reduce((available, next) => {
          const nextIds = new Set(next.map((location) => location.id))
          return available.filter((location) => nextIds.has(location.id))
        }, [...choicesByArticle[0]])
        if (!cancelled) {
          setDestinationChoices(allowedByAll)
          if (values.to_location_id && !allowedByAll.some((location) => location.id === values.to_location_id)) {
            setValues((current) => ({ ...current, to_location_id: '' }))
          }
          setDestinationsLoading(false)
          setHydratingDraft(false)
        }
      })
      .catch((error) => { if (!cancelled) { setDestinationsLoading(false); setHydratingDraft(false); toast.error(error instanceof Error ? error.message : 'Impossible de vérifier les destinations autorisées.') } })
    return () => { cancelled = true }
  }, [mode, lines, locations, values.from_location_id, values.to_location_id])

  const stockLookupKey = JSON.stringify(lines.map((line) => [line.key, line.article_id]))
  const selectableArticles = useMemo(() => articles.filter((article) => !values.from_location_id || getArticleAllowedLocationIds(
    article.locations_restricted,
    article.article_locations?.map((link) => link.locations.id) ?? [],
    locations.map((location) => location.id),
  ).includes(values.from_location_id)), [articles, locations, values.from_location_id])

  useEffect(() => {
    if (mode !== 'edit' || !values.from_location_id) return
    let cancelled = false
    const stockLookups = JSON.parse(stockLookupKey) as Array<[string, string]>
    Promise.all(stockLookups.map(async ([key, articleId]) => {
      if (!articleId) return [key, null] as const
      try { return [key, await getStockQuantity(articleId, values.from_location_id)] as const }
      catch { return [key, null] as const }
    })).then((stockResults) => {
      if (cancelled) return
      const stockByKey = new Map(stockResults)
      setLines((current) => current.map((line) => ({ ...line, available: stockByKey.get(line.key) ?? null })))
    })
    return () => { cancelled = true }
  }, [mode, values.from_location_id, stockLookupKey])

  const selectedArticle = articles.find((article) => article.id === candidateArticleId)
  const canFinalize = useMemo(() => Boolean(values.from_location_id && values.to_location_id && values.movement_date && values.reason.trim() && lines.length > 0 && lines.every((line) => {
    const article = articles.find((item) => item.id === line.article_id)
    if (!article || !line.unit_id || Number(line.quantity) <= 0 || Number(line.quantity) !== Math.round(Number(line.quantity) * 100) / 100) return false
    const allowedIds = getArticleAllowedLocationIds(article.locations_restricted, article.article_locations?.map((link) => link.locations.id) ?? [], locations.map((location) => location.id))
    return allowedIds.includes(values.from_location_id) && allowedIds.includes(values.to_location_id)
  })), [articles, locations, values, lines])

  const startNewDraft = () => {
    if (!['direction', 'magasinier'].includes(profile?.role ?? '')) return toast.error('Seuls Direction et Magasin peuvent préparer un transfert.')
    draftIdRef.current = null
    setDraftIdState(null)
    setValues(blankValues())
    setLines([])
    setCandidateArticleId('')
    setSearchSelectKey((key) => key + 1)
    setSaveMessage('Nouveau brouillon — sauvegarde automatique activée')
    setSavedAt(null)
    setMode('edit')
  }

  const resumeDraft = (draft: StockTransferDraft) => {
    const draftLines = (draft.stock_transfer_batch_items ?? []).map((line) => ({
      key: line.id || crypto.randomUUID(),
      article_id: line.article_id ?? '',
      unit_id: line.unit_id ?? '',
      quantity: line.quantity === null ? '' : String(line.quantity),
      line_comment: line.line_comment ?? '',
      available: null,
    }))
    const resumed = {
      from_location_id: draft.from_location_id ?? '',
      to_location_id: draft.to_location_id ?? '',
      movement_date: draft.movement_date ?? '',
      reason: draft.reason ?? '',
      comment: draft.comment ?? '',
    }
    draftIdRef.current = draft.id
    setDraftIdState(draft.id)
    setValues(resumed)
    setLines(draftLines)
    setHydratingDraft(true)
    setMode('edit')
    setSavedAt(draft.updated_at)
    setSaveMessage('Brouillon chargé — les modifications sont sauvegardées automatiquement')
  }

  const addSelectedArticle = () => {
    if (!selectedArticle) return
    if (lines.some((line) => line.article_id === selectedArticle.id)) {
      toast('Cet article est déjà dans le transfert. Modifiez sa quantité sur la ligne existante.')
      return
    }
    setLines((current) => [...current, { key: crypto.randomUUID(), article_id: selectedArticle.id, unit_id: selectedArticle.unit_id, quantity: '', line_comment: '', available: null }])
    setCandidateArticleId('')
    setSearchSelectKey((key) => key + 1)
  }

  const deleteDraft = async (id: string) => {
    if (!window.confirm('Supprimer définitivement ce brouillon de transfert ?')) return
    try {
      await deleteStockTransferDraft(id)
      setDrafts((current) => current.filter((draft) => draft.id !== id))
      if (draftIdRef.current === id) {
        if (storageKey) window.localStorage.removeItem(storageKey)
        draftIdRef.current = null
        setDraftIdState(null)
        setMode('list')
      }
      toast.success('Brouillon supprimé')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression du brouillon impossible')
    }
  }

  const flushDraft = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await saveQueueRef.current.catch(() => undefined)
    const id = await saveStockTransferDraft(draftIdRef.current, toPayload(values, lines))
    draftIdRef.current = id
    setDraftIdState(id)
    return id
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canFinalize) {
      toast.error('Complétez les localisations, le motif et chaque ligne avant validation.')
      return
    }
    try {
      setSaving(true)
      const id = await flushDraft()
      await prepareStockTransfer(id)
      if (storageKey) window.localStorage.removeItem(storageKey)
      draftIdRef.current = null
      setDraftIdState(null)
      toast.success('Transfert préparé. Aucun mouvement n’a encore été créé.')
      setMode('list')
      await reloadDrafts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible de préparer le transfert.')
    } finally {
      setSaving(false)
    }
  }

  const returnToDraftList = async () => {
    try {
      await flushDraft()
      await reloadDrafts()
      setMode('list')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Le brouillon reste sauvegardé localement, mais la synchronisation a échoué.')
    }
  }

  if (mode === 'list') {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow">Stock</p><h1 className="page-title mt-2">Transferts entre localisations</h1><p className="mt-2 text-sm text-slate-600">Préparez le dossier, puis suivez la remise et la réception physiques avec deux confirmations PIN.</p></div>
          <div className="flex flex-wrap gap-2">{['direction', 'magasinier'].includes(profile?.role ?? '') && <Link to="/stock/transfer/single" className="btn-secondary">Transfert unitaire</Link>}<Link to="/stock" className="btn-secondary">Stock</Link>{['direction', 'magasinier'].includes(profile?.role ?? '') && <button type="button" onClick={startNewDraft} className="btn-primary"><Plus className="mr-2 h-4 w-4" /> Nouveau transfert groupé</button>}</div>
        </header>
        {draftsError && <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Les brouillons serveur ne sont pas disponibles : {draftsError}</div>}
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black">Brouillons sauvegardés</h2></div>
        {draftsLoading ? <p className="p-5 text-sm text-slate-600">Chargement des brouillons…</p> : drafts.length === 0 ? <p className="p-5 text-sm text-slate-600">Aucun brouillon de transfert.</p> : <div className="divide-y divide-slate-100">{drafts.map((draft) => {
            const canManage = profile?.role === 'direction' || (draft.created_by === profile?.id && profile?.role === 'magasinier')
            return <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><span><strong>{draft.reference ?? 'Transfert en préparation'}</strong><span className="mt-1 block text-sm text-slate-600">{locations.find((location) => location.id === draft.from_location_id)?.name ?? 'Origine à définir'} → {locations.find((location) => location.id === draft.to_location_id)?.name ?? 'Destination à définir'} · {draft.stock_transfer_batch_items?.length ?? 0} ligne(s) · modifié {new Date(draft.updated_at).toLocaleString('fr-FR')}</span>{!canManage && <span className="mt-1 block text-xs text-slate-500">Brouillon d’un autre utilisateur — consultation uniquement.</span>}</span><span className="flex gap-2">{canManage && <><button type="button" onClick={() => resumeDraft(draft)} className="btn-secondary">Reprendre</button><button type="button" onClick={() => deleteDraft(draft.id)} className="btn-secondary text-red-700" aria-label="Supprimer le brouillon"><Trash2 className="h-4 w-4" /></button></>}</span></div>
          })}</div>}
        </section>
        <StockTransferWorkflowPanel />
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="eyebrow">Stock · Brouillon groupé</p><h1 className="page-title mt-2">Préparer un transfert</h1><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Save className="h-4 w-4" />{saveMessage}{savedAt && !saving && <span className="text-xs">· {new Date(savedAt).toLocaleTimeString('fr-FR')}</span>}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void returnToDraftList()} className="btn-secondary"><X className="mr-2 h-4 w-4" /> Brouillons</button>{draftId && <button type="button" onClick={() => deleteDraft(draftId)} className="btn-secondary text-red-700"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</button>}<button type="submit" disabled={saving || !canFinalize || hydratingDraft || destinationsLoading} className="btn-primary"><ArrowDownToLine className="mr-2 h-4 w-4" /> Préparer le transfert ({lines.length})</button></div>
      </header>

      <section className="surface grid gap-4 p-5 md:grid-cols-2">
        <label><span className="field-label">Localisation d’origine</span><select value={values.from_location_id} onChange={(event) => setValues((current) => ({ ...current, from_location_id: event.target.value, to_location_id: '' }))} className="input mt-2"><option value="">Sélectionner</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label><span className="field-label">Localisation de destination</span><select value={values.to_location_id} onChange={(event) => setValues((current) => ({ ...current, to_location_id: event.target.value }))} disabled={!values.from_location_id || hydratingDraft} className="input mt-2 disabled:bg-slate-100"><option value="">{hydratingDraft || destinationsLoading ? 'Chargement du brouillon…' : 'Sélectionner'}</option>{values.to_location_id && !destinationChoices.some((location) => location.id === values.to_location_id) && <option value={values.to_location_id}>{locations.find((location) => location.id === values.to_location_id)?.name ?? 'Destination enregistrée'}</option>}{destinationChoices.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">La destination est proposée selon les localisations autorisées pour les articles du dossier.</span></label>
        <label><span className="field-label">Date du transfert</span><input type="date" value={values.movement_date} onChange={(event) => setValues((current) => ({ ...current, movement_date: event.target.value }))} className="input mt-2" /></label>
        <label><span className="field-label">Motif général</span><input value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="input mt-2" placeholder="Ex. Réapprovisionnement cuisine" /></label>
        <label className="md:col-span-2"><span className="field-label">Commentaire facultatif</span><textarea value={values.comment} onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))} className="input mt-2 min-h-20" /></label>
      </section>

      <section className="surface p-5">
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-[260px] flex-1"><span className="field-label">Rechercher et ajouter un article</span><div className="mt-2"><ArticleSearchSelect key={searchSelectKey} articles={selectableArticles} value={candidateArticleId} onChange={setCandidateArticleId} onCreate={() => setQuickArticleOpen(true)} allowCreateAfterNoMatch /></div></label><button type="button" onClick={addSelectedArticle} disabled={!candidateArticleId} className="btn-secondary"><Plus className="mr-2 h-4 w-4" /> Ajouter la ligne</button></div>
        <div className="mt-4 flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-900"><ArrowLeftRight className="h-4 w-4 shrink-0" /> Les articles en double sont refusés dans le même dossier. Ajustez leur quantité sur la ligne déjà ajoutée.</div>
        <div className="mt-4 space-y-3">
          {lines.map((line, index) => {
            const article = articles.find((item) => item.id === line.article_id)
            const quantity = Number(line.quantity)
            const invalidQuantity = Boolean(line.quantity) && (!Number.isFinite(quantity) || quantity <= 0 || (line.available !== null && quantity > line.available))
            return <div key={line.key} className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[minmax(180px,1.5fr)_110px_150px_150px_minmax(180px,1fr)_auto] lg:items-end">
              <div><span className="field-label">Article {index + 1}</span><p className="mt-2 font-bold">{article?.name ?? 'Article à compléter'}</p></div>
              <label><span className="field-label">Quantité</span><input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, quantity: event.target.value } : item))} className={`input mt-2 ${invalidQuantity ? 'border-red-500' : ''}`} /></label>
              <label><span className="field-label">Unité liée</span><input readOnly value={article?.units?.abbreviation ?? '-'} className="input mt-2 bg-slate-100" /></label>
              <div><span className="field-label">Disponible à l’origine</span><p className="mt-2 font-bold">{line.available === null ? '—' : `${line.available.toLocaleString('fr-FR')} ${article?.units?.abbreviation ?? ''}`}</p>{invalidQuantity && <span className="text-xs font-semibold text-red-700">Quantité supérieure au stock disponible</span>}</div>
              <label><span className="field-label">Commentaire de ligne</span><input value={line.line_comment} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, line_comment: event.target.value } : item))} className="input mt-2" placeholder="Facultatif" /></label>
              <button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="btn-secondary text-red-700" aria-label={`Supprimer la ligne ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          })}
          {lines.length === 0 && <p className="rounded-md border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">Ajoutez les articles à transférer. Ce brouillon incomplet est sauvegardé automatiquement.</p>}
        </div>
        {lines.some((line) => line.available !== null && Number(line.quantity) > (line.available ?? 0)) && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-800">Une quantité dépasse le stock disponible. Aucun mouvement ne sera créé.</p>}
        {lines.some((line) => {
          const article = articles.find((item) => item.id === line.article_id)
          if (!article || !values.from_location_id || !values.to_location_id) return false
          const allowedIds = getArticleAllowedLocationIds(article.locations_restricted, article.article_locations?.map((link) => link.locations.id) ?? [], locations.map((location) => location.id))
          return !allowedIds.includes(values.from_location_id) || !allowedIds.includes(values.to_location_id)
        }) && <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">Une localisation ne fait pas partie des emplacements autorisés pour un article de ce transfert.</p>}
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />{savedAt ? `Dernière sauvegarde serveur : ${new Date(savedAt).toLocaleString('fr-FR')}` : 'Sauvegarde locale immédiate et synchronisation automatique.'} Aucun mouvement n’est créé avant la remise physique.</p><div className="flex gap-2">{['direction', 'magasinier'].includes(profile?.role ?? '') && <Link to="/stock/transfer/single" className="btn-secondary">Faire un transfert unitaire</Link>}<button type="submit" disabled={saving || !canFinalize || hydratingDraft || destinationsLoading} className="btn-primary">Préparer le transfert</button></div></footer>
      <QuickArticleDrawer open={quickArticleOpen} profileId={profile?.id} defaultLocationId={values.from_location_id} onClose={() => setQuickArticleOpen(false)} onCreated={(article) => { setArticles((current) => [article, ...current.filter((item) => item.id !== article.id)]); setCandidateArticleId(article.id) }} />
    </form>
  )

}

function toPayload(values: DraftValues, lines: TransferLine[]): StockTransferDraftPayload {
  return {
    ...values,
    lines: lines.map((line) => ({ article_id: line.article_id || null, unit_id: line.unit_id || null, quantity: line.quantity.trim() ? Number(line.quantity) : null, line_comment: line.line_comment })),
  }
}
