-- Calendário Editorial Mentorei: espaço da Mala direta (e-mails para clientes, disparados pelo RD Station).
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run (com nada selecionado).

-- Cada post diz onde sai: Instagram, LinkedIn ou e-mail (mala direta).
alter table public.cal_posts drop constraint if exists cal_posts_rede_check;
alter table public.cal_posts add constraint cal_posts_rede_check
  check (rede in ('instagram', 'linkedin', 'email'));

-- Formatos da mala direta: e-mail montado com a arte (imagem) ou com o HTML pronto ("texto" já existia).
alter table public.cal_posts drop constraint if exists cal_posts_formato_check;
alter table public.cal_posts add constraint cal_posts_formato_check
  check (formato in ('reels', 'carrossel', 'estatico', 'stories', 'texto', 'video', 'artigo', 'email', 'html'));

-- Dados do e-mail e números do relatório do RD Station:
-- email = { assunto, preheader, publico, link, alt, resultados: { entregues, aberturas, cliques, descadastros } }
alter table public.cal_posts add column if not exists email jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
