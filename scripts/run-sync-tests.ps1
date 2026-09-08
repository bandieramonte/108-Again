[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$secureAdminKey = Read-Host `
  "Paste the Supabase sync_tests secret key (input is hidden)" `
  -AsSecureString
$adminKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
  $secureAdminKey
)

try {
  $adminKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
    $adminKeyPointer
  )

  if (-not $adminKey) {
    throw "A Supabase test admin key is required."
  }

  if (-not $adminKey.StartsWith("sb_secret_")) {
    throw "The sync test key must start with 'sb_secret_'."
  }

  $env:SUPABASE_TEST_SECRET_KEY = $adminKey
  & npm run test:sync

  if ($LASTEXITCODE -ne 0) {
    throw "Sync integration tests failed with exit code $LASTEXITCODE."
  }
} finally {
  Remove-Item Env:SUPABASE_TEST_SECRET_KEY -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminKeyPointer)
  $secureAdminKey.Dispose()
  $adminKey = $null
}
