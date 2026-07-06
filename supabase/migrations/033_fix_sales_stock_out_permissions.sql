create schema if not exists stock;
set search_path = stock, public, auth;

-- Les ventes doivent pouvoir creer les sorties et mouvements de stock associes.
-- Cette migration consolide les policies au cas ou les migrations stock/ventes
-- ont ete rejouees dans un ordre different sur un projet Supabase existant.

DROP POLICY IF EXISTS "Directors and Chef can manage stock outs" ON stock.stock_outs;
CREATE POLICY "Directors and Chef can manage stock outs"
  ON stock.stock_outs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stock.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'chef_cuisine', 'magasinier', 'point_vente')
      AND profiles.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('direction', 'chef_cuisine', 'magasinier', 'point_vente')
      AND profiles.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Staff can manage movements" ON stock.stock_movements;
CREATE POLICY "Staff can manage movements"
  ON stock.stock_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stock.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('magasinier', 'chef_cuisine', 'point_vente')
      AND profiles.status = 'active'
    )
    AND status != 'annule'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('magasinier', 'chef_cuisine', 'point_vente')
      AND profiles.status = 'active'
    )
    AND status != 'annule'
  );

