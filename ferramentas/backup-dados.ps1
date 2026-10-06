# Cópia de segurança dos dados do calendário (posts, artes cadastradas, check-ins, anúncios e perfis).
# Salva em backups\AAAA-MM-DD\ dentro desta pasta. As artes em si já estão na pasta "postagens" e no Supabase.
# Uso: powershell -ExecutionPolicy Bypass -File ferramentas\backup-dados.ps1
$ErrorActionPreference = 'Stop'

$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$env_ = @{}
Get-Content (Join-Path $raiz '.env') -Encoding UTF8 | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$' } |
  ForEach-Object { $env_[$Matches[1]] = $Matches[2].Trim().Trim('"') }
$url = $env_['SUPABASE_URL'].TrimEnd('/')
$cab = @{ apikey = $env_['SUPABASE_SECRET_KEY'] }
$agente = 'calendario-mentorei-ferramenta/1.0'   # o Supabase recusa a chave secreta vinda de navegador

$destino = Join-Path $raiz ("backups\" + (Get-Date -Format 'yyyy-MM-dd'))
New-Item -ItemType Directory -Force $destino | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false

foreach ($tabela in 'cal_posts', 'cal_midias', 'cal_checkins', 'cal_perfis') {
  $r = Invoke-WebRequest -UseBasicParsing -UserAgent $agente -Uri "$url/rest/v1/$($tabela)?select=*" -Headers $cab
  $texto = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  [IO.File]::WriteAllText((Join-Path $destino "$tabela.json"), $texto, $utf8)
  Write-Host ("{0}: {1} registros" -f $tabela, ($texto | ConvertFrom-Json).Count)
}
Write-Host "Cópia salva em $destino"
