-- Calendário Editorial Mentorei: ligação com o Instagram (números automáticos no check-in e nos posts).
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run (com nada selecionado).

-- Chave de acesso do Instagram (uma linha só). Vale 60 dias e o calendário renova sozinho.
-- Só admin e criativa enxergam; a sócia não.
create table if not exists public.cal_instagram (
  id integer primary key default 1 check (id = 1),
  token text not null,
  usuario text not null default '',
  expira_em timestamptz,
  renovado_em timestamptz not null default now(),
  sincronizado_em timestamptz,
  erro text not null default '',
  conectado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists cal_instagram_tocar on public.cal_instagram;
create trigger cal_instagram_tocar before update on public.cal_instagram
  for each row execute function public.cal_tocar();

alter table public.cal_instagram enable row level security;
grant select, insert, update, delete on public.cal_instagram to authenticated;

drop policy if exists cal_instagram_equipe on public.cal_instagram;
create policy cal_instagram_equipe on public.cal_instagram for all to authenticated
  using (public.cal_papel() in ('admin', 'criativa'))
  with check (public.cal_papel() in ('admin', 'criativa'));

-- Cada post do calendário ligado ao post de verdade no Instagram, com os números dele:
-- ig_numeros = { alcance, visualizacoes, curtidas, comentarios, salvamentos, compartilhamentos, interacoes, lido_em }
alter table public.cal_posts add column if not exists ig_id text;
alter table public.cal_posts add column if not exists ig_numeros jsonb;
create unique index if not exists cal_posts_ig_id_unico on public.cal_posts (ig_id) where ig_id is not null;

-- Números extras da semana que vieram do Instagram (visualizações, interações, novos seguidores...)
alter table public.cal_checkins add column if not exists ig_numeros jsonb;

notify pgrst, 'reload schema';
