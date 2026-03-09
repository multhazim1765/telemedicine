param(
  [string]$SourceCsv = "c:\Users\User\Downloads\Extensive_A_Z_medicines_dataset_of_India.csv",
  [string]$TargetJson = "c:\Users\User\OneDrive\Desktop\telemedicine\src\data\indiaMedicineCatalog.json",
  [string]$TargetAllJson = "c:\Users\User\OneDrive\Desktop\telemedicine\public\data\india-all-medicines.min.json",
  [string]$TargetTabletJson = "c:\Users\User\OneDrive\Desktop\telemedicine\public\data\india-tablets.min.json",
  [string]$TargetChunkDirectory = "c:\Users\User\OneDrive\Desktop\telemedicine\public\data\india-medicines",
  [int]$Limit = 2500
)

function SafeTrim([object]$value, [string]$fallback = "") {
  if ($null -eq $value) { return $fallback }
  $text = [string]$value
  if ([string]::IsNullOrWhiteSpace($text)) { return $fallback }
  return $text.Trim()
}

function NormalizeLetter([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    return "#"
  }

  $token = $value.Substring(0, 1).ToUpperInvariant()
  if ($token -match "^[A-Z]$") {
    return $token
  }
  return "#"
}

if (-not (Test-Path $SourceCsv)) {
  throw "CSV file not found: $SourceCsv"
}

$rows = Import-Csv $SourceCsv
$priceColumnName = $null
if ($rows.Count -gt 0) {
  $priceColumnName = $rows[0].PSObject.Properties.Name |
    Where-Object { $_ -like "price*" } |
    Select-Object -First 1
}

$filtered = $rows |
  Where-Object { ($_.Is_discontinued -ne "True") -and (SafeTrim $_.name) } |
  Select-Object -First $Limit

$catalog = foreach ($row in $filtered) {
  $uses = @($row.use0, $row.use1, $row.use2, $row.use3, $row.use4) |
    ForEach-Object { SafeTrim $_ } |
    Where-Object { $_ -ne "" }

  $substitutes = @($row.substitute0, $row.substitute1, $row.substitute2, $row.substitute3, $row.substitute4) |
    ForEach-Object { SafeTrim $_ } |
    Where-Object { $_ -ne "" }

  $compositions = @($row.short_composition1, $row.short_composition2) |
    ForEach-Object { SafeTrim $_ } |
    Where-Object { $_ -ne "" }

  $sideEffects = (SafeTrim $row.Consolidated_Side_Effects) -split "," |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne "" }

  $price = $null
  $priceText = if ($priceColumnName) { SafeTrim $row.$priceColumnName } else { "" }
  if ($priceText -ne "") {
    $parsed = 0.0
    if ([double]::TryParse($priceText, [ref]$parsed)) {
      $price = $parsed
    }
  }

  [PSCustomObject]@{
    id = if (SafeTrim $row.id) { "IND-$(SafeTrim $row.id)" } else { "IND-$([guid]::NewGuid().ToString('N').Substring(0,8))" }
    medicineName = SafeTrim $row.name
    therapeuticClass = SafeTrim $row.'Therapeutic Class' "General"
    actionClass = SafeTrim $row.'Action Class'
    manufacturer = SafeTrim $row.manufacturer_name
    packSize = SafeTrim $row.pack_size_label
    priceINR = $price
    uses = $uses
    substitutes = $substitutes
    compositions = $compositions
    sideEffects = $sideEffects
  }
}

$catalog | ConvertTo-Json -Depth 6 | Set-Content -Path $TargetJson -Encoding utf8

$allCatalog = $rows |
  Where-Object { SafeTrim $_.name } |
  ForEach-Object {
    $substitutes = @($_.substitute0, $_.substitute1, $_.substitute2, $_.substitute3, $_.substitute4) |
      ForEach-Object { SafeTrim $_ } |
      Where-Object { $_ -ne "" }

    $uses = @($_.use0, $_.use1, $_.use2, $_.use3, $_.use4) |
      ForEach-Object { SafeTrim $_ } |
      Where-Object { $_ -ne "" }

    [PSCustomObject]@{
      id = if (SafeTrim $_.id) { "IND-$(SafeTrim $_.id)" } else { "IND-$([guid]::NewGuid().ToString('N').Substring(0,8))" }
      medicineName = SafeTrim $_.name
      substitutes = $substitutes
      uses = $uses
      therapeuticClass = SafeTrim $_.'Therapeutic Class' "General"
      isDiscontinued = SafeTrim $_.Is_discontinued
      manufacturer = SafeTrim $_.manufacturer_name
    }
  }

