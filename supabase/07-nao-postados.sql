-- Calendário Editorial Mentorei: posts que a criativa decidiu NÃO postar, com o motivo (relatório "Não postados").
-- Rodar uma vez no Supabase: SQL Editor → colar tudo → Run (com nada selecionado).

-- Nova situação do post: "não postado".
alter table public.cal_posts drop constraint if exists cal_posts_status_check;
alter table public.cal_posts add constraint cal_posts_status_check
  check (status in ('producao', 'pronto', 'postado', 'nao_postado'));

-- Por que não foi postado: nao_postado = { motivo, detalhe, marcado_em, marcado_por }
-- motivo = momento | problema | aprovacao | repetido | trocado | tempo | outro (os textos ficam no site, em util.js)
alter table public.cal_posts add column if not exists nao_postado jsonb;

notify pgrst, 'reload schema';
