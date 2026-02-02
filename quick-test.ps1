#!/usr/bin/env pwsh
# Create a new test user with known credentials

$API_BASE = "https://grow104-snowy.vercel.app"

Write-Host "`n=== Creating New Test User ===" -ForegroundColor Cyan

$signupBody = @{
    email = "apitest@grow104.com"
    password = "TestPass123!"
    name = "API Test User"
    role = "Admin"
    phone = "555-9999"
} | ConvertTo-Json

try {
    Write-Host "Creating user: apitest@grow104.com..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "$API_BASE/api/auth?action=signup" `
        -Method POST `
        -ContentType "application/json" `
        -Body $signupBody `
        -ErrorAction Stop
    
    Write-Host "✅ User created successfully!" -ForegroundColor Green
    Write-Host "Email: apitest@grow104.com" -ForegroundColor Gray
    Write-Host "Password: TestPass123!" -ForegroundColor Gray
    Write-Host "User ID: $($response.data.user.id)" -ForegroundColor Gray
    Write-Host "Role: $($response.data.user.role)" -ForegroundColor Gray
    
    $TOKEN = $response.data.token
    Write-Host "`n✅ JWT Token received!" -ForegroundColor Green
    Write-Host $TOKEN -ForegroundColor White
    
    # Now test the endpoints
    Write-Host "`n=== Testing Endpoints ===" -ForegroundColor Cyan
    
    $headers = @{
        "Authorization" = "Bearer $TOKEN"
    }
    
    # Test 1: Gardener Requests
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/requests?type=gardener" -Headers $headers
        Write-Host "✅ Gardener Requests: $($result.data.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "❌ Gardener Requests Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 2: Volunteer Requests
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/requests?type=volunteer" -Headers $headers
        Write-Host "✅ Volunteer Requests: $($result.data.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "❌ Volunteer Requests Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 3: Map Data
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/gardens?action=map" -Headers $headers
        Write-Host "✅ Map Data: $($result.data.Count) gardens" -ForegroundColor Green
    } catch {
        Write-Host "❌ Map Data Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 4: Gardens
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/gardens" -Headers $headers
        Write-Host "✅ Gardens: $($result.data.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "❌ Gardens Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 5: Notifications
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/notifications" -Headers $headers
        Write-Host "✅ Notifications: $($result.data.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "❌ Notifications Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 6: Tasks
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/tasks" -Headers $headers
        Write-Host "✅ Tasks: $($result.data.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "❌ Tasks Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 7: Inventory - Supplies
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/inventory?type=supplies" -Headers $headers
        Write-Host "✅ Supplies: $($result.data.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "❌ Supplies Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test 8: Inventory - Seedlings
    try {
        $result = Invoke-RestMethod -Uri "$API_BASE/api/inventory?type=seedlings" -Headers $headers
        Write-Host "✅ Seedlings: $($result.data.Count) items" -ForegroundColor Green
    } catch {
        Write-Host "❌ Seedlings Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n=== All Tests Complete! ===" -ForegroundColor Cyan
    Write-Host "`nSave these credentials for future testing:" -ForegroundColor Yellow
    Write-Host "Email: apitest@grow104.com" -ForegroundColor White
    Write-Host "Password: TestPass123!" -ForegroundColor White
    Write-Host "`nYour Token:" -ForegroundColor Yellow
    Write-Host $TOKEN -ForegroundColor White
    
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  User already exists! Trying to login instead..." -ForegroundColor Yellow
        
        $loginBody = @{
            email = "apitest@grow104.com"
            password = "TestPass123!"
        } | ConvertTo-Json
        
        try {
            $loginResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth?action=login" `
                -Method POST `
                -ContentType "application/json" `
                -Body $loginBody
            
            Write-Host "✅ Login successful!" -ForegroundColor Green
            $TOKEN = $loginResponse.data.token
            Write-Host "Token: $TOKEN" -ForegroundColor White
        } catch {
            Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Signup failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
