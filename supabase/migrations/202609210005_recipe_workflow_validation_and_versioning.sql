-- Lot A6 - workflow, validations, snapshots et versionnement FT. Local uniquement.
begin;

insert into stock.role_permissions(role, permission)
values ('direction'::stock.user_role, 'recipes.final_validate')
on conflict (role, permission) do nothing;

alter table stock.recipes drop constraint if exists recipes_workflow_status_chk;
alter table stock.recipes
  add column if not exists submitted_by uuid references stock.profiles(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists correction_requested_by uuid references stock.profiles(id) on delete set null,
  add column if not exists correction_requested_at timestamptz,
  add column if not exists correction_reason text,
  add column if not exists validated_material_cost numeric(14,2),
  add column if not exists validated_cost_per_yield numeric(14,4),
  add column if not exists validated_theoretical_sale_price_ttc numeric(14,2),
  add column if not exists validated_retained_sale_price_ttc numeric(14,2),
  add column if not exists validated_snapshot_at timestamptz,
  add constraint recipes_workflow_status_chk check (
    workflow_status is null or workflow_status in
    ('draft','submitted','chef_validated','direction_review','needs_correction','approved','refused','to_produce')
  );

alter table stock.recipe_validation_history drop constraint if exists recipe_validation_history_action_check;
alter table stock.recipe_validation_history
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add constraint recipe_validation_history_action_check check (action in (
    'submitted','chef_validated','chef_returned','direction_validated',
    'direction_returned','final_validated','version_created','archived','refused'
  ));

create or replace function stock.assert_recipe_ready(p_recipe_id uuid)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_recipe stock.recipes%rowtype;
  v_cost numeric;
begin
  select * into v_recipe from stock.recipes where id = p_recipe_id for update;
  if v_recipe.id is null then raise exception 'Fiche technique introuvable'; end if;
  if nullif(btrim(v_recipe.name), '') is null then raise exception 'Le nom de la fiche est obligatoire'; end if;
  if v_recipe.yield_mode = 'portions' and coalesce(v_recipe.portions, 0) <= 0 then raise exception 'Le nombre de portions est invalide'; end if;
  if v_recipe.yield_mode = 'rendement_produit' and (coalesce(v_recipe.yield_quantity, 0) <= 0 or v_recipe.yield_unit_id is null) then raise exception 'Le rendement produit est incomplet'; end if;
  if exists (select 1 from stock.pending_ingredients p where p.recipe_id = p_recipe_id and p.status in ('pending','ambiguous')) then raise exception 'Des ingrédients restent à rapprocher'; end if;
  if not exists (select 1 from stock.recipe_ingredients i where i.recipe_id = p_recipe_id) then raise exception 'Ajoutez au moins un ingrédient'; end if;
  if exists (select 1 from stock.recipe_ingredients i where i.recipe_id = p_recipe_id and i.line_kind = 'article' and (i.article_id is null or i.unit_stored is null or coalesce(i.quantity_stored,0) <= 0)) then raise exception 'Une ligne ingrédient est incomplète'; end if;
  if exists (select 1 from stock.recipe_ingredients i where i.recipe_id = p_recipe_id and i.quantity_mode = 'net' and i.trim_form_id is null and not (coalesce(i.yield_percent_snapshot,0) > 0 and i.yield_percent_snapshot <= 100)) then raise exception 'Une ligne NET ne possède pas de rendement exploitable'; end if;
  if not exists (select 1 from stock.recipe_steps s where s.recipe_id = p_recipe_id and nullif(btrim(s.instructions), '') is not null) then raise exception 'Le procédé est incomplet'; end if;
  if exists (
    select 1 from stock.recipe_ingredients i
    where i.recipe_id = p_recipe_id and i.line_kind = 'article'
      and not exists (
        select 1 from stock.purchase_actual_price_candidates c
        where c.article_id = i.article_id and c.classification = 'normal'
      )
  ) then raise exception 'Prix NORMAL manquant'; end if;
  if exists (
    select 1 from stock.recipe_ingredients i
    join lateral (
      select c.normalized_unit_price from stock.purchase_actual_price_candidates c
      where c.article_id = i.article_id and c.classification = 'normal'
      order by c.effective_date desc nulls last limit 1
    ) p on true
    where i.recipe_id = p_recipe_id and i.line_kind = 'article'
      and p.normalized_unit_price is null
  ) then raise exception 'Prix NORMAL existant mais coût normalisé incomplet'; end if;
  if exists (
    select 1
    from stock.recipe_ingredients i
    left join stock.recipes child on child.id = i.subrecipe_id
    where i.recipe_id = p_recipe_id
      and i.line_kind = 'subrecipe'
      and (
        i.subrecipe_id is null
        or i.article_id is not null
        or i.unit_stored is null
        or coalesce(i.quantity_stored, 0) <= 0
        or child.id is null
        or child.status is distinct from 'validee'
        or child.yield_mode is distinct from 'rendement_produit'
        or coalesce(child.yield_quantity, 0) <= 0
        or child.yield_unit_id is null
        or i.unit_stored is distinct from child.yield_unit_id
      )
  ) then raise exception 'Une sous-recette est incomplète, non validée ou son unité de rendement est inexploitable'; end if;
  if exists (
    with recursive dependency(recipe_id, subrecipe_id, path, has_cycle) as (
      select i.recipe_id, i.subrecipe_id, array[i.recipe_id, i.subrecipe_id], i.subrecipe_id = i.recipe_id
      from stock.recipe_ingredients i
      where i.recipe_id = p_recipe_id and i.line_kind = 'subrecipe'
      union all
      select d.recipe_id, i.subrecipe_id, d.path || i.subrecipe_id, i.subrecipe_id = any(d.path)
      from dependency d
      join stock.recipe_ingredients i on i.recipe_id = d.subrecipe_id
      where d.subrecipe_id is not null and not d.has_cycle and i.line_kind = 'subrecipe'
    )
    select 1 from dependency where has_cycle
  ) then raise exception 'Dépendance circulaire entre fiches techniques'; end if;

  select coalesce(sum(case
    when i.line_kind = 'subrecipe' then i.quantity_stored * (child.total_cost / nullif(child.yield_quantity,0))
    else i.quantity_stored * p.normalized_unit_price end), 0)
  into v_cost
  from stock.recipe_ingredients i
  left join stock.recipes child on child.id = i.subrecipe_id
  left join lateral (
    select c.normalized_unit_price from stock.purchase_actual_price_candidates c
    where c.article_id = i.article_id and c.classification = 'normal'
    order by c.effective_date desc nulls last limit 1
  ) p on true
  where i.recipe_id = p_recipe_id;
  if coalesce(v_cost,0) <= 0 then raise exception 'Le coût matière est non calculable'; end if;
  return round(v_cost,2);
end;
$$;

create or replace function stock.submit_recipe_for_validation(p_recipe_id uuid)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions as $$
declare v_actor uuid; v_recipe stock.recipes%rowtype; v_cost numeric;
begin
  if not stock.can_current_user_manage_recipes() then raise exception 'Permission insuffisante'; end if;
  v_actor := stock.current_profile_id();
  select * into v_recipe from stock.recipes where id=p_recipe_id for update;
  if v_recipe.status <> 'brouillon' or coalesce(v_recipe.workflow_status, 'draft') not in ('draft','needs_correction') then raise exception 'Seule une fiche brouillon ou à corriger peut être soumise'; end if;
  v_cost := stock.assert_recipe_ready(p_recipe_id);
  update stock.recipes set status='en_attente', workflow_status='submitted', submitted_by=v_actor, submitted_at=now(),
    chef_validated_by=null, chef_validated_at=null, direction_validated_by=null, direction_validated_at=null,
    correction_requested_by=null, correction_requested_at=null, correction_reason=null,
    material_cost_ht=v_cost, total_cost=v_cost, cost_per_portion=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end,
    theoretical_sale_price_ttc=case when yield_mode='portions' then v_cost*4+2000*portions else 0 end,
    updated_by=v_actor, updated_at=now() where id=p_recipe_id;
  insert into stock.recipe_validation_history(recipe_id,action,actor_id,metadata) values(p_recipe_id,'submitted',v_actor,jsonb_build_object('version',v_recipe.version));
end; $$;

create or replace function stock.chef_review_recipe(p_recipe_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions as $$
declare v_actor uuid; v_role stock.user_role; v_recipe stock.recipes%rowtype;
begin
  select id,role into v_actor,v_role from stock.profiles where user_id=auth.uid() and status='active' limit 1;
  if v_actor is null or v_role <> 'chef_cuisine' then raise exception 'Seul un Chef cuisine actif peut effectuer cette revue'; end if;
  select * into v_recipe from stock.recipes where id=p_recipe_id for update;
  if v_recipe.status <> 'en_attente' or v_recipe.workflow_status <> 'submitted' then raise exception 'La fiche n attend pas la validation Chef'; end if;
  if p_approve then
    perform stock.assert_recipe_ready(p_recipe_id);
    update stock.recipes set workflow_status='chef_validated',chef_validated_by=v_actor,chef_validated_at=now(),updated_by=v_actor,updated_at=now() where id=p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id,action,actor_id) values(p_recipe_id,'chef_validated',v_actor);
  else
    if nullif(btrim(p_reason),'') is null then raise exception 'Le motif de correction est obligatoire'; end if;
    update stock.recipes set status='brouillon',workflow_status='needs_correction',correction_requested_by=v_actor,correction_requested_at=now(),correction_reason=btrim(p_reason),chef_validated_by=null,chef_validated_at=null,direction_validated_by=null,direction_validated_at=null,updated_by=v_actor,updated_at=now() where id=p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment) values(p_recipe_id,'chef_returned',v_actor,btrim(p_reason));
  end if;
