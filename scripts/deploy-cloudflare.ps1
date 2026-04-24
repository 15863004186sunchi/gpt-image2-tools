param(
  [string]$Domain = "397858.xyz",
  [string]$WorkerName = "gpt-image2-tools",
  [string]$D1Name = "gpt-image2-tools-db",
  [string]$R2BucketName = "gpt-image2-tools-images",
  [switch]$SkipChecks
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Env {
  param([string]$Name)

  $Value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing required environment variable: $Name"
  }

  return $Value
}

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Command
}

function Invoke-CfApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $Params = @{
    Method  = $Method
    Uri     = "https://api.cloudflare.com/client/v4$Path"
    Headers = @{
      Authorization  = "Bearer $script:CloudflareApiToken"
      "Content-Type" = "application/json"
    }
  }

  if ($null -ne $Body) {
    $Params.Body = ($Body | ConvertTo-Json -Depth 20)
  }

  $Response = Invoke-RestMethod @Params
  if (-not $Response.success) {
    $Errors = ($Response.errors | ConvertTo-Json -Depth 8)
    throw "Cloudflare API call failed: $Method $Path $Errors"
  }

  return $Response.result
}

function Get-D1DatabaseId {
  $Result = Invoke-CfApi -Method "GET" -Path "/accounts/$script:CloudflareAccountId/d1/database"
  $Databases = @($Result)
  $Existing = $Databases | Where-Object { $_.name -eq $D1Name } | Select-Object -First 1

  if ($Existing) {
    Write-Host "Reusing D1 database: $D1Name"
    $ExistingId = $Existing.uuid
    if ([string]::IsNullOrWhiteSpace($ExistingId)) {
      $ExistingId = $Existing.id
    }
    return $ExistingId
  }

  Write-Host "Creating D1 database: $D1Name"
  try {
    $Created = Invoke-CfApi -Method "POST" -Path "/accounts/$script:CloudflareAccountId/d1/database" -Body @{
      name = $D1Name
    }
    $CreatedId = $Created.uuid
    if ([string]::IsNullOrWhiteSpace($CreatedId)) {
      $CreatedId = $Created.id
    }
    return $CreatedId
  } catch {
    # D1 can be created before an API error is surfaced. Re-read before failing.
    $AfterCreate = @(Invoke-CfApi -Method "GET" -Path "/accounts/$script:CloudflareAccountId/d1/database")
    $Recovered = $AfterCreate | Where-Object { $_.name -eq $D1Name } | Select-Object -First 1
    if ($Recovered) {
      Write-Host "Recovered created D1 database after API error: $D1Name"
      $RecoveredId = $Recovered.uuid
      if ([string]::IsNullOrWhiteSpace($RecoveredId)) {
        $RecoveredId = $Recovered.id
      }
      return $RecoveredId
    }
    throw
  }
}

function Ensure-R2Bucket {
  try {
    $Result = Invoke-CfApi -Method "GET" -Path "/accounts/$script:CloudflareAccountId/r2/buckets"
  } catch {
    Write-Host "R2 is not enabled or this token cannot manage R2. Deploying without R2 binding." -ForegroundColor Yellow
    return $false
  }

  $Buckets = if ($Result.PSObject.Properties.Name -contains "buckets") { @($Result.buckets) } else { @($Result) }
  $Existing = $Buckets | Where-Object { $_.name -eq $R2BucketName } | Select-Object -First 1

  if ($Existing) {
    Write-Host "Reusing R2 bucket: $R2BucketName"
    return $true
  }

  Write-Host "Creating R2 bucket: $R2BucketName"
  try {
    Invoke-CfApi -Method "PUT" -Path "/accounts/$script:CloudflareAccountId/r2/buckets/$R2BucketName" | Out-Null
    return $true
  } catch {
    $AfterCreate = Invoke-CfApi -Method "GET" -Path "/accounts/$script:CloudflareAccountId/r2/buckets"
    $AfterBuckets = if ($AfterCreate.PSObject.Properties.Name -contains "buckets") { @($AfterCreate.buckets) } else { @($AfterCreate) }
    $Recovered = $AfterBuckets | Where-Object { $_.name -eq $R2BucketName } | Select-Object -First 1
    if ($Recovered) {
      Write-Host "Recovered created R2 bucket after API error: $R2BucketName"
      return $true
    }
    Write-Host "R2 bucket could not be created. Deploying without R2 binding." -ForegroundColor Yellow
    return $false
  }
}

function Set-ObjectProperty {
  param(
    [object]$Object,
    [string]$Name,
    [object]$Value
  )

  if ($Object.PSObject.Properties.Name -contains $Name) {
    $Object.$Name = $Value
  } else {
    $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
  }
}

