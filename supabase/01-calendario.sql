-- Calendário Editorial Mentorei: tabelas, permissões e pasta de arquivos (Fase 1).
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run.
-- Usa o mesmo projeto do Radar, mas só cria coisas com o prefixo "cal_". Não mexe nas tabelas do Radar.

-- ---------- quem pode entrar ----------
-- Cada pessoa com login tem um perfil: admin (Juliana), criativa ou socia.
create table if not exists public.cal_perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  papel text not null check (papel in ('admin', 'criativa', 'socia')),
  criado_em timestamptz not null default now()
);

-- Papel de quem está usando o site agora (null = não tem acesso ao calendário).
create or replace function public.cal_papel()
returns text
language sql stable security definer
set search_path = public
as $$
  select papel from public.cal_perfis where id = auth.uid()
$$;

-- ---------- posts ----------
-- data/hora vazias = post na "caixa de entrada" (ex.: vídeo enviado por uma sócia, ainda sem dia marcado).
create table if not exists public.cal_posts (
  id uuid primary key default gen_random_uuid(),
  data date,
  hora time,
  formato text not null default 'estatico'
    check (formato in ('reels', 'carrossel', 'estatico', 'stories')),
  tema text not null default '',
  legenda text not null default '',
  hashtags text not null default '',
  observacoes text not null default '',
  status text not null default 'producao'
    check (status in ('producao', 'pronto', 'postado')),
  origem text not null default 'manual'
    check (origem in ('claude', 'socia', 'manual')),
  autor_id uuid references auth.users (id) on delete set null,
  enviado_por text not null default '',   -- nome digitado por quem enviou (útil quando a equipe usa um login só)
  link_post text,
  postado_em timestamptz,
  postado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Anúncios (posts patrocinados) ficam na mesma tabela, separados pelo tipo, e não aparecem no calendário de posts.
-- anuncio = { campanha, objetivo, situacao (rascunho | no_ar | pausado | encerrado), inicio, fim, verba_dia,
--             publico, titulo, descricao, botao, link, resultados: [{ data, gasto, alcance, cliques, vendas }] }
-- (o texto principal do anúncio usa a coluna legenda)
alter table public.cal_posts add column if not exists tipo text not null default 'organico'
  check (tipo in ('organico', 'anuncio'));
alter table public.cal_posts add column if not exists anuncio jsonb not null default '{}'::jsonb;

create index if not exists cal_posts_data_idx on public.cal_posts (data, hora);
create index if not exists cal_posts_tipo_idx on public.cal_posts (tipo);
create index if not exists cal_posts_autor_idx on public.cal_posts (autor_id);

-- ---------- artes e vídeos de cada post ----------
create table if not exists public.cal_midias (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.cal_posts (id) on delete cascade,
  caminho text not null,              -- caminho do arquivo na pasta "calendario" do Storage
  nome text not null,                 -- nome original do arquivo
  tipo text not null,                 -- image/png, video/mp4...
  tamanho bigint,
  ordem integer not null default 0,   -- ordem das lâminas do carrossel
  criado_em timestamptz not null default now()
);

create index if not exists cal_midias_post_idx on public.cal_midias (post_id, ordem);

-- ---------- check-in semanal ----------
-- semana = segunda-feira da semana a que os números se referem.
create table if not exists public.cal_checkins (
  id uuid primary key default gen_random_uuid(),
  semana date not null unique,
  seguidores integer,
  alcance integer,
  visitas_perfil integer,
  melhor_post_id uuid references public.cal_posts (id) on delete set null,
  melhor_post_motivo text not null default '',
  aprendizado text not null default '',
  preenchido_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- atualizado_em automático ----------
create or replace function public.cal_tocar()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists cal_posts_tocar on public.cal_posts;
create trigger cal_posts_tocar before update on public.cal_posts
  for each row execute function public.cal_tocar();

drop trigger if exists cal_checkins_tocar on public.cal_checkins;
create trigger cal_checkins_tocar before update on public.cal_checkins
  for each row execute function public.cal_tocar();

-- ---------- permissões ----------
alter table public.cal_perfis enable row level security;
alter table public.cal_posts enable row level security;
alter table public.cal_midias enable row level security;
alter table public.cal_checkins enable row level security;

revoke all on public.cal_perfis, public.cal_posts, public.cal_midias, public.cal_checkins from anon;
grant select on public.cal_perfis to authenticated;
grant select, insert, update, delete on public.cal_posts, public.cal_midias to authenticated;
grant select, insert, update on public.cal_checkins to authenticated;

-- Perfis: todo mundo da equipe vê os nomes. Cadastro só pelo servidor (chave secreta).
drop policy if exists cal_perfis_ler on public.cal_perfis;
create policy cal_perfis_ler on public.cal_perfis for select to authenticated
  using (public.cal_papel() is not null);

-- Posts: a equipe toda vê. Juliana e criativa criam e editam tudo.
-- Sócias criam os próprios envios e mexem neles enquanto não foram postados. Só Juliana exclui posts dos outros.
drop policy if exists cal_posts_ler on public.cal_posts;
create policy cal_posts_ler on public.cal_posts for select to authenticated
  using (public.cal_papel() is not null);

drop policy if exists cal_posts_criar on public.cal_posts;
create policy cal_posts_criar on public.cal_posts for insert to authenticated
  with check (
    public.cal_papel() in ('admin', 'criativa')
    or (public.cal_papel() = 'socia' and origem = 'socia' and autor_id = auth.uid() and status <> 'postado')
  );

drop policy if exists cal_posts_editar on public.cal_posts;
create policy cal_posts_editar on public.cal_posts for update to authenticated
  using (
    public.cal_papel() in ('admin', 'criativa')
    or (public.cal_papel() = 'socia' and autor_id = auth.uid() and status <> 'postado')
  )
  with check (
    public.cal_papel() in ('admin', 'criativa')
    or (public.cal_papel() = 'socia' and autor_id = auth.uid() and origem = 'socia' and status <> 'postado')
  );

drop policy if exists cal_posts_excluir on public.cal_posts;
create policy cal_posts_excluir on public.cal_posts for delete to authenticated
  using (
    public.cal_papel() = 'admin'
    or (public.cal_papel() = 'socia' and autor_id = auth.uid() and status <> 'postado')
  );

-- Mídias seguem as regras do post a que pertencem.
drop policy if exists cal_midias_ler on public.cal_midias;
create policy cal_midias_ler on public.cal_midias for select to authenticated
  using (public.cal_papel() is not null);

drop policy if exists cal_midias_gravar on public.cal_midias;
create policy cal_midias_gravar on public.cal_midias for all to authenticated
  using (
    public.cal_papel() in ('admin', 'criativa')
    or exists (select 1 from public.cal_posts p
               where p.id = post_id and p.autor_id = auth.uid() and p.status <> 'postado')
  )
  with check (
    public.cal_papel() in ('admin', 'criativa')
    or exists (select 1 from public.cal_posts p
               where p.id = post_id and p.autor_id = auth.uid() and p.status <> 'postado')
  );

-- Check-in: a equipe vê; Juliana e criativa preenchem.
drop policy if exists cal_checkins_ler on public.cal_checkins;
create policy cal_checkins_ler on public.cal_checkins for select to authenticated
  using (public.cal_papel() is not null);

drop policy if exists cal_checkins_gravar on public.cal_checkins;
create policy cal_checkins_gravar on public.cal_checkins for insert to authenticated
  with check (public.cal_papel() in ('admin', 'criativa'));

drop policy if exists cal_checkins_editar on public.cal_checkins;
create policy cal_checkins_editar on public.cal_checkins for update to authenticated
  using (public.cal_papel() in ('admin', 'criativa'))
  with check (public.cal_papel() in ('admin', 'criativa'));

-- ---------- pasta de arquivos (Storage) ----------
-- Privada: os arquivos só abrem por links temporários gerados para quem está logado.
-- 50 MB por arquivo é o máximo do plano grátis do Supabase.
insert into storage.buckets (id, name, public, file_size_limit)
values ('calendario', 'calendario', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists cal_arquivos_ler on storage.objects;
create policy cal_arquivos_ler on storage.objects for select to authenticated
  using (bucket_id = 'calendario' and public.cal_papel() is not null);

drop policy if exists cal_arquivos_enviar on storage.objects;
create policy cal_arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'calendario' and public.cal_papel() is not null);

drop policy if exists cal_arquivos_apagar on storage.objects;
create policy cal_arquivos_apagar on storage.objects for delete to authenticated
  using (
    bucket_id = 'calendario'
    and (public.cal_papel() in ('admin', 'criativa') or owner_id = auth.uid()::text)
  );
