import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { Login } from './pages/auth/Login'
import { Register } from './pages/auth/Register'
import { Pending } from './pages/auth/Pending'
import { Dashboard } from './pages/Dashboard'
import { PurchasesDashboard } from './pages/dashboard/PurchasesDashboard'
import { StockDashboard } from './pages/dashboard/StockDashboard'
import { SalesDashboard } from './pages/dashboard/SalesDashboard'
import { FinanceDashboard } from './pages/dashboard/FinanceDashboard'
import { Profile } from './pages/profile/Profile'
import { UsersList } from './pages/admin/users/UsersList'
import { FamiliesPage } from './pages/admin/families/FamiliesPage'
import { UnitsPage } from './pages/admin/units/UnitsPage'
import { LocationsPage } from './pages/admin/locations/LocationsPage'
import { SuppliersPage } from './pages/admin/suppliers/SuppliersPage'
import { ArticlesList } from './pages/articles/ArticlesList'
import { ArticleFormPage } from './pages/articles/ArticleFormPage'
import { ArticleDetail } from './pages/articles/ArticleDetail'
import { RecipesList } from './pages/recipes/RecipesList'
import { RecipeFormPage } from './pages/recipes/RecipeFormPage'
import { RecipeDetail } from './pages/recipes/RecipeDetail'
import { RecipeImportPage } from './pages/recipes/RecipeImportPage'
import { PendingIngredientsPage } from './pages/recipes/PendingIngredientsPage'
import { EventsList } from './pages/events/EventsList'
import { EventFormPage } from './pages/events/EventFormPage'
import { EventDetail } from './pages/events/EventDetail'
import { PurchaseNeedsPage } from './pages/events/PurchaseNeedsPage'
import { EventProductionPage } from './pages/events/EventProductionPage'
import { EventAnalysisPage } from './pages/events/EventAnalysisPage'
import { EventStatsPage } from './pages/events/EventStatsPage'
import { PurchaseNeedsList } from './pages/purchase-needs/PurchaseNeedsList'
import { PurchaseNeedFormPage } from './pages/purchase-needs/PurchaseNeedFormPage'
import { CashPurchasesList } from './pages/cash-purchases/CashPurchasesList'
import { CashPurchaseFormPage } from './pages/cash-purchases/CashPurchaseFormPage'
import { CashPurchaseDetail } from './pages/cash-purchases/CashPurchaseDetail'
import { PurchaseOrdersList } from './pages/purchase-orders/PurchaseOrdersList'
import { PurchaseOrderFormPage } from './pages/purchase-orders/PurchaseOrderFormPage'
import { PurchaseOrderDetail } from './pages/purchase-orders/PurchaseOrderDetail'
import { ReceptionsList } from './pages/receptions/ReceptionsList'
import { ReceptionFormPage } from './pages/receptions/ReceptionFormPage'
import { ReceptionDetail } from './pages/receptions/ReceptionDetail'
import { StockList } from './pages/stock/StockList'
import { StockTransferPage } from './pages/stock/StockTransferPage'
import { StockMovementsPage } from './pages/stock/StockMovementsPage'
import { ManualMovementPage } from './pages/stock/ManualMovementPage'
import { PriceHistoryPage } from './pages/stock/PriceHistoryPage'
import { StockArticleDetailPage } from './pages/stock/StockArticleDetailPage'
import { InvoicesList } from './pages/invoices/InvoicesList'
import { InvoiceFormPage } from './pages/invoices/InvoiceFormPage'
import { InvoiceDetail } from './pages/invoices/InvoiceDetail'
import { StockOutsList } from './pages/stock-outs/StockOutsList'
import { StockOutFormPage } from './pages/stock-outs/StockOutFormPage'
import { ConsumptionAnalysisPage } from './pages/stock-outs/ConsumptionAnalysisPage'
import { StockOutDetail } from './pages/stock-outs/StockOutDetail'
import { SalesList } from './pages/sales/SalesList'
import { SaleFormPage } from './pages/sales/SaleFormPage'
import { SaleDetail } from './pages/sales/SaleDetail'
import { SalesStatsPage } from './pages/sales/SalesStatsPage'
import { InventoriesList } from './pages/inventories/InventoriesList'
import { InventoryFormPage } from './pages/inventories/InventoryFormPage'
import { InventoryDetail } from './pages/inventories/InventoryDetail'
import { InitialInventoryPage } from './pages/inventories/InitialInventoryPage'
import { InterModuleAuditPage } from './pages/audit/InterModuleAuditPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pending" element={<Pending />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/purchases" element={<PurchasesDashboard />} />
          <Route path="/dashboard/stock" element={<StockDashboard />} />
          <Route path="/dashboard/sales" element={<SalesDashboard />} />
          <Route path="/dashboard/finance" element={<FinanceDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/articles" element={<ArticlesList />} />
          <Route path="/articles/:id" element={<ArticleDetail />} />
          <Route path="/recipes" element={<RecipesList />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/events" element={<EventsList />} />
          <Route path="/events/stats" element={<EventStatsPage />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/events/:id/purchase-needs" element={<PurchaseNeedsPage />} />
          <Route path="/events/:id/production" element={<EventProductionPage />} />
          <Route path="/events/:id/analysis" element={<EventAnalysisPage />} />
          <Route path="/purchase-needs" element={<PurchaseNeedsList />} />
          <Route path="/cash-purchases" element={<CashPurchasesList />} />
          <Route path="/cash-purchases/:id" element={<CashPurchaseDetail />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersList />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
          <Route path="/receptions" element={<ReceptionsList />} />
          <Route path="/receptions/:id" element={<ReceptionDetail />} />
          <Route path="/stock" element={<StockList />} />
          <Route path="/stock/movements" element={<StockMovementsPage />} />
          <Route path="/stock/articles/:articleId" element={<StockArticleDetailPage />} />
          <Route path="/stock/prices/:articleId" element={<PriceHistoryPage />} />
          <Route path="/stock/stock-out" element={<StockOutsList />} />
          <Route path="/stock/stock-out/:id" element={<StockOutDetail />} />
          <Route path="/stock/consumption-analysis" element={<ConsumptionAnalysisPage />} />
          <Route path="/invoices" element={<InvoicesList />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/sales" element={<SalesList />} />
          <Route path="/sales/stats" element={<SalesStatsPage />} />
          <Route path="/sales/:id" element={<SaleDetail />} />
          <Route path="/inventories" element={<InventoriesList />} />
          <Route path="/inventories/initial" element={<InitialInventoryPage />} />
          <Route path="/inventories/:id" element={<InventoryDetail />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'chef_cuisine', 'magasinier', 'acheteur']} />}>
        <Route element={<AppLayout />}>
          <Route path="/articles/new" element={<ArticleFormPage />} />
          <Route path="/articles/:id/edit" element={<ArticleFormPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'chef_cuisine', 'fiche_technique']} />}>
        <Route element={<AppLayout />}>
          <Route path="/recipes/new" element={<RecipeFormPage />} />
          <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
          <Route path="/recipes/import" element={<RecipeImportPage />} />
          <Route path="/recipes/pending-ingredients" element={<PendingIngredientsPage />} />
          <Route path="/events/new" element={<EventFormPage />} />
          <Route path="/events/:id/edit" element={<EventFormPage />} />
          <Route path="/purchase-needs/new" element={<PurchaseNeedFormPage />} />
          <Route path="/cash-purchases/new" element={<CashPurchaseFormPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'acheteur']} />}>
        <Route element={<AppLayout />}>
          <Route path="/purchase-orders/new" element={<PurchaseOrderFormPage />} />
          <Route path="/purchase-orders/:id/edit" element={<PurchaseOrderFormPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'magasinier']} />}>
        <Route element={<AppLayout />}>
          <Route path="/receptions/new" element={<ReceptionFormPage />} />
          <Route path="/receptions/:id/edit" element={<ReceptionFormPage />} />
          <Route path="/stock/movements/manual/new" element={<ManualMovementPage />} />
          <Route path="/inventories/new" element={<InventoryFormPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'magasinier', 'chef_cuisine']} />}>
        <Route element={<AppLayout />}>
          <Route path="/stock/transfer" element={<StockTransferPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'chef_cuisine']} />}>
        <Route element={<AppLayout />}>
          <Route path="/stock/stock-out/new" element={<StockOutFormPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'comptabilite']} />}>
        <Route element={<AppLayout />}>
          <Route path="/invoices/new" element={<InvoiceFormPage />} />
          <Route path="/invoices/:id/edit" element={<InvoiceFormPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'point_vente']} />}>
        <Route element={<AppLayout />}>
          <Route path="/sales/new" element={<SaleFormPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/users" element={<UsersList />} />
          <Route path="/audit/inter-modules" element={<InterModuleAuditPage />} />
          <Route path="/admin/families" element={<FamiliesPage />} />
          <Route path="/admin/units" element={<UnitsPage />} />
          <Route path="/admin/locations" element={<LocationsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['direction', 'acheteur', 'comptabilite']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/suppliers" element={<SuppliersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