function Update-WranglerConfig {
  param(
    [string]$D1DatabaseId,
    [bool]$EnableR2
  )

  $ConfigPath = Join-Path $PSScriptRoot "..\wrangler.jsonc"
  $Config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json

  Set-ObjectProperty -Object $Config -Name "account_id" -Value $script:CloudflareAccountId
  Set-ObjectProperty -Object $Config -Name "name" -Value $WorkerName
  Set-ObjectProperty -Object $Config -Name "workers_dev" -Value $false
  Set-ObjectProperty -Object $Config -Name "preview_urls" -Value $false
  Set-ObjectProperty -Object $Config -Name "routes" -Value @(
    [ordered]@{
      pattern = "$Domain/*"
      zone_id = $script:CloudflareZoneId
    }
  )

  $Config.vars.ENVIRONMENT = "production"
  $Config.d1_databases[0].database_name = $D1Name
  $Config.d1_databases[0].database_id = $D1DatabaseId
  $Config.d1_databases[0].migrations_dir = "./migrations"

  if ($EnableR2) {
    Set-ObjectProperty -Object $Config -Name "r2_buckets" -Value @(
      [ordered]@{
        binding     = "IMAGES"
        bucket_name = $R2BucketName
      }
    )
  } elseif ($Config.PSObject.Properties.Name -contains "r2_buckets") {
    $Config.PSObject.Properties.Remove("r2_buckets")
  }

  $Config | ConvertTo-Json -Depth 50 | Set-Content -Path $ConfigPath -Encoding utf8
  Write-Host "Updated wrangler.jsonc for $Domain"
}

function Test-RootDnsCanRouteWorker {
  $Records = @(Invoke-CfApi -Method "GET" -Path "/zones/$script:CloudflareZoneId/dns_records?name=$Domain")
  $ProxiedRecords = @($Records | Where-Object { $_.proxied -eq $true })

  if ($ProxiedRecords.Count -eq 0) {
    throw "No proxied DNS record found for $Domain. Add or proxy an A/AAAA/CNAME record before deploying a Worker Route."
  }

  Write-Host "Found $($ProxiedRecords.Count) proxied root DNS record(s) for $Domain"
}

function Set-WorkerSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "Skipping secret $Name because no value was provided." -ForegroundColor Yellow
    return
  }

  $TempFile = New-TemporaryFile
  try {
    Set-Content -Path $TempFile -Value $Value -NoNewline -Encoding utf8
    Get-Content -Path $TempFile -Raw | npx wrangler secret put $Name
  } finally {
    Remove-Item -LiteralPath $TempFile -Force -ErrorAction SilentlyContinue
  }
}

function Test-ProductionHealth {
  param(
    [string]$Domain,
    [int]$Attempts = 12,
    [int]$DelaySeconds = 10
  )

  $HealthUrl = "https://$Domain/api/health"

  for ($Attempt = 1; $Attempt -le $Attempts; $Attempt++) {
    Write-Host "Checking $HealthUrl (attempt $Attempt/$Attempts)"

    $Output = $null
    $Curl = Get-Command curl.exe -ErrorAction SilentlyContinue

    if ($Curl) {
      $Output = (& curl.exe -fsS --max-time 20 $HealthUrl 2>&1 | Out-String).Trim()
      if ($LASTEXITCODE -eq 0 -and $Output -match '"ok"\s*:\s*true') {
        Write-Host "Production health check passed"
        return
      }
    } else {
      try {
        $Response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 20
        $Output = $Response.Content
        if ($Response.StatusCode -eq 200 -and $Output -match '"ok"\s*:\s*true') {
          Write-Host "Production health check passed"
          return
        }
      } catch {
        $Output = $_.Exception.Message
      }
    }

    if (-not [string]::IsNullOrWhiteSpace($Output)) {
      Write-Host "Health check not ready: $Output" -ForegroundColor Yellow
    }

    if ($Attempt -lt $Attempts) {
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  throw "Worker deployed, but $HealthUrl did not pass health checks."
}

$script:CloudflareApiToken = Require-Env "CLOUDFLARE_API_TOKEN"
$script:CloudflareAccountId = Require-Env "CLOUDFLARE_ACCOUNT_ID"
$script:CloudflareZoneId = Require-Env "CLOUDFLARE_ZONE_ID"

Invoke-Step "Verify Cloudflare zone" {
  $Zone = Invoke-CfApi -Method "GET" -Path "/zones/$script:CloudflareZoneId"
  if ($Zone.name -ne $Domain) {
    throw "Zone mismatch: CLOUDFLARE_ZONE_ID belongs to $($Zone.name), expected $Domain"
  }
  Write-Host "Verified zone: $($Zone.name)"
}

Invoke-Step "Verify root DNS can route Workers" {
  Test-RootDnsCanRouteWorker
}

Invoke-Step "Create or reuse Cloudflare storage" {
  $D1DatabaseId = Get-D1DatabaseId
  $EnableR2 = Ensure-R2Bucket
  Update-WranglerConfig -D1DatabaseId $D1DatabaseId -EnableR2 $EnableR2
}

if (-not $SkipChecks) {
  Invoke-Step "Install dependencies if needed" {
    if (-not (Test-Path "node_modules")) {
      npm install
    } else {
      Write-Host "node_modules already exists"
    }
  }

  Invoke-Step "Run tests and type checks" {
    npm test
    npm run typecheck
  }
}

Invoke-Step "Build production assets" {
  npm run build
}

Invoke-Step "Apply D1 migrations remotely" {
  npx wrangler d1 migrations apply $D1Name --remote
}

Invoke-Step "Set Worker secrets" {
  Set-WorkerSecret -Name "OPENAI_API_KEY" -Value ([Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "Process"))
}

Invoke-Step "Deploy Worker to Cloudflare" {
  npx wrangler deploy
}

Invoke-Step "Verify production domain" {
  Test-ProductionHealth -Domain $Domain
}

Write-Host ""
Write-Host "Deployment complete: https://$Domain" -ForegroundColor Green
