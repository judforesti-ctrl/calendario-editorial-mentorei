# Calendário Editorial — Mentorei

Endereço: https://calendario.mentorei.com.br (depois de publicado)

## Para que serve

- **Criativa:** vê o que postar hoje e na semana, baixa as artes, copia a legenda e as hashtags, marca como postado e faz o check-in semanal.
- **Sócias:** enviam vídeos pela aba "Enviar vídeo" e acompanham em "Meus envios".
- **Juliana (admin):** vê tudo, cria, edita e exclui posts.
- **Claude:** salva as artes criadas no chat direto no calendário com `ferramentas/salvar-post.ps1`.

## Onde está cada coisa

| Arquivo | O que é |
|---|---|
| `public/index.html` | A página do calendário (login + todas as telas) |
| `public/assets/js/config.js` | Endereço e chave publicável do Supabase, horários padrão de postagem, limite de arquivo |
| `public/assets/js/app.js` | Telas: Hoje, Semana, Mês, Caixa de entrada, Enviar vídeo, Meus envios, Check-in, Evolução |
| `public/assets/js/api-supabase.js` | Conversa com o Supabase (login, posts, arquivos, check-ins) |
| `public/assets/js/api-demo.js` | Modo demonstração, com dados de exemplo (abre sozinho enquanto não houver chave) |
| `public/assets/js/graficos.js` | Gráficos da aba Evolução |
| `supabase/01-calendario.sql` | Cria as tabelas, as permissões e a pasta de arquivos (rodar uma vez) |
| `supabase/02-liberar-pessoa.sql` | Modelo para liberar o acesso de cada pessoa |
| `supabase/05-mala-direta.sql` | Liga a aba Mala direta (e-mails para clientes pelo RD Station) |
| `ferramentas/salvar-post.ps1` | Salva um post com artes no calendário (usado pelo Claude) |
| `ferramentas/servidor-local.ps1` | Abre o calendário no computador, em http://localhost:8787 |

Abrir `index.html?demo` mostra a demonstração mesmo com o Supabase ligado.

## Como colocar no ar (uma vez só)

1. **Supabase** (o mesmo projeto do Radar): SQL Editor → colar `supabase/01-calendario.sql` → Run.
2. **Chave publicável:** Supabase → Project Settings → API Keys → copiar a *Publishable key* (`sb_publishable_...`)
   e colar no campo `supabaseChave` de `public/assets/js/config.js`. Essa chave pode ficar no site.
3. **Endereço de volta do login:** Supabase → Authentication → URL Configuration → Redirect URLs →
   adicionar `https://calendario.mentorei.com.br/**`.
4. **GitHub:** criar um repositório novo (ex.: `calendario-editorial-mentorei`) e enviar esta pasta.
5. **Netlify:** Add new site → Import from GitHub → escolher o repositório. A pasta publicada (`public`) já está no `netlify.toml`.
6. **Domínio:** Netlify → Domain management → Add domain → `calendario.mentorei.com.br`.
   Na **Hostinger** → Domínios → mentorei.com.br → DNS → novo registro **CNAME**: nome `calendario`, aponta para `NOME-DO-SITE.netlify.app`.
   O Netlify cria o certificado (https) sozinho em alguns minutos.
7. **Pessoas:** para cada uma, seguir `supabase/02-liberar-pessoa.sql`.
8. **Ferramenta do Claude:** copiar `.env.exemplo` para `.env` e colar a chave secreta do Supabase.

## Limites do plano grátis do Supabase

- **50 MB por arquivo.** Vídeo maior precisa ser comprimido antes (o site avisa).
- **1 GB no total** para artes e vídeos. Com 15 a 20 posts por semana, as imagens cabem por meses; vídeos enchem mais rápido.
  Próximo passo previsto: apagar sozinho os arquivos de posts publicados há mais de 30 dias (o post e a legenda continuam no histórico).

## Status de um post

`producao` (em produção) → `pronto` (pronto para postar) → `postado`.
Post sem dia ou sem horário aparece na **Caixa de entrada**.

## Como alimentar o calendário

1. **Pelo Claude (o mais fácil):** peça no chat, por exemplo "salva este carrossel para quinta às 9h".
   Para várias artes de uma vez: as artes ficam em `artes-recebidas/` (uma pasta por post, com `legenda.txt`),
   a lista com dia e horário fica em `fila/fila.json`, e o Claude envia tudo com `ferramentas/enviar-fila.ps1`.
   Cada post enviado é anotado em `fila/enviados.txt` e nunca é enviado duas vezes.
2. **Pelo calendário:** botão "+ Novo post" (ou clicar num "Horário livre").
3. **Sócias:** aba "Enviar vídeo". Os vídeos chegam na Caixa de entrada.

Para ver a fila no calendário antes de enviar: `ferramentas/enviar-fila.ps1 -Previa` e abrir o servidor local.
