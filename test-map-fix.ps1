#!/usr/bin/env pwsh
# test-map-fix.ps1
# Script to verify the fix for malformed query strings on the map endpoint

$API_BASE = "http://localhost:3000" # Change this if your local backend is on a different port

Write-Host "`n=== Map Fix Verification Script ===" -ForegroundColor Cyan

# 1. Login to get token (using the test account from quick-test.ps1)
$loginBody = @{
    email = "apitest@grow104.com"
    password = "TestPass123!"
} | ConvertTo-Json

Write-Host "Logging in..." -ForegroundColor Yellow
try {
    $loginResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth?action=login" -Method POST -ContentType "application/json" -Body $loginBody
    $TOKEN = $loginResponse.data.token
    $headers = @{ "Authorization" = "Bearer $TOKEN" }
    Write-Host "✅ Login successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed. Make sure your local backend is running at $API_BASE and the apitest@grow104.com user exists." -ForegroundColor Red
    exit
}

# 2. Test the malformed URL pattern (which should now be handled by the backend fix)
Write-Host "`nTesting malformed URL pattern: /api/gardens?action=map?zipcode=76104" -ForegroundColor Cyan
try {
    # We deliberately use the malformed pattern here to test the backend normalization
    $result = Invoke-RestMethod -Uri "$API_BASE/api/gardens?action=map?zipcode=76104" -Headers $headers
    if ($result.success -and $result.data) {
        Write-Host "✅ Backend handled malformed URL correctly!" -ForegroundColor Green
        Write-Host "Found $($result.data.Count) gardens." -ForegroundColor Gray
    } else {
        Write-Host "❌ Backend response not successful." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Test the corrected URL pattern (which should now be sent by the frontend fix)
Write-Host "`nTesting corrected URL pattern: /api/gardens?action=map&zipcode=76104" -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "$API_BASE/api/gardens?action=map&zipcode=76104" -Headers $headers
    if ($result.success -and $result.data) {
        Write-Host "✅ Corrected URL pattern works perfectly!" -ForegroundColor Green
        Write-Host "Found $($result.data.Count) gardens." -ForegroundColor Gray
    } else {
        Write-Host "❌ Backend response not successful." -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Verification Complete ===`n" -ForegroundColor Cyan
