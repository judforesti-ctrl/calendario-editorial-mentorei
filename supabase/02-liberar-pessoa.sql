-- Liberar uma pessoa no calendário.
-- 1) Supabase → Authentication → Users → "Add user" → "Create new user":
--    e-mail da pessoa + uma senha provisória + marque "Auto Confirm User".
-- 2) Troque o e-mail, o nome e o papel abaixo e rode aqui no SQL Editor.
--    Papéis: 'admin' (Juliana), 'criativa' ou 'socia'.
-- 3) Mande para a pessoa o endereço calendario.mentorei.com.br e a senha provisória.
--    Ela entra e troca em "Trocar senha", no topo do calendário.

insert into public.cal_perfis (id, nome, papel)
select id, 'Equipe Mentorei', 'admin'
from auth.users
where email = 'EMAIL-DO-LOGIN-DA-EQUIPE'
on conflict (id) do update set nome = excluded.nome, papel = excluded.papel;

-- Conferir quem tem acesso:
-- select p.nome, p.papel, u.email from public.cal_perfis p join auth.users u on u.id = p.id order by p.papel;

-- Tirar o acesso de alguém (o login continua existindo, mas o calendário fica bloqueado):
-- delete from public.cal_perfis where id = (select id from auth.users where email = 'email.da.pessoa@exemplo.com');
