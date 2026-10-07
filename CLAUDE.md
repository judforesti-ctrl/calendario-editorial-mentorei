# Calendário Editorial Mentorei — instruções para o Claude

Site no ar: https://calendario.mentorei.com.br (Netlify, projeto "calendario-mentorei", publica sozinho a cada push no `main`
de github.com/judforesti-ctrl/calendario-editorial-mentorei). Dados no Supabase do Radar (tabelas `cal_*`, pasta `calendario`).

## Quem pede
A Juliana (sócia da Mentorei) é leiga em tecnologia: responda em português, passo a passo, sem jargão, um clique por passo.
A "criativa" é quem posta no Instagram (nunca chamar de "secretária"). Logins: calendario@mentorei.com.br (equipe, admin).
Não mexer no login contato@mentorei.com.br (é de outro sistema).

## Como colocar posts no calendário
1. Guardar as artes em `artes-recebidas/<grupo>/<post>/` com nomes curtos e na ordem (01.png, 02.png...; reels: 01.mp4 + capa-reels.png).
2. Escrever `legenda.txt` na mesma pasta (a última linha só com hashtags vira o campo de hashtags).
   Para legenda nova, seguir o tom da Mentorei: gancho na 1ª linha, frases curtas, prático, sem prometer promoção/aumento.
3. Acrescentar o post em `fila/fila.json` (data, hora, formato, tema, pasta, observacoes). Sem data = Caixa de entrada.
   Anúncio: `"tipo": "anuncio"` + objeto `anuncio` (campanha, objetivo, situacao, inicio, fim, verba_dia, publico, titulo, descricao, botao, link, resultados []).
4. Conferir na prévia: `ferramentas/enviar-fila.ps1 -Previa` e servidor local (`ferramentas/servidor-local.ps1 -Porta 8790`, demo em http://localhost:8790/?demo).
5. Enviar: `powershell -ExecutionPolicy Bypass -File ferramentas\enviar-fila.ps1` (só envia o que não está em `fila/enviados.txt`).
   Um post avulso: `ferramentas\salvar-post.ps1` (ver exemplo no topo do arquivo).

## Para mudar um post que já está no ar
Usar a API REST do Supabase com a chave secreta do `.env` (nunca mostrar a chave; sempre com `-UserAgent 'calendario-mentorei-ferramenta/1.0'`,
porque o Supabase recusa a chave secreta quando o pedido parece vir de navegador). Ou orientar a Juliana a usar "Editar" no próprio site.

## Regras de conteúdo
- Radar da Liderança: chamar de "diagnóstico" (nunca "teste"), R$ 14,99, laudo no e-mail; sem depoimentos inventados; sem prometer promoção.
- Não destacar tempo de cooperativismo das sócias (a Juliana tem 8 anos; Claudia e Viviane, mais de 18).
- Horários padrão: seg a sex 12h30 e 19h (série "Líder maduro" às quintas 9h); sábado 10h. Espalhar temas parecidos.
- Destaques: o Instagram não fixa destaque; o que recebe story novo vai para o 1º lugar. Para manter o "Boas-vindas" na frente,
  o 1º post do feed de cada dia (12h30; sábado 10h) leva no recado a instrução "📌 REPOST PARA O BOAS-VINDAS" (compartilhar
  nos stories, adicionar ao Boas-vindas e tirar o repost do dia anterior). Já está nos posts até 05/11; incluir nos novos.
- Pasta oficial das artes da Juliana: `Documents\JULIANA PROFISSIONAL\Mentorei marca\postagens` (editar lá quando ela pedir; backup em `_versoes-antigas`).

## Limites
Supabase grátis: 50 MB por arquivo, 1 GB no total. O upload desta internet é lento (~2 MB/min): avisar quanto vai demorar.

## Pasta de arquivos (aba Arquivos)
Fotos e vídeos soltos da equipe ficam no Storage em `arquivos/<pasta>/` (sem tabela; pasta vazia guarda `.pasta`).
O app instalado no Android recebe arquivos pelo menu Compartilhar (manifest.webmanifest share_target + sw.js, guarda no IndexedDB `calendario-mentorei`).
