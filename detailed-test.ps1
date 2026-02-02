#!/usr/bin/env pwsh
# Detailed API test with error logging

$API_BASE = "https://grow104-snowy.vercel.app"

# Use the existing test user credentials
$loginBody = @{
    email = "apitest@grow104.com"
    password = "TestPass123!"
} | ConvertTo-Json

Write-Host "=== Logging in ===" -ForegroundColor Cyan
$loginResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth?action=login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

$TOKEN = $loginResponse.data.token
Write-Host "✅ Logged in successfully" -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $TOKEN"
}

# Test each endpoint and capture detailed errors
$endpoints = @(
    @{Name="Gardener Requests"; Url="$API_BASE/api/requests?type=gardener"},
    @{Name="Volunteer Requests"; Url="$API_BASE/api/requests?type=volunteer"},
    @{Name="Map Data"; Url="$API_BASE/api/gardens?action=map"},
    @{Name="Gardens"; Url="$API_BASE/api/gardens"},
    @{Name="Notifications"; Url="$API_BASE/api/notifications"},
    @{Name="Tasks"; Url="$API_BASE/api/tasks"},
    @{Name="Supplies"; Url="$API_BASE/api/inventory?type=supplies"},
    @{Name="Seedlings"; Url="$API_BASE/api/inventory?type=seedlings"},
    @{Name="Events"; Url="$API_BASE/api/events"},
    @{Name="Messages"; Url="$API_BASE/api/messages"},
    @{Name="Reports"; Url="$API_BASE/api/reports"},
    @{Name="Users"; Url="$API_BASE/api/users"},
    @{Name="Garden Invitations"; Url="$API_BASE/api/garden-invitations"}
)

Write-Host "`n=== Testing All Endpoints ===" -ForegroundColor Cyan

$results = @()

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-RestMethod -Uri $endpoint.Url -Headers $headers -ErrorAction Stop
        $count = if ($response.data -is [array]) { $response.data.Count } else { 1 }
        Write-Host "✅ $($endpoint.Name): $count items" -ForegroundColor Green
        $results += @{
            Endpoint = $endpoint.Name
            Status = "Success"
            Count = $count
            Error = $null
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorBody = $_.ErrorDetails.Message
        
        Write-Host "❌ $($endpoint.Name): HTTP $statusCode" -ForegroundColor Red
        
        if ($errorBody) {
            try {
                $errorJson = $errorBody | ConvertFrom-Json
                Write-Host "   Error: $($errorJson.error)" -ForegroundColor Yellow
                if ($errorJson.validationErrors) {
                    Write-Host "   Validation Errors: $($errorJson.validationErrors)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "   Raw Error: $errorBody" -ForegroundColor Yellow
            }
        }
        
        $results += @{
            Endpoint = $endpoint.Name
            Status = "Failed"
            StatusCode = $statusCode
            Error = $errorBody
        }
    }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$successCount = ($results | Where-Object { $_.Status -eq "Success" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "Failed" }).Count

Write-Host "Successful: $successCount / $($results.Count)" -ForegroundColor Green
Write-Host "Failed: $failCount / $($results.Count)" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

if ($failCount -gt 0) {
    Write-Host "`nFailed Endpoints:" -ForegroundColor Yellow
    $results | Where-Object { $_.Status -eq "Failed" } | ForEach-Object {
        Write-Host "  - $($_.Endpoint) (HTTP $($_.StatusCode))" -ForegroundColor Red
    }
}
