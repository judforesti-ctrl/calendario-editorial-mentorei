# Envia para o calendário todos os posts de fila/fila.json (usado pelo Claude).
#   powershell -ExecutionPolicy Bypass -File ferramentas\enviar-fila.ps1           -> envia o que ainda não foi enviado
#   powershell -ExecutionPolicy Bypass -File ferramentas\enviar-fila.ps1 -Previa   -> só gera fila/previa.json (ver no servidor local)
# Cada post enviado fica anotado em fila/enviados.txt, para nunca ser enviado duas vezes.
param([switch]$Previa)
$ErrorActionPreference = 'Stop'

$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$fila = (Get-Content (Join-Path $raiz 'fila\fila.json') -Raw -Encoding UTF8 | ConvertFrom-Json).posts
$anotacao = Join-Path $raiz 'fila\enviados.txt'
$enviados = if (Test-Path $anotacao) { @(Get-Content $anotacao -Encoding UTF8) } else { @() }

# monta cada post: artes da pasta (sem as capas que aguardam foto) + legenda separada das hashtags
$prontos = foreach ($p in $fila) {
  $pasta = Join-Path $raiz $p.pasta
  $artes = @(Get-ChildItem -LiteralPath $pasta -File | Where-Object { $_.Extension -match '^\.(png|jpe?g|webp|mp4|mov)$' -and $_.Name -notmatch 'capa-foto' } | Sort-Object Name)
  if (-not $artes.Count) { throw "Nenhuma arte em $($p.pasta)" }
  $arqLegenda = Join-Path $pasta 'legenda.txt'
  $linhas = if (Test-Path -LiteralPath $arqLegenda) { @(Get-Content -LiteralPath $arqLegenda -Encoding UTF8) } else { @() }
  while ($linhas.Count -and -not $linhas[-1].Trim()) { $linhas = $linhas[0..($linhas.Count - 2)] }
  $hashtags = ''
  if ($linhas.Count -and $linhas[-1].Trim().StartsWith('#')) { $hashtags = $linhas[-1].Trim(); $linhas = $linhas[0..($linhas.Count - 2)] }
  [pscustomobject]@{
    data = $p.data; hora = $p.hora; formato = $p.formato; tema = $p.tema; pasta = $p.pasta
    observacoes = "$($p.observacoes)"; legenda = (($linhas -join "`n").Trim()); hashtags = $hashtags
    arquivos = @($artes | ForEach-Object { ($p.pasta + '/' + $_.Name) })
    tipo = $(if ($p.tipo) { $p.tipo } else { 'organico' })
    anuncio = $(if ($p.anuncio) { $p.anuncio } else { New-Object psobject })
  }
}

if ($Previa) {
  $json = ConvertTo-Json @($prontos) -Depth 4
  [IO.File]::WriteAllText((Join-Path $raiz 'fila\previa.json'), $json, (New-Object Text.UTF8Encoding $false))
  Write-Host "Prévia gerada: $(@($prontos).Count) posts em fila\previa.json"
  return
}

foreach ($p in $prontos) {
  if ($enviados -contains $p.pasta) { Write-Host "Já enviado, pulando: $($p.tema)"; continue }
  & (Join-Path $PSScriptRoot 'salvar-post.ps1') -Data $p.data -Hora $p.hora -Formato $p.formato -Tema $p.tema `
    -Legenda $p.legenda -Hashtags $p.hashtags -Observacoes $p.observacoes `
    -Tipo $p.tipo -AnuncioJson ($p.anuncio | ConvertTo-Json -Depth 5 -Compress) `
    -Arquivos ($p.arquivos | ForEach-Object { Join-Path $raiz $_ })
  Add-Content -LiteralPath $anotacao -Value $p.pasta -Encoding UTF8
}
Write-Host 'Fila enviada.'
