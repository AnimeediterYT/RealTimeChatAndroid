-- Bubble Chat cosmetic ownership and equipment.
-- Apply only to the disposable QA project until reviewed and approved for production.
-- All 100 cosmetics are free QA collectibles. No payment processor or real-money charge is implemented.

create table if not exists public.cosmetic_catalog (
  id text primary key,
  category text not null check (category in ('avatar-decorations','profile-effects','profile-frames','nameplates','bundles')),
  name text not null,
  description text not null default '',
  bundle_items text[] not null default '{}',
  sort_order integer not null default 0,
  is_free boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, category)
);
alter table public.cosmetic_catalog enable row level security;
revoke all on public.cosmetic_catalog from anon, authenticated;
grant select on public.cosmetic_catalog to anon, authenticated;
drop policy if exists cosmetic_catalog_read on public.cosmetic_catalog;
create policy cosmetic_catalog_read on public.cosmetic_catalog for select to anon, authenticated using (true);

insert into public.cosmetic_catalog(id,category,name,description,bundle_items,sort_order,is_free)
values
  ('avatar-decoration-01','avatar-decorations','Moonlit Halo','Avatar decorations',ARRAY[]::text[],1,true),
  ('avatar-decoration-02','avatar-decorations','Prism Orbit','Avatar decorations',ARRAY[]::text[],2,true),
  ('avatar-decoration-03','avatar-decorations','Violet Petals','Avatar decorations',ARRAY[]::text[],3,true),
  ('avatar-decoration-04','avatar-decorations','Stardust Ring','Avatar decorations',ARRAY[]::text[],4,true),
  ('avatar-decoration-05','avatar-decorations','Aurora Crest','Avatar decorations',ARRAY[]::text[],5,true),
  ('avatar-decoration-06','avatar-decorations','Pixel Comet','Avatar decorations',ARRAY[]::text[],6,true),
  ('avatar-decoration-07','avatar-decorations','Crystal Bloom','Avatar decorations',ARRAY[]::text[],7,true),
  ('avatar-decoration-08','avatar-decorations','Solar Flare','Avatar decorations',ARRAY[]::text[],8,true),
  ('avatar-decoration-09','avatar-decorations','Nebula Dust','Avatar decorations',ARRAY[]::text[],9,true),
  ('avatar-decoration-10','avatar-decorations','Frosted Orbit','Avatar decorations',ARRAY[]::text[],10,true),
  ('avatar-decoration-11','avatar-decorations','Rose Quartz','Avatar decorations',ARRAY[]::text[],11,true),
  ('avatar-decoration-12','avatar-decorations','Midnight Crown','Avatar decorations',ARRAY[]::text[],12,true),
  ('avatar-decoration-13','avatar-decorations','Lunar Ribbon','Avatar decorations',ARRAY[]::text[],13,true),
  ('avatar-decoration-14','avatar-decorations','Iris Spark','Avatar decorations',ARRAY[]::text[],14,true),
  ('avatar-decoration-15','avatar-decorations','Cloud Nine','Avatar decorations',ARRAY[]::text[],15,true),
  ('avatar-decoration-16','avatar-decorations','Glitch Halo','Avatar decorations',ARRAY[]::text[],16,true),
  ('avatar-decoration-17','avatar-decorations','Golden Hour','Avatar decorations',ARRAY[]::text[],17,true),
  ('avatar-decoration-18','avatar-decorations','Holo Shards','Avatar decorations',ARRAY[]::text[],18,true),
  ('avatar-decoration-19','avatar-decorations','Dreamcatcher','Avatar decorations',ARRAY[]::text[],19,true),
  ('avatar-decoration-20','avatar-decorations','Eclipse Mark','Avatar decorations',ARRAY[]::text[],20,true),
  ('profile-effect-01','profile-effects','Soft Radiance','Profile effects',ARRAY[]::text[],1,true),
  ('profile-effect-02','profile-effects','Aurora Pulse','Profile effects',ARRAY[]::text[],2,true),
  ('profile-effect-03','profile-effects','Velvet Glow','Profile effects',ARRAY[]::text[],3,true),
  ('profile-effect-04','profile-effects','Electric Drift','Profile effects',ARRAY[]::text[],4,true),
  ('profile-effect-05','profile-effects','Starlight Trail','Profile effects',ARRAY[]::text[],5,true),
  ('profile-effect-06','profile-effects','Neon Ripple','Profile effects',ARRAY[]::text[],6,true),
  ('profile-effect-07','profile-effects','Cosmic Haze','Profile effects',ARRAY[]::text[],7,true),
  ('profile-effect-08','profile-effects','Prism Motion','Profile effects',ARRAY[]::text[],8,true),
  ('profile-effect-09','profile-effects','Blue Ember','Profile effects',ARRAY[]::text[],9,true),
  ('profile-effect-10','profile-effects','Lavender Mist','Profile effects',ARRAY[]::text[],10,true),
  ('profile-effect-11','profile-effects','Solar Dust','Profile effects',ARRAY[]::text[],11,true),
  ('profile-effect-12','profile-effects','Afterglow','Profile effects',ARRAY[]::text[],12,true),
  ('profile-effect-13','profile-effects','Dreamwave','Profile effects',ARRAY[]::text[],13,true),
  ('profile-effect-14','profile-effects','Arctic Shimmer','Profile effects',ARRAY[]::text[],14,true),
  ('profile-effect-15','profile-effects','Violet Current','Profile effects',ARRAY[]::text[],15,true),
  ('profile-effect-16','profile-effects','Pixel Bloom','Profile effects',ARRAY[]::text[],16,true),
  ('profile-effect-17','profile-effects','Moonbeam','Profile effects',ARRAY[]::text[],17,true),
  ('profile-effect-18','profile-effects','Rose Flare','Profile effects',ARRAY[]::text[],18,true),
  ('profile-effect-19','profile-effects','Nightfall','Profile effects',ARRAY[]::text[],19,true),
  ('profile-effect-20','profile-effects','Spectrum Flow','Profile effects',ARRAY[]::text[],20,true),
  ('profile-frame-01','profile-frames','Obsidian Edge','Profile frames',ARRAY[]::text[],1,true),
  ('profile-frame-02','profile-frames','Iris Doubleline','Profile frames',ARRAY[]::text[],2,true),
  ('profile-frame-03','profile-frames','Celestial Brass','Profile frames',ARRAY[]::text[],3,true),
  ('profile-frame-04','profile-frames','Frostglass','Profile frames',ARRAY[]::text[],4,true),
  ('profile-frame-05','profile-frames','Prism Cut','Profile frames',ARRAY[]::text[],5,true),
  ('profile-frame-06','profile-frames','Satin Violet','Profile frames',ARRAY[]::text[],6,true),
  ('profile-frame-07','profile-frames','Carbon Weave','Profile frames',ARRAY[]::text[],7,true),
  ('profile-frame-08','profile-frames','Aurora Border','Profile frames',ARRAY[]::text[],8,true),
  ('profile-frame-09','profile-frames','Rose Alloy','Profile frames',ARRAY[]::text[],9,true),
  ('profile-frame-10','profile-frames','Midnight Filigree','Profile frames',ARRAY[]::text[],10,true),
  ('profile-frame-11','profile-frames','Holo Circuit','Profile frames',ARRAY[]::text[],11,true),
  ('profile-frame-12','profile-frames','Silver Thread','Profile frames',ARRAY[]::text[],12,true),
  ('profile-frame-13','profile-frames','Amethyst Arc','Profile frames',ARRAY[]::text[],13,true),
  ('profile-frame-14','profile-frames','Cloudglass','Profile frames',ARRAY[]::text[],14,true),
  ('profile-frame-15','profile-frames','Solar Etch','Profile frames',ARRAY[]::text[],15,true),
  ('profile-frame-16','profile-frames','Oceanic Line','Profile frames',ARRAY[]::text[],16,true),
  ('profile-frame-17','profile-frames','Starlit Corners','Profile frames',ARRAY[]::text[],17,true),
  ('profile-frame-18','profile-frames','Retro Pixel','Profile frames',ARRAY[]::text[],18,true),
  ('profile-frame-19','profile-frames','Lunar Chrome','Profile frames',ARRAY[]::text[],19,true),
  ('profile-frame-20','profile-frames','Velvet Trim','Profile frames',ARRAY[]::text[],20,true),
  ('nameplate-01','nameplates','Night Arcade','Nameplates',ARRAY[]::text[],1,true),
  ('nameplate-02','nameplates','Violet Script','Nameplates',ARRAY[]::text[],2,true),
  ('nameplate-03','nameplates','Cloud Label','Nameplates',ARRAY[]::text[],3,true),
  ('nameplate-04','nameplates','Pixel Tag','Nameplates',ARRAY[]::text[],4,true),
  ('nameplate-05','nameplates','Moonstone','Nameplates',ARRAY[]::text[],5,true),
  ('nameplate-06','nameplates','Solar Type','Nameplates',ARRAY[]::text[],6,true),
  ('nameplate-07','nameplates','Holo Label','Nameplates',ARRAY[]::text[],7,true),
  ('nameplate-08','nameplates','Rose Ink','Nameplates',ARRAY[]::text[],8,true),
  ('nameplate-09','nameplates','Deep Space','Nameplates',ARRAY[]::text[],9,true),
  ('nameplate-10','nameplates','Iris Plate','Nameplates',ARRAY[]::text[],10,true),
  ('nameplate-11','nameplates','Frost Type','Nameplates',ARRAY[]::text[],11,true),
  ('nameplate-12','nameplates','Golden Signal','Nameplates',ARRAY[]::text[],12,true),
  ('nameplate-13','nameplates','Soft Static','Nameplates',ARRAY[]::text[],13,true),
  ('nameplate-14','nameplates','Prism Label','Nameplates',ARRAY[]::text[],14,true),
  ('nameplate-15','nameplates','Velvet Tag','Nameplates',ARRAY[]::text[],15,true),
  ('nameplate-16','nameplates','Orbit Type','Nameplates',ARRAY[]::text[],16,true),
  ('nameplate-17','nameplates','Aurora Name','Nameplates',ARRAY[]::text[],17,true),
  ('nameplate-18','nameplates','Chrome Mark','Nameplates',ARRAY[]::text[],18,true),
  ('nameplate-19','nameplates','Dream Label','Nameplates',ARRAY[]::text[],19,true),
  ('nameplate-20','nameplates','After Hours','Nameplates',ARRAY[]::text[],20,true),
  ('bundle-01','bundles','Midnight Bloom Set','Bundles',ARRAY['avatar-decoration-01', 'profile-effect-01', 'profile-frame-01', 'nameplate-01']::text[],1,true),
  ('bundle-02','bundles','Cosmic Voyager Set','Bundles',ARRAY['avatar-decoration-02', 'profile-effect-02', 'profile-frame-02', 'nameplate-02']::text[],2,true),
  ('bundle-03','bundles','Lavender Dream Set','Bundles',ARRAY['avatar-decoration-03', 'profile-effect-03', 'profile-frame-03', 'nameplate-03']::text[],3,true),
  ('bundle-04','bundles','Neon Arcade Set','Bundles',ARRAY['avatar-decoration-04', 'profile-effect-04', 'profile-frame-04', 'nameplate-04']::text[],4,true),
  ('bundle-05','bundles','Aurora Explorer Set','Bundles',ARRAY['avatar-decoration-05', 'profile-effect-05', 'profile-frame-05', 'nameplate-05']::text[],5,true),
  ('bundle-06','bundles','Rose Quartz Set','Bundles',ARRAY['avatar-decoration-06', 'profile-effect-06', 'profile-frame-06', 'nameplate-06']::text[],6,true),
  ('bundle-07','bundles','Frostfire Set','Bundles',ARRAY['avatar-decoration-07', 'profile-effect-07', 'profile-frame-07', 'nameplate-07']::text[],7,true),
  ('bundle-08','bundles','Solar Drift Set','Bundles',ARRAY['avatar-decoration-08', 'profile-effect-08', 'profile-frame-08', 'nameplate-08']::text[],8,true),
  ('bundle-09','bundles','Obsidian Luxe Set','Bundles',ARRAY['avatar-decoration-09', 'profile-effect-09', 'profile-frame-09', 'nameplate-09']::text[],9,true),
  ('bundle-10','bundles','Cloud Nine Set','Bundles',ARRAY['avatar-decoration-10', 'profile-effect-10', 'profile-frame-10', 'nameplate-10']::text[],10,true),
  ('bundle-11','bundles','Prism Party Set','Bundles',ARRAY['avatar-decoration-11', 'profile-effect-11', 'profile-frame-11', 'nameplate-11']::text[],11,true),
  ('bundle-12','bundles','Moonlit Garden Set','Bundles',ARRAY['avatar-decoration-12', 'profile-effect-12', 'profile-frame-12', 'nameplate-12']::text[],12,true),
  ('bundle-13','bundles','Pixel Galaxy Set','Bundles',ARRAY['avatar-decoration-13', 'profile-effect-13', 'profile-frame-13', 'nameplate-13']::text[],13,true),
  ('bundle-14','bundles','Velvet Night Set','Bundles',ARRAY['avatar-decoration-14', 'profile-effect-14', 'profile-frame-14', 'nameplate-14']::text[],14,true),
  ('bundle-15','bundles','Ocean Glow Set','Bundles',ARRAY['avatar-decoration-15', 'profile-effect-15', 'profile-frame-15', 'nameplate-15']::text[],15,true),
  ('bundle-16','bundles','Starlight Atelier Set','Bundles',ARRAY['avatar-decoration-16', 'profile-effect-16', 'profile-frame-16', 'nameplate-16']::text[],16,true),
  ('bundle-17','bundles','Golden Eclipse Set','Bundles',ARRAY['avatar-decoration-17', 'profile-effect-17', 'profile-frame-17', 'nameplate-17']::text[],17,true),
  ('bundle-18','bundles','Iris Spectrum Set','Bundles',ARRAY['avatar-decoration-18', 'profile-effect-18', 'profile-frame-18', 'nameplate-18']::text[],18,true),
  ('bundle-19','bundles','Dreamwave Set','Bundles',ARRAY['avatar-decoration-19', 'profile-effect-19', 'profile-frame-19', 'nameplate-19']::text[],19,true),
  ('bundle-20','bundles','Afterglow Set','Bundles',ARRAY['avatar-decoration-20', 'profile-effect-20', 'profile-frame-20', 'nameplate-20']::text[],20,true)
