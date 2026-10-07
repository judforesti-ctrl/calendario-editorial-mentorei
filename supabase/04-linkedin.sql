-- Calendário Editorial Mentorei: espaço do LinkedIn (página da Mentorei).
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run (com nada selecionado).

-- Cada post diz em que rede sai. Os que já existem continuam sendo do Instagram.
alter table public.cal_posts add column if not exists rede text not null default 'instagram'
  check (rede in ('instagram', 'linkedin'));
create index if not exists cal_posts_rede_idx on public.cal_posts (rede, data);

-- Formatos do LinkedIn: só texto, vídeo e artigo (imagem e carrossel já existiam).
alter table public.cal_posts drop constraint if exists cal_posts_formato_check;
alter table public.cal_posts add constraint cal_posts_formato_check
  check (formato in ('reels', 'carrossel', 'estatico', 'stories', 'texto', 'video', 'artigo'));

-- Check-in semanal do LinkedIn (números da página da Mentorei).
create table if not exists public.cal_checkins_linkedin (
  id uuid primary key default gen_random_uuid(),
  semana date not null unique,          -- segunda-feira da semana a que os números se referem
  seguidores integer,
  impressoes integer,
  reacoes integer,
  comentarios integer,
  compartilhamentos integer,
  visitas_pagina integer,
  melhor_post_id uuid references public.cal_posts (id) on delete set null,
  melhor_post_motivo text not null default '',
  aprendizado text not null default '',
  preenchido_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists cal_checkins_linkedin_tocar on public.cal_checkins_linkedin;
create trigger cal_checkins_linkedin_tocar before update on public.cal_checkins_linkedin
  for each row execute function public.cal_tocar();

alter table public.cal_checkins_linkedin enable row level security;
revoke all on public.cal_checkins_linkedin from anon;
grant select, insert, update on public.cal_checkins_linkedin to authenticated;

drop policy if exists cal_checkins_linkedin_ler on public.cal_checkins_linkedin;
create policy cal_checkins_linkedin_ler on public.cal_checkins_linkedin for select to authenticated
  using (public.cal_papel() is not null);

drop policy if exists cal_checkins_linkedin_gravar on public.cal_checkins_linkedin;
create policy cal_checkins_linkedin_gravar on public.cal_checkins_linkedin for insert to authenticated
  with check (public.cal_papel() in ('admin', 'criativa'));

drop policy if exists cal_checkins_linkedin_editar on public.cal_checkins_linkedin;
create policy cal_checkins_linkedin_editar on public.cal_checkins_linkedin for update to authenticated
  using (public.cal_papel() in ('admin', 'criativa'))
  with check (public.cal_papel() in ('admin', 'criativa'));

notify pgrst, 'reload schema';
