-- Calendário Editorial Mentorei: posts fixados no feed e destaques dos stories.
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run (com nada selecionado).

-- Post fixado no topo do perfil (aparece primeiro na simulação do feed).
alter table public.cal_posts add column if not exists fixado boolean not null default false;

-- Destaques do perfil (as bolinhas abaixo da bio). Cada destaque junta stories já publicados.
create table if not exists public.cal_destaques (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  capa text,                         -- caminho da imagem de capa na pasta "calendario" do Storage
  ordem integer not null default 0,  -- ordem das bolinhas no perfil
  criado_em timestamptz not null default now()
);

-- Story que vai para um destaque: primeiro é postado nos stories, depois adicionado ao destaque.
alter table public.cal_posts add column if not exists destaque_id uuid references public.cal_destaques (id) on delete set null;
alter table public.cal_posts add column if not exists no_destaque boolean not null default false;
create index if not exists cal_posts_destaque_idx on public.cal_posts (destaque_id);

-- Permissões: a equipe vê; Juliana e criativa criam e editam.
alter table public.cal_destaques enable row level security;
revoke all on public.cal_destaques from anon;
grant select, insert, update, delete on public.cal_destaques to authenticated;

drop policy if exists cal_destaques_ler on public.cal_destaques;
create policy cal_destaques_ler on public.cal_destaques for select to authenticated
  using (public.cal_papel() is not null);

drop policy if exists cal_destaques_gravar on public.cal_destaques;
create policy cal_destaques_gravar on public.cal_destaques for all to authenticated
  using (public.cal_papel() in ('admin', 'criativa'))
  with check (public.cal_papel() in ('admin', 'criativa'));

notify pgrst, 'reload schema';
