param(
  [string]$NeonEnvFile = ".env.neon",
  [string]$DumpFile = "neon-data.dump"
)

$ErrorActionPreference = "Stop"
$PgToolsImage = "postgres:17"

function Assert-LastExitCode {
  param([string]$Step)
  if ($LASTEXITCODE -ne 0) {
    throw "Comando fallito durante: $Step (exit code $LASTEXITCODE)"
  }
}

function Get-DatabaseUrlFromEnvFile {
  param([string]$Path)

  $line = Get-Content $Path | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if (-not $line) {
    throw "DATABASE_URL non trovato in $Path"
  }

  $value = $line -replace '^\s*DATABASE_URL\s*=\s*', ''
  $value = $value.Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  if (-not $value) {
    throw "DATABASE_URL vuoto in $Path"
  }

  return $value
}

function Convert-NeonPoolerToDirect {
  param([string]$Url)

  $direct = $Url
  $direct = $direct -replace '-pooler\.', '.'
  $direct = $direct -replace '([?&])pgbouncer=true(&|$)', '$1'
  $direct = $direct -replace '([?&])pool_timeout=[^&]*(&|$)', '$1'
  $direct = $direct -replace '([?&])connect_timeout=[^&]*(&|$)', '$1'
  $direct = $direct -replace '[?&]$', ''
  $direct = $direct -replace '\?&', '?'

  return $direct
}

function Sanitize-UrlForPgTools {
  param([string]$Url)

  $clean = $Url
  $clean = $clean -replace '([?&])pgbouncer=true(&|$)', '$1'
  $clean = $clean -replace '([?&])pool_timeout=[^&]*(&|$)', '$1'
  $clean = $clean -replace '([?&])connect_timeout=[^&]*(&|$)', '$1'
  $clean = $clean -replace '[?&]$', ''
  $clean = $clean -replace '\?&', '?'
  return $clean
}

if (-not (Test-Path $NeonEnvFile)) {
  Write-Host "File non trovato: $NeonEnvFile"
  Write-Host "Crea un file .env.neon con almeno la riga DATABASE_URL=... (connessione DIRECT di Neon) e riprova."
  exit 1
}

Write-Host "1) Export dati da Neon (data-only) in $DumpFile"
$dbUrl = Get-DatabaseUrlFromEnvFile -Path $NeonEnvFile
$primaryUrl = Sanitize-UrlForPgTools -Url $dbUrl
$fallbackUrl = Sanitize-UrlForPgTools -Url (Convert-NeonPoolerToDirect -Url $dbUrl)

docker run --rm -v "${PWD}:/backup" $PgToolsImage pg_dump "$primaryUrl" --data-only --format=c --no-owner --no-privileges --exclude-table-data=_prisma_migrations -f "/backup/$DumpFile"
if ($LASTEXITCODE -ne 0 -and $fallbackUrl -ne $primaryUrl) {
  Write-Host "Dump fallito con URL pooler, riprovo con URL direct..."
  docker run --rm -v "${PWD}:/backup" $PgToolsImage pg_dump "$fallbackUrl" --data-only --format=c --no-owner --no-privileges --exclude-table-data=_prisma_migrations -f "/backup/$DumpFile"
}
Assert-LastExitCode -Step "Export dati da Neon"

if (-not (Test-Path $DumpFile)) {
  throw "Dump non trovato: $DumpFile"
}

Write-Host "2) Stop app"
docker compose stop app
Assert-LastExitCode -Step "Stop app"

Write-Host "3) Reset schema public nel DB Docker"
docker compose exec -T db psql -U corfumania -d corfumania -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
Assert-LastExitCode -Step "Reset schema"

Write-Host "4) Applica migrazioni Prisma"
docker compose run --rm app npx prisma migrate deploy
Assert-LastExitCode -Step "Migrazioni Prisma"

Write-Host "5) Copia dump nel container db"
$dbId = docker compose ps -q db
if (-not $dbId) {
  Write-Host "Container db non trovato."
  exit 1
}
docker cp ".\$DumpFile" "${dbId}:/tmp/$DumpFile"
Assert-LastExitCode -Step "Copia dump nel container db"

Write-Host "6) Import dati nel DB Docker"
docker compose exec -T db pg_restore -U corfumania -d corfumania --data-only --disable-triggers "/tmp/$DumpFile"
Assert-LastExitCode -Step "Import dati"

Write-Host "7) Start app"
docker compose up -d app
Assert-LastExitCode -Step "Start app"

Write-Host "OK. Apri http://localhost:3000"
