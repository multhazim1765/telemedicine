param(
  [Parameter(Mandatory = $true)]
  [string]$WebhookUrl,

  [string]$From = "+919876543210",
  [string]$BookingCode = "111",
  [string]$MessageId = "manual-sms-test-001",
  [string]$ApiKey = "",
  [string]$Token = ""
)

$body = @{
  id = $MessageId
  from = $From
  message = "BOOK$BookingCode"
  status = "received"
}

if ($ApiKey) {
  $body.apikey = $ApiKey
}

if ($Token) {
  $body.token = $Token
}

Write-Host "Posting SMS booking test payload..." -ForegroundColor Cyan
Write-Host "Webhook URL: $WebhookUrl"
Write-Host "Message: $($body.message)"

try {
  $response = Invoke-RestMethod -Uri $WebhookUrl -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
  Write-Host "Webhook response:" -ForegroundColor Green
  $response | ConvertTo-Json -Depth 6
} catch {
  Write-Host "Webhook request failed:" -ForegroundColor Red
  if ($_.Exception.Response) {
    Write-Host ("HTTP Status: " + [int]$_.Exception.Response.StatusCode)
  }
  throw
}
