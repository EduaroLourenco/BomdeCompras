# Extrai dados reais dos exports do Mercado Livre (Downloads\bom de compras) via Excel COM
# e agrega por dia num JSON de staging, para o import_ml.js consumir.
#
# Uso:
#   powershell -File tools\extract_ml.ps1 -SourceDir "C:\Users\dudu4\Downloads\bom de compras" -OutFile "tools\ml_staging.json"

param(
  [string]$SourceDir = "C:\Users\dudu4\Downloads\bom de compras",
  [string]$OutFile = "$PSScriptRoot\ml_staging.json"
)

# PowerShell 5.1 pode ler o .ps1 num codepage diferente do arquivo (UTF-8) e corromper
# literais acentuados no PROPRIO script -- por isso todo texto usado em comparacao/lookup
# (nomes de mes) passa por Strip-Accents antes de comparar, nunca compara acento com acento.
function Strip-Accents([string]$s) {
  if ($null -eq $s) { return $s }
  $s = $s -replace '[áàâãä]', 'a' -replace '[éèêë]', 'e' -replace '[íìîï]', 'i' `
           -replace '[óòôõö]', 'o' -replace '[úùûü]', 'u' -replace '[ç]', 'c'
  return $s
}

# Value2 do Excel as vezes devolve numero como STRING (colunas formatadas como texto na
# planilha de origem) -- nunca confiar so em "-is [double]", sempre tentar conversao.
function ToNum($v) {
  if ($null -eq $v) { return 0.0 }
  if ($v -is [double]) { return $v }
  if ($v -is [int]) { return [double]$v }
  $s = ([string]$v).Trim()
  if ($s -eq "" -or $s -eq "-") { return 0.0 }
  $s = $s -replace '\.', '' -replace ',', '.'   # formato pt-BR: milhar "." decimal ","
  $out = 0.0
  if ([double]::TryParse($s, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$out)) {
    return $out
  }
  return 0.0
}

$MonthFull = @{
  'janeiro'=1; 'fevereiro'=2; 'marco'=3; 'abril'=4; 'maio'=5; 'junho'=6;
  'julho'=7; 'agosto'=8; 'setembro'=9; 'outubro'=10; 'novembro'=11; 'dezembro'=12
}
$MonthAbbr = @{
  'jan'=1;'fev'=2;'mar'=3;'abr'=4;'mai'=5;'jun'=6;'jul'=7;'ago'=8;'set'=9;'out'=10;'nov'=11;'dez'=12
}

function Parse-DataVenda($raw) {
  # celula pode vir como numero serial OLE (data "de verdade") ou como texto
  # "16 de agosto de 2026 01:19 hs." -> [datetime]
  if ($raw -is [double]) { return [DateTime]::FromOADate($raw) }
  $s = [string]$raw
  if ($s -match '(\d{1,2}) de (\w+) de (\d{4})(?:\s+(\d{2}):(\d{2}))?') {
    $d = [int]$Matches[1]; $mName = Strip-Accents($Matches[2].ToLower()); $y = [int]$Matches[3]
    $h = if ($Matches[4]) { [int]$Matches[4] } else { 0 }
    $mi = if ($Matches[5]) { [int]$Matches[5] } else { 0 }
    if (-not $MonthFull.ContainsKey($mName)) { return $null }
    return New-Object DateTime($y, $MonthFull[$mName], $d, $h, $mi, 0)
  }
  return $null
}

function Parse-PadsDate($raw) {
  if ($raw -is [double]) { return [DateTime]::FromOADate($raw) }
  # "17-mai-2026" -> [datetime]
  $s = [string]$raw
  if ($s -match '(\d{1,2})-(\w{3})-(\d{4})') {
    $d = [int]$Matches[1]; $mName = Strip-Accents($Matches[2].ToLower()); $y = [int]$Matches[3]
    if (-not $MonthAbbr.ContainsKey($mName)) { return $null }
    return New-Object DateTime($y, $MonthAbbr[$mName], $d)
  }
  return $null
}

# acha TODAS as ocorrencias "D de MES de AAAA" num texto e devolve a ULTIMA (a data final
# do periodo) sem depender de casar a palavra acentuada "ate" -- evita o mesmo problema de encoding
function Find-LastMonthInPeriodo([string]$text) {
  $ms = [regex]::Matches($text, '(\d{1,2}) de (\w+) de (\d{4})')
  if ($ms.Count -eq 0) { return $null }
  $last = $ms[$ms.Count - 1]
  $mName = Strip-Accents($last.Groups[2].Value.ToLower())
  if (-not $MonthFull.ContainsKey($mName)) { return $null }
  return $MonthFull[$mName] - 1   # indice 0-based
}

$daily = @{}   # "yyyy-MM-dd" -> @{receita=;pedidos=;pedCancel=;valCancel=}
function Add-Daily([string]$iso, [double]$receita, [int]$pedidos, [int]$pedCancel, [double]$valCancel) {
  if (-not $daily.ContainsKey($iso)) { $daily[$iso] = @{ receita = 0.0; pedidos = 0; pedCancel = 0; valCancel = 0.0 } }
  $daily[$iso].receita += $receita
  $daily[$iso].pedidos += $pedidos
  $daily[$iso].pedCancel += $pedCancel
  $daily[$iso].valCancel += $valCancel
}

$monthlyVisits = @{"0"=0.0;"1"=0.0;"2"=0.0;"3"=0.0;"4"=0.0;"5"=0.0;"6"=0.0;"7"=0.0;"8"=0.0;"9"=0.0;"10"=0.0;"11"=0.0}
$monthlyAds    = @{"0"=0.0;"1"=0.0;"2"=0.0;"3"=0.0;"4"=0.0;"5"=0.0;"6"=0.0;"7"=0.0;"8"=0.0;"9"=0.0;"10"=0.0;"11"=0.0}

$log = [System.Collections.Generic.List[string]]::new()
function Log([string]$m) { $log.Add($m); Write-Output $m }

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
  # ---------- VENDAS (por pedido) ----------
  $vendasPath = Join-Path $SourceDir "vendas mercado livre.xlsx"
  Log "Lendo Vendas: $vendasPath"
  $wb = $excel.Workbooks.Open($vendasPath, 0, $true)
  $ws = $wb.Worksheets.Item(1)
  $nRows = $ws.UsedRange.Rows.Count
  $range = $ws.Range($ws.Cells.Item(7,1), $ws.Cells.Item($nRows,20))
  $data = $range.Value2
  $nOrders = 0; $nCancel = 0; $nDateFail = 0
  $minDate = $null; $maxDate = $null
  $dateFailExamples = @()
  for ($r = 1; $r -le $data.GetLength(0); $r++) {
    $estado = $data[$r,4]
    if ($estado -eq $null -or $estado -eq "") { continue }
    $dataVendaRaw = $data[$r,2]
    $dt = Parse-DataVenda($dataVendaRaw)
    if ($dt -eq $null) {
      $nDateFail++
      if ($dateFailExamples.Count -lt 5) { $dateFailExamples += [string]$dataVendaRaw }
      continue
    }
    if ($minDate -eq $null -or $dt -lt $minDate) { $minDate = $dt }
    if ($maxDate -eq $null -or $dt -gt $maxDate) { $maxDate = $dt }
    $iso = $dt.ToString("yyyy-MM-dd")
    $receitaProdutos = ToNum($data[$r,9])
    $total = ToNum($data[$r,19])
    $estadoAscii = Strip-Accents([string]$estado)
    $isCancelled = ($estadoAscii -match '(?i)cancela') -or ($total -eq 0)
    $nOrders++
    if ($isCancelled) {
      $nCancel++
      Add-Daily -iso $iso -receita $receitaProdutos -pedidos 1 -pedCancel 1 -valCancel $receitaProdutos
    } else {
      Add-Daily -iso $iso -receita $receitaProdutos -pedidos 1 -pedCancel 0 -valCancel 0.0
    }
  }
  $wb.Close($false)
  Log "  pedidos processados: $nOrders (cancelados: $nCancel, datas nao reconhecidas: $nDateFail)"
  if ($dateFailExamples.Count -gt 0) { Log "  exemplos de data nao reconhecida: $($dateFailExamples -join ' || ')" }
  if ($minDate) { Log "  intervalo de datas: $($minDate.ToString('yyyy-MM-dd')) a $($maxDate.ToString('yyyy-MM-dd'))" }

  # ---------- ANUNCIOS (visitas mensais) ----------
  $adFiles = @("desempenho de anuncios junho.xlsx","desempenho de anuncios julho.xlsx","desempenho de anuncios agosto.xlsx","desempenho de anuncios agosto2.xlsx")
  foreach ($f in $adFiles) {
    $path = Join-Path $SourceDir $f
    if (-not (Test-Path $path)) { Log "  (pulando, nao encontrado: $f)"; continue }
    $wb = $excel.Workbooks.Open($path, 0, $true)
    $ws = $wb.Worksheets.Item(1)
    $periodText = [string]$ws.Cells.Item(3,1).Value2
    $m = Find-LastMonthInPeriodo($periodText)
    if ($m -eq $null) { Log "  (${f}: nao consegui achar o mes no texto do periodo, pulando)"; $wb.Close($false); continue }
    $nRows2 = $ws.UsedRange.Rows.Count
    $range2 = $ws.Range($ws.Cells.Item(7,8), $ws.Cells.Item($nRows2,8))  # coluna 8 = Visitas unicas
    $vdata = $range2.Value2
    $sumVis = 0.0
    if ($vdata -is [System.Array]) {
      for ($r = 1; $r -le $vdata.GetLength(0); $r++) { $sumVis += ToNum($vdata[$r,1]) }
    } else { $sumVis = ToNum($vdata) }
    $mk = "$m"
    $monthlyVisits[$mk] = [Math]::Max($monthlyVisits[$mk], $sumVis)  # agosto/agosto2 sao o mesmo periodo: usa o maior, nao soma duplicado
    Log "  $f -> mes $($m+1), visitas unicas somadas: $sumVis"
    $wb.Close($false)
  }

  # ---------- PADS (investimento em ads) ----------
  $padsFiles = Get-ChildItem -Path $SourceDir -Filter "report-pads_report-*.xlsx"
  foreach ($pf in $padsFiles) {
    Log "Lendo PADS: $($pf.Name)"
    $wb = $excel.Workbooks.Open($pf.FullName, 0, $true)
    $ws = $wb.Worksheets.Item(3)  # "Relatorio Anuncios patrocinados"
    $nRows3 = $ws.UsedRange.Rows.Count
    $range3 = $ws.Range($ws.Cells.Item(3,1), $ws.Cells.Item($nRows3,13))
    $pdata = $range3.Value2
    $nInvRows = 0
    for ($r = 1; $r -le $pdata.GetLength(0); $r++) {
      $desdeRaw = $pdata[$r,1]
      if ($desdeRaw -eq $null) { continue }
      $dt = Parse-PadsDate($desdeRaw)
      if ($dt -eq $null) { continue }
      $inv = ToNum($pdata[$r,13])
      $mak = "$($dt.Month - 1)"
      $monthlyAds[$mak] += $inv
      $nInvRows++
    }
    Log "  linhas de investimento lidas: $nInvRows"
    $wb.Close($false)
  }

} finally {
  $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}

$staging = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  daily = $daily
  monthlyVisits = $monthlyVisits
  monthlyAds = $monthlyAds
  log = $log
}
$staging | ConvertTo-Json -Depth 6 | Set-Content -Path $OutFile -Encoding utf8
Log "Staging escrito em: $OutFile"