end; $$;

create or replace function stock.direction_review_recipe(p_recipe_id uuid, p_approve boolean, p_pin text, p_reason text default null, p_retained_price numeric default null)
returns void language plpgsql security definer
set search_path = pg_catalog, stock, auth, extensions as $$
declare v_actor uuid; v_recipe stock.recipes%rowtype; v_cost numeric; v_theoretical numeric;
begin
  v_actor := stock.assert_sensitive_action('recipes.final_validate',p_pin,case when p_approve then 'recipe.final_validate' else 'recipe.return_for_correction' end,'recipe',p_recipe_id,p_reason,'{}'::jsonb);
  if not stock.is_current_user_direction() then raise exception 'Seule la Direction peut effectuer cette revue'; end if;
  select * into v_recipe from stock.recipes where id=p_recipe_id for update;
  if v_recipe.status <> 'en_attente' or v_recipe.workflow_status <> 'chef_validated' or v_recipe.chef_validated_at is null then raise exception 'La validation Chef est obligatoire avant la Direction'; end if;
  if not p_approve then
    if nullif(btrim(p_reason),'') is null then raise exception 'Le motif de correction est obligatoire'; end if;
    update stock.recipes set status='brouillon',workflow_status='needs_correction',correction_requested_by=v_actor,correction_requested_at=now(),correction_reason=btrim(p_reason),direction_validated_by=null,direction_validated_at=null,updated_by=v_actor,updated_at=now() where id=p_recipe_id;
    insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment) values(p_recipe_id,'direction_returned',v_actor,btrim(p_reason)); return;
  end if;
  v_cost := stock.assert_recipe_ready(p_recipe_id);
  v_theoretical := case when v_recipe.yield_mode='portions' then v_cost*4+2000*v_recipe.portions else 0 end;
  if p_retained_price is null or p_retained_price <= 0 then raise exception 'Le PV retenu TTC doit être renseigné par la Direction'; end if;
  with latest_prices as (
    select distinct on (c.article_id)
      c.article_id, c.normalized_unit_price, c.effective_date, c.source_type, c.source_line_id
    from stock.purchase_actual_price_candidates c
    where c.classification='normal'
    order by c.article_id, c.effective_date desc nulls last
  )
  update stock.recipe_ingredients i set normalized_price_snapshot=p.normalized_unit_price,price_effective_at_snapshot=p.effective_date,
    price_source_type=p.source_type,price_source_id=p.source_line_id,price_effective_at=p.effective_date,
    unit_price=p.normalized_unit_price,total_cost=i.quantity_stored*p.normalized_unit_price,economic_snapshot_at=now()
  from latest_prices p
  where i.recipe_id=p_recipe_id and i.line_kind='article' and p.article_id=i.article_id;
  update stock.recipe_ingredients i
  set subrecipe_cost_snapshot = child.total_cost / nullif(child.yield_quantity, 0),
    unit_price = child.total_cost / nullif(child.yield_quantity, 0),
    total_cost = i.quantity_stored * (child.total_cost / nullif(child.yield_quantity, 0)),
    economic_snapshot_at = now()
  from stock.recipes child
  where i.recipe_id = p_recipe_id
    and i.line_kind = 'subrecipe'
    and child.id = i.subrecipe_id;
  update stock.recipes set status='validee',workflow_status='approved',validated_by=v_actor,validated_at=now(),direction_validated_by=v_actor,direction_validated_at=now(),
    material_cost_ht=v_cost,total_cost=v_cost,cost_per_portion=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end,
    theoretical_sale_price_ttc=v_theoretical,suggested_price=v_theoretical,retained_sale_price_ttc=p_retained_price,final_price=p_retained_price,retained_sale_price_reason=nullif(btrim(p_reason),''),
    validated_material_cost=v_cost,validated_cost_per_yield=case when yield_mode='portions' then v_cost/nullif(portions,0) else v_cost/nullif(yield_quantity,0) end,
    validated_theoretical_sale_price_ttc=v_theoretical,validated_retained_sale_price_ttc=p_retained_price,validated_snapshot_at=now(),updated_by=v_actor,updated_at=now()
  where id=p_recipe_id;
  insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment,metadata) values(p_recipe_id,'final_validated',v_actor,nullif(btrim(p_reason),''),jsonb_build_object('material_cost',v_cost,'theoretical_price',v_theoretical,'retained_price',p_retained_price,'version',v_recipe.version));
