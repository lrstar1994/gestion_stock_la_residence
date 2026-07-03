create schema if not exists stock;
set search_path = stock, public, auth;

CREATE TABLE IF NOT EXISTS stock.sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES stock.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES stock.profiles(id),
  UNIQUE(family_id, name)
);

ALTER TABLE stock.sub_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage sub categories" ON stock.sub_categories;
CREATE POLICY "Directors can manage sub categories"
  ON stock.sub_categories FOR ALL
  USING (stock.is_current_user_direction())
  WITH CHECK (stock.is_current_user_direction());

DROP POLICY IF EXISTS "All users can view sub categories" ON stock.sub_categories;
CREATE POLICY "All users can view sub categories"
  ON stock.sub_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS update_sub_categories_updated_at ON stock.sub_categories;
CREATE TRIGGER update_sub_categories_updated_at
  BEFORE UPDATE ON stock.sub_categories
  FOR EACH ROW
  EXECUTE FUNCTION stock.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sub_categories_family_id ON stock.sub_categories(family_id);
CREATE INDEX IF NOT EXISTS idx_sub_categories_name ON stock.sub_categories(name);

GRANT SELECT, INSERT, UPDATE, DELETE ON stock.sub_categories TO authenticated;

INSERT INTO stock.sub_categories (family_id, name)
SELECT DISTINCT article.family_id, trim(article.sub_family)
FROM stock.articles article
WHERE article.sub_family IS NOT NULL
  AND trim(article.sub_family) <> ''
ON CONFLICT (family_id, name) DO NOTHING;