$tabletCatalog = $rows |
  Where-Object { (SafeTrim $_.name) -and ([string]$_.name -match "(?i)tablet") } |
  ForEach-Object {
    $substitutes = @($_.substitute0, $_.substitute1, $_.substitute2, $_.substitute3, $_.substitute4) |
      ForEach-Object { SafeTrim $_ } |
      Where-Object { $_ -ne "" }

    $uses = @($_.use0, $_.use1, $_.use2, $_.use3, $_.use4) |
      ForEach-Object { SafeTrim $_ } |
      Where-Object { $_ -ne "" }

    [PSCustomObject]@{
      id = if (SafeTrim $_.id) { "IND-$(SafeTrim $_.id)" } else { "IND-$([guid]::NewGuid().ToString('N').Substring(0,8))" }
      medicineName = SafeTrim $_.name
      substitutes = $substitutes
      uses = $uses
      therapeuticClass = SafeTrim $_.'Therapeutic Class' "General"
      isDiscontinued = SafeTrim $_.Is_discontinued
      manufacturer = SafeTrim $_.manufacturer_name
    }
  }

$allDirectory = Split-Path -Path $TargetAllJson -Parent
if (-not (Test-Path $allDirectory)) {
  New-Item -Path $allDirectory -ItemType Directory -Force | Out-Null
}

$tabletDirectory = Split-Path -Path $TargetTabletJson -Parent
if (-not (Test-Path $tabletDirectory)) {
  New-Item -Path $tabletDirectory -ItemType Directory -Force | Out-Null
}

$allCatalog | ConvertTo-Json -Depth 6 | Set-Content -Path $TargetAllJson -Encoding utf8
$tabletCatalog | ConvertTo-Json -Depth 6 | Set-Content -Path $TargetTabletJson -Encoding utf8

if (-not (Test-Path $TargetChunkDirectory)) {
  New-Item -Path $TargetChunkDirectory -ItemType Directory -Force | Out-Null
}

$chunkGroups = $allCatalog | Group-Object {
  NormalizeLetter (SafeTrim $_.medicineName)
}

$chunkEntries = @()

foreach ($group in $chunkGroups) {
  $letter = $group.Name
  $fileName = if ($letter -eq "#") { "other.json" } else { "$letter.json" }
  $filePath = Join-Path $TargetChunkDirectory $fileName
  $webPath = "/data/india-medicines/$fileName"

  @($group.Group) | ConvertTo-Json -Depth 6 | Set-Content -Path $filePath -Encoding utf8

  $chunkEntries += [PSCustomObject]@{
    letter = $letter
    file = $webPath
    count = $group.Count
  }
}

$orderedChunkEntries = @()
if ($chunkEntries | Where-Object { $_.letter -eq "#" }) {
  $orderedChunkEntries += $chunkEntries | Where-Object { $_.letter -eq "#" }
}

$orderedChunkEntries += $chunkEntries |
  Where-Object { $_.letter -ne "#" } |
  Sort-Object letter

$indexPayload = [PSCustomObject]@{
  total = $allCatalog.Count
  chunks = $orderedChunkEntries
}

$indexPath = Join-Path $TargetChunkDirectory "index.json"
$indexPayload | ConvertTo-Json -Depth 6 | Set-Content -Path $indexPath -Encoding utf8

Write-Output "Imported limited $($catalog.Count) medicines -> $TargetJson"
Write-Output "Imported full all rows $($allCatalog.Count) medicines -> $TargetAllJson"
Write-Output "Imported full tablet rows $($tabletCatalog.Count) tablets -> $TargetTabletJson"
Write-Output "Imported chunked A-Z rows -> $TargetChunkDirectory"