on conflict (id) do update set category=excluded.category,name=excluded.name,description=excluded.description,bundle_items=excluded.bundle_items,sort_order=excluded.sort_order,is_free=excluded.is_free;

create table if not exists public.user_cosmetic_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null references public.cosmetic_catalog(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);
alter table public.user_cosmetic_inventory enable row level security;
revoke all on public.user_cosmetic_inventory from anon, authenticated;
grant select, insert on public.user_cosmetic_inventory to authenticated;
drop policy if exists cosmetic_inventory_select_own on public.user_cosmetic_inventory;
create policy cosmetic_inventory_select_own on public.user_cosmetic_inventory for select to authenticated
using (user_id=(select auth.uid()) and coalesce((((select auth.jwt())->>'is_anonymous')::boolean),false)=false);
drop policy if exists cosmetic_inventory_insert_own on public.user_cosmetic_inventory;
create policy cosmetic_inventory_insert_own on public.user_cosmetic_inventory for insert to authenticated
with check (user_id=(select auth.uid()) and coalesce((((select auth.jwt())->>'is_anonymous')::boolean),false)=false
  and exists(select 1 from public.cosmetic_catalog c where c.id=cosmetic_id and c.is_free=true));

create table if not exists public.user_cosmetic_equipment (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('avatar-decorations','profile-effects','profile-frames','nameplates')),
  cosmetic_id text not null,
  equipped_at timestamptz not null default now(),
  primary key (user_id, slot),
  foreign key (cosmetic_id,slot) references public.cosmetic_catalog(id,category) on delete cascade
);
alter table public.user_cosmetic_equipment enable row level security;
revoke all on public.user_cosmetic_equipment from anon, authenticated;
grant select, insert, update, delete on public.user_cosmetic_equipment to authenticated;
drop policy if exists cosmetic_equipment_read on public.user_cosmetic_equipment;
create policy cosmetic_equipment_read on public.user_cosmetic_equipment for select to authenticated using (true);
drop policy if exists cosmetic_equipment_insert_own on public.user_cosmetic_equipment;
create policy cosmetic_equipment_insert_own on public.user_cosmetic_equipment for insert to authenticated
with check (user_id=(select auth.uid()) and coalesce((((select auth.jwt())->>'is_anonymous')::boolean),false)=false
  and exists(select 1 from public.user_cosmetic_inventory i where i.user_id=(select auth.uid()) and i.cosmetic_id=user_cosmetic_equipment.cosmetic_id));
drop policy if exists cosmetic_equipment_update_own on public.user_cosmetic_equipment;
create policy cosmetic_equipment_update_own on public.user_cosmetic_equipment for update to authenticated
using (user_id=(select auth.uid()) and coalesce((((select auth.jwt())->>'is_anonymous')::boolean),false)=false)
with check (user_id=(select auth.uid()) and coalesce((((select auth.jwt())->>'is_anonymous')::boolean),false)=false
  and exists(select 1 from public.user_cosmetic_inventory i where i.user_id=(select auth.uid()) and i.cosmetic_id=user_cosmetic_equipment.cosmetic_id));
drop policy if exists cosmetic_equipment_delete_own on public.user_cosmetic_equipment;
create policy cosmetic_equipment_delete_own on public.user_cosmetic_equipment for delete to authenticated
using (user_id=(select auth.uid()) and coalesce((((select auth.jwt())->>'is_anonymous')::boolean),false)=false);

-- Bundle rows point to the four matching component cosmetics in bundle_items.
-- The client inserts the bundle and its four component IDs as one ownership action.
