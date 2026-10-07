# Salva um post no calendário (usado pelo Claude depois de criar as artes).
# Exemplo:
#   powershell -ExecutionPolicy Bypass -File ferramentas\salvar-post.ps1 `
#     -Data 2026-10-09 -Hora 09:00 -Formato carrossel -Tema "3 sinais de que você virou o gargalo" `
#     -LegendaArquivo legenda.txt -Hashtags "#lideranca #mentorei" -Arquivos lamina-01.png,lamina-02.png
# Sem -Data o post vai para a Caixa de entrada. Precisa do arquivo .env (veja .env.exemplo).
param(
  [string]$Data,
  [string]$Hora,
  [ValidateSet('reels', 'carrossel', 'estatico', 'stories')][string]$Formato = 'carrossel',
  [Parameter(Mandatory = $true)][string]$Tema,
  [string]$Legenda = '',
  [string]$LegendaArquivo,
  [string]$Hashtags = '',
  [string]$Observacoes = '',
  [ValidateSet('producao', 'pronto')][string]$Status = 'pronto',
  [string[]]$Arquivos = @(),
  # anúncio: -Tipo anuncio -AnuncioJson '{"campanha":"...","situacao":"rascunho",...}'
  [ValidateSet('organico', 'anuncio')][string]$Tipo = 'organico',
  [string]$AnuncioJson = '{}',
  [switch]$Fixado,
  [string]$DestaqueId
)
$ErrorActionPreference = 'Stop'

# ---------- configuração (.env na pasta do projeto) ----------
$raiz = Join-Path $PSScriptRoot '..'
$env_ = @{}
Get-Content (Join-Path $raiz '.env') -Encoding UTF8 | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' } |
  ForEach-Object { $env_[$Matches[1]] = $Matches[2].Trim().Trim('"') }
$url = $env_['SUPABASE_URL'].TrimEnd('/')
$chave = $env_['SUPABASE_SECRET_KEY']
if (-not $url -or -not $chave) { throw 'Faltam SUPABASE_URL ou SUPABASE_SECRET_KEY no arquivo .env' }
$cab = @{ apikey = $chave }
if ($chave.StartsWith('eyJ')) { $cab.Authorization = "Bearer $chave" }
# o Supabase recusa a chave secreta quando o pedido parece vir de um navegador
$agente = 'calendario-mentorei-ferramenta/1.0'

function Enviar-Json($metodo, $caminho, $objeto) {
  $corpo = [Text.Encoding]::UTF8.GetBytes(($objeto | ConvertTo-Json -Depth 5 -Compress))
  $h = $cab.Clone(); $h.Prefer = 'return=representation'
  Invoke-RestMethod -UserAgent $agente -Method $metodo -Uri "$url/rest/v1/$caminho" -Headers $h -ContentType 'application/json; charset=utf-8' -Body $corpo
}

$tipos = @{ '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.gif' = 'image/gif'
  '.mp4' = 'video/mp4'; '.mov' = 'video/quicktime'; '.m4v' = 'video/x-m4v'; '.webm' = 'video/webm' }

# confere os arquivos antes de criar o post
$lista = foreach ($a in $Arquivos) {
  $item = Get-Item -LiteralPath $a
  $ext = $item.Extension.ToLower()
  if (-not $tipos[$ext]) { throw "Tipo de arquivo não aceito: $($item.Name)" }
  if ($item.Length -gt 50MB) { throw "$($item.Name) passa de 50 MB" }
  [pscustomobject]@{ Item = $item; Tipo = $tipos[$ext] }
}

if ($LegendaArquivo) { $Legenda = Get-Content -LiteralPath $LegendaArquivo -Raw -Encoding UTF8 }

# ---------- cria o post ----------
$post = Enviar-Json Post 'cal_posts' ([ordered]@{
  data = $(if ($Data) { $Data } else { $null })
  hora = $(if ($Data -and $Hora) { $Hora } else { $null })
  formato = $Formato; tema = $Tema; legenda = $Legenda.Trim(); hashtags = $Hashtags.Trim()
  observacoes = $Observacoes.Trim(); status = $Status; origem = 'claude'
  tipo = $Tipo; fixado = [bool]$Fixado; destaque_id = $(if ($DestaqueId) { $DestaqueId } else { $null }); anuncio = ($AnuncioJson | ConvertFrom-Json)
})
$post = @($post)[0]

# ---------- envia as artes, na ordem recebida ----------
$ordem = 0
foreach ($a in $lista) {
  $seguro = ($a.Item.Name -replace '[^a-zA-Z0-9._-]+', '-')
  $caminho = "posts/$($post.id)/$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$seguro"
  $h = $cab.Clone(); $h['x-upsert'] = 'false'
  Invoke-RestMethod -UserAgent $agente -Method Post -Uri "$url/storage/v1/object/calendario/$caminho" -Headers $h -ContentType $a.Tipo -InFile $a.Item.FullName | Out-Null
  Enviar-Json Post 'cal_midias' ([ordered]@{
    post_id = $post.id; caminho = $caminho; nome = $a.Item.Name; tipo = $a.Tipo; tamanho = $a.Item.Length; ordem = $ordem
  }) | Out-Null
  $ordem++
}

$quando = if ($Data) { "$Data $Hora" } else { 'Caixa de entrada (sem data)' }
Write-Host "Post salvo: $Tema | $quando | $ordem arquivo(s) | id $($post.id)"
