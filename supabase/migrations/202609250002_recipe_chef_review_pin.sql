-- Local additive migration, intentionally held out of the active chain.
-- Chef review and return-for-correction require the Chef's personal PIN.

insert into stock.role_permissions(role, permission)
select 'chef_cuisine'::stock.user_role, 'recipes.chef_review'
where not exists (
  select 1 from stock.role_permissions
  where role = 'chef_cuisine'::stock.user_role and permission = 'recipes.chef_review'
);

create or replace function stock.chef_review_recipe(
  p_recipe_id uuid,
  p_approve boolean,
  p_pin text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_actor uuid;
  v_recipe stock.recipes%rowtype;
begin
  if not exists (
    select 1
    from stock.profiles p
    where p.user_id = auth.uid()
      and p.role = 'chef_cuisine'::stock.user_role
      and p.status = 'active'::stock.user_status
  ) then
    raise exception 'Profil Chef cuisine actif requis';
  end if;

  v_actor := stock.assert_sensitive_action(
    'recipes.chef_review',
    p_pin,
    case when p_approve then 'recipe.chef_validate' else 'recipe.chef_return_for_correction' end,
    'recipe',
    p_recipe_id,
    p_reason,
    '{}'::jsonb
  );

  select * into v_recipe
  from stock.recipes
  where id = p_recipe_id
  for update;

  if not found then
    raise exception 'Fiche technique introuvable';
  end if;
  if v_recipe.status <> 'en_attente' or v_recipe.workflow_status <> 'submitted' then
    raise exception 'La fiche n’attend pas la validation Chef';
  end if;

  if p_approve then
    perform stock.assert_recipe_ready_for_draft(p_recipe_id);
    update stock.recipes
    set workflow_status = 'chef_validated',
        chef_validated_by = v_actor,
        chef_validated_at = now(),
        updated_by = v_actor,
        updated_at = now()
    where id = p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id, action, actor_id)
    values (p_recipe_id, 'chef_validated', v_actor);
  else
    if nullif(btrim(p_reason), '') is null then
      raise exception 'Le motif de correction est obligatoire';
    end if;
    update stock.recipes
    set status = 'brouillon',
        workflow_status = 'needs_correction',
        correction_requested_by = v_actor,
        correction_requested_at = now(),
        correction_reason = btrim(p_reason),
        chef_validated_by = null,
        chef_validated_at = null,
        direction_validated_by = null,
        direction_validated_at = null,
        updated_by = v_actor,
        updated_at = now()
    where id = p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id, action, actor_id, comment)
    values (p_recipe_id, 'chef_returned', v_actor, btrim(p_reason));
  end if;
end;
$$;

revoke all on function stock.chef_review_recipe(uuid, boolean, text) from public, anon, authenticated;
revoke all on function stock.chef_review_recipe(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function stock.chef_review_recipe(uuid, boolean, text, text) to authenticated;