end; $$;

create or replace function stock.archive_recipe(p_recipe_id uuid, p_pin text, p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,stock,auth,extensions as $$
declare v_actor uuid;
begin
  if nullif(btrim(p_reason),'') is null then raise exception 'Le motif d archivage est obligatoire'; end if;
  v_actor:=stock.assert_sensitive_action('recipes.final_validate',p_pin,'recipe.archive','recipe',p_recipe_id,p_reason,'{}'::jsonb);
  if not stock.is_current_user_direction() then raise exception 'Seule la Direction peut archiver une fiche'; end if;
  update stock.recipes set status='archived',archived_at=now(),updated_by=v_actor,updated_at=now() where id=p_recipe_id;
  insert into stock.recipe_validation_history(recipe_id,action,actor_id,comment) values(p_recipe_id,'archived',v_actor,btrim(p_reason));
end; $$;

create or replace function stock.record_recipe_version_created(p_recipe_id uuid, p_parent_recipe_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,stock,auth,extensions as $$
declare v_actor uuid; v_recipe stock.recipes%rowtype; v_parent stock.recipes%rowtype;
begin
  if not stock.can_current_user_manage_recipes() then raise exception 'Permission insuffisante'; end if;
  v_actor:=stock.current_profile_id();
  select * into v_recipe from stock.recipes where id=p_recipe_id for update;
  select * into v_parent from stock.recipes where id=p_parent_recipe_id;
  if v_recipe.id is null or v_parent.id is null then raise exception 'Version ou fiche parente introuvable'; end if;
  if v_parent.status <> 'validee' then raise exception 'Seule une fiche validée peut être versionnée'; end if;
  if v_recipe.status <> 'brouillon' or v_recipe.workflow_status <> 'draft' or v_recipe.created_by is distinct from v_actor then raise exception 'Nouvelle version incohérente'; end if;
  if v_recipe.parent_version_id is distinct from coalesce(v_parent.parent_version_id,v_parent.id) then raise exception 'Lien de version incohérent'; end if;
  insert into stock.recipe_validation_history(recipe_id,action,actor_id,metadata)
  values(p_recipe_id,'version_created',v_actor,jsonb_build_object('parent_recipe_id',p_parent_recipe_id,'parent_version',v_parent.version,'version',v_recipe.version));
end; $$;

create or replace function stock.create_recipe_version(
  p_parent_recipe_id uuid,
  p_recipe jsonb,
  p_ingredients jsonb,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, stock, auth, extensions
as $$
declare
  v_actor uuid;
  v_parent stock.recipes%rowtype;
  v_root_id uuid;
  v_recipe_id uuid;
  v_version integer;
begin
  if not stock.can_current_user_manage_recipes() then
    raise exception 'Permission insuffisante';
  end if;
  v_actor := stock.current_profile_id();
  if v_actor is null then
    raise exception 'Profil actif introuvable';
  end if;

  select * into v_parent from stock.recipes where id = p_parent_recipe_id for update;
  if v_parent.id is null or v_parent.status <> 'validee' then
    raise exception 'Seule une fiche validée peut être versionnée';
  end if;
  v_root_id := coalesce(v_parent.parent_version_id, v_parent.id);
  perform 1 from stock.recipes where id = v_root_id for update;
  select coalesce(max(version), 0) + 1 into v_version
  from stock.recipes
  where id = v_root_id or parent_version_id = v_root_id;

  if p_recipe ->> 'type' = 'BF' then
    raise exception 'Le type BF est historique et ne peut pas être créé';
  end if;

  insert into stock.recipes(
    code, name, type, sub_type, main_ingredient, portions, description, tags,
    total_cost, cost_per_portion, suggested_price, final_price, cost_ratio,
    margin_rate, margin_coefficient, yield_mode, yield_quantity, yield_unit_id,
    retained_sale_price_ttc, retained_sale_price_reason, dressing_photo_alt,
    dressing_photo_path, dressing_photo_url, status, workflow_status, version,
    parent_version_id, created_by, updated_by
  ) values (
    null, nullif(btrim(p_recipe ->> 'name'), ''), (p_recipe ->> 'type')::stock.recipe_type,
    nullif(btrim(p_recipe ->> 'sub_type'), ''), (p_recipe ->> 'main_ingredient')::stock.recipe_main_ingredient,
    coalesce((p_recipe ->> 'portions')::integer, 0), nullif(btrim(p_recipe ->> 'description'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe -> 'tags', '[]'::jsonb)))::stock.recipe_tag[], '{}'::stock.recipe_tag[]),
    coalesce((p_recipe ->> 'total_cost')::numeric, 0), coalesce((p_recipe ->> 'cost_per_portion')::numeric, 0),
    coalesce((p_recipe ->> 'suggested_price')::numeric, 0), 0, coalesce((p_recipe ->> 'cost_ratio')::numeric, 0),
    coalesce((p_recipe ->> 'margin_rate')::numeric, 0), coalesce((p_recipe ->> 'margin_coefficient')::numeric, 3),
    coalesce(nullif(btrim(p_recipe ->> 'yield_mode'), ''), 'portions'), (p_recipe ->> 'yield_quantity')::numeric,
    nullif(btrim(p_recipe ->> 'yield_unit_id'), '')::uuid, null, null,
    nullif(btrim(p_recipe ->> 'dressing_photo_alt'), ''), nullif(btrim(p_recipe ->> 'dressing_photo_path'), ''),
    nullif(btrim(p_recipe ->> 'dressing_photo_url'), ''), 'brouillon', 'draft', v_version,
    v_root_id, v_actor, v_actor
  ) returning id into v_recipe_id;

  insert into stock.recipe_ingredients(
    recipe_id, article_id, imported_name, quantity, unit_id, unit_name, unit_price,
    total_cost, resolution_status, sort_order, quantity_display, unit_display,
    quantity_stored, unit_stored, conversion_factor, is_net_quantity, quantity_mode,
    trim_form_id, yield_percent_snapshot, line_kind, subrecipe_id,
    trim_form_name_snapshot, normalized_price_snapshot, price_effective_at_snapshot,
    subrecipe_cost_snapshot, economic_snapshot_at
  )
  select v_recipe_id, x.article_id, x.imported_name, x.quantity, x.unit_id, x.unit_name,
    coalesce(x.unit_price, 0), coalesce(x.total_cost, 0), coalesce(x.resolution_status::stock.pending_ingredient_status, 'resolved'),
    x.sort_order, x.quantity_display, x.unit_display, x.quantity_stored, x.unit_stored,
    x.conversion_factor, coalesce(x.is_net_quantity, false), coalesce(x.quantity_mode, 'brut'),
    x.trim_form_id, x.yield_percent_snapshot, coalesce(x.line_kind, 'article'), x.subrecipe_id,
    x.trim_form_name_snapshot, x.normalized_price_snapshot, x.price_effective_at_snapshot,
    x.subrecipe_cost_snapshot, x.economic_snapshot_at
  from jsonb_to_recordset(coalesce(p_ingredients, '[]'::jsonb)) as x(
    article_id uuid, imported_name text, quantity numeric, unit_id uuid, unit_name text,
    unit_price numeric, total_cost numeric, resolution_status text, sort_order integer,
    quantity_display numeric, unit_display uuid, quantity_stored numeric, unit_stored uuid,
    conversion_factor numeric, is_net_quantity boolean, quantity_mode text, trim_form_id uuid,
    yield_percent_snapshot numeric, line_kind text, subrecipe_id uuid,
    trim_form_name_snapshot text, normalized_price_snapshot numeric,
    price_effective_at_snapshot timestamptz, subrecipe_cost_snapshot numeric,
    economic_snapshot_at timestamptz
  );

  insert into stock.recipe_steps(
    recipe_id, step_order, title, instructions, active_duration_minutes,
    passive_duration_minutes, attention_points, observation, created_by, updated_by
  )
  select v_recipe_id, x.step_order, nullif(btrim(x.title), ''), x.instructions,
    x.active_duration_minutes, x.passive_duration_minutes, nullif(btrim(x.attention_points), ''),
    nullif(btrim(x.observation), ''), v_actor, v_actor
  from jsonb_to_recordset(coalesce(p_steps, '[]'::jsonb)) as x(
    step_order integer, title text, instructions text, active_duration_minutes numeric,
    passive_duration_minutes numeric, attention_points text, observation text
  );

  insert into stock.recipe_validation_history(recipe_id, action, actor_id, metadata)
  values (v_recipe_id, 'version_created', v_actor, jsonb_build_object(
    'parent_recipe_id', v_parent.id,
    'parent_version', v_parent.version,
    'version', v_version
  ));

  return v_recipe_id;
end;
$$;

create or replace function stock.guard_recipe_insert()
returns trigger language plpgsql set search_path=pg_catalog,stock,auth,extensions as $$
begin
  if new.type = 'BF' then raise exception 'Le type BF est historique et ne peut plus être créé'; end if;
  if current_user not in ('postgres','supabase_admin') and (
    new.status <> 'brouillon'
    or coalesce(new.workflow_status,'draft') <> 'draft'
    or new.validated_by is not null or new.validated_at is not null
    or new.chef_validated_by is not null or new.chef_validated_at is not null
    or new.direction_validated_by is not null or new.direction_validated_at is not null
  ) then raise exception 'Une nouvelle fiche doit être un brouillon sans validation et ne peut pas être de type BF legacy'; end if;
  return new;
end; $$;

drop trigger if exists recipe_insert_workflow_guard on stock.recipes;
create trigger recipe_insert_workflow_guard before insert on stock.recipes for each row execute function stock.guard_recipe_insert();

create or replace function stock.guard_validated_recipe_mutation()
returns trigger language plpgsql set search_path=pg_catalog,stock,auth,extensions as $$
begin
  if current_user not in ('postgres','supabase_admin') then
    if old.status in ('en_attente','validee','archived') then
      raise exception 'Une fiche soumise, validée ou archivée ne peut pas être modifiée directement';
    end if;
    if new.status is distinct from old.status
       or new.workflow_status is distinct from old.workflow_status
       or new.chef_validated_by is distinct from old.chef_validated_by
       or new.chef_validated_at is distinct from old.chef_validated_at
       or new.direction_validated_by is distinct from old.direction_validated_by
       or new.direction_validated_at is distinct from old.direction_validated_at
       or new.validated_by is distinct from old.validated_by
       or new.validated_at is distinct from old.validated_at then
      raise exception 'Les transitions de workflow doivent passer par les RPC officielles';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists validated_recipe_mutation_guard on stock.recipes;
create trigger validated_recipe_mutation_guard before update on stock.recipes for each row execute function stock.guard_validated_recipe_mutation();

create or replace function stock.guard_validated_recipe_child_mutation()
returns trigger language plpgsql set search_path=pg_catalog,stock,auth,extensions as $$
declare
  v_recipe_id uuid;
  v_status stock.recipe_status;
begin
  v_recipe_id := case when tg_op = 'DELETE' then old.recipe_id else new.recipe_id end;
  select r.status into v_status from stock.recipes r where r.id = v_recipe_id;
  if v_status in ('en_attente','validee','archived') and current_user not in ('postgres','supabase_admin') then
    raise exception 'Le contenu d une fiche soumise, validée ou archivée est immuable';
  end if;
  if tg_op = 'UPDATE' and new.recipe_id is distinct from old.recipe_id then
    select r.status into v_status from stock.recipes r where r.id = old.recipe_id;
    if v_status in ('en_attente','validee','archived') and current_user not in ('postgres','supabase_admin') then
      raise exception 'Le contenu d une fiche soumise, validée ou archivée est immuable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists validated_recipe_ingredient_mutation_guard on stock.recipe_ingredients;
create trigger validated_recipe_ingredient_mutation_guard before insert or update or delete on stock.recipe_ingredients for each row execute function stock.guard_validated_recipe_child_mutation();
drop trigger if exists validated_recipe_step_mutation_guard on stock.recipe_steps;
create trigger validated_recipe_step_mutation_guard before insert or update or delete on stock.recipe_steps for each row execute function stock.guard_validated_recipe_child_mutation();

revoke all on function stock.assert_recipe_ready(uuid), stock.submit_recipe_for_validation(uuid), stock.chef_review_recipe(uuid,boolean,text), stock.direction_review_recipe(uuid,boolean,text,text,numeric), stock.archive_recipe(uuid,text,text), stock.record_recipe_version_created(uuid,uuid), stock.create_recipe_version(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function stock.submit_recipe_for_validation(uuid), stock.chef_review_recipe(uuid,boolean,text), stock.direction_review_recipe(uuid,boolean,text,text,numeric), stock.archive_recipe(uuid,text,text), stock.create_recipe_version(uuid,jsonb,jsonb,jsonb) to authenticated;
revoke insert, update, delete on stock.recipe_validation_history from authenticated;
revoke all on function stock.guard_recipe_insert(), stock.guard_validated_recipe_mutation(), stock.guard_validated_recipe_child_mutation() from public, anon, authenticated;

commit;
