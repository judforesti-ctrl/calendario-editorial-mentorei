# Servidor local só para ver o calendário no computador (http://localhost:8787).
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\servidor-local.ps1
param([int]$Porta = 8787)

$raiz = Join-Path $PSScriptRoot '..\public' | Resolve-Path
$projeto = Join-Path $PSScriptRoot '..' | Resolve-Path
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.json' = 'application/json'
}
$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Porta/")
$http.Start()
Write-Host "Calendário em http://localhost:$Porta/"
while ($http.IsListening) {
  $ctx = $http.GetContext()
  $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ($caminho -eq '') { $caminho = 'index.html' }
  # /_local/fila/... e /_local/artes-recebidas/... servem a prévia da fila (só neste computador)
  $base = $raiz.Path
  if ($caminho -match '^_local/((fila|artes-recebidas)/.+)$') { $base = $projeto.Path; $caminho = $Matches[1] }
  $arquivo = Join-Path $base $caminho
  if ((Test-Path -LiteralPath $arquivo -PathType Leaf) -and ([IO.Path]::GetFullPath($arquivo).StartsWith($base))) {
    $bytes = [IO.File]::ReadAllBytes($arquivo)
    $ext = [IO.Path]::GetExtension($arquivo).ToLower()
    $ctx.Response.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
