-- Ajout local des rôles fonctionnels Contrôleur et Administratif Achats.
-- Préparée localement uniquement : ne pas exécuter à distance sans validation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='stock' AND t.typname='user_role' AND e.enumlabel='controleur') THEN
    ALTER TYPE stock.user_role ADD VALUE 'controleur';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='stock' AND t.typname='user_role' AND e.enumlabel='administratif_achats') THEN
    ALTER TYPE stock.user_role ADD VALUE 'administratif_achats';
  END IF;
END $$;

-- Les permissions seront ajoutées avec les RPC/API qui les contrôlent réellement.
