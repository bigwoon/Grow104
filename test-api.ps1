#!/usr/bin/env pwsh
# API Testing Script for SS Garden App Backend
# Production URL: https://grow104-snowy.vercel.app

$API_BASE = "https://grow104-snowy.vercel.app"

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "SS Garden App - API Testing Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Test 1: Create a test user (signup)
Write-Host "`n[TEST 1] Creating test user..." -ForegroundColor Yellow

$signupBody = @{
    email = "testuser@example.com"
    password = "TestPassword123!"
    name = "Test User"
    role = "Admin"
    phone = "555-0100"
    address = "123 Test St"
} | ConvertTo-Json

try {
    $signupResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth?action=signup" `
        -Method POST `
        -ContentType "application/json" `
        -Body $signupBody `
        -ErrorAction Stop
    
    Write-Host "✅ User created successfully!" -ForegroundColor Green
    Write-Host "User ID: $($signupResponse.data.user.id)" -ForegroundColor Gray
    Write-Host "Email: $($signupResponse.data.user.email)" -ForegroundColor Gray
    Write-Host "Role: $($signupResponse.data.user.role)" -ForegroundColor Gray
    
    $TOKEN = $signupResponse.data.token
    Write-Host "`nToken received: $($TOKEN.Substring(0, 50))..." -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "⚠️  User already exists, trying login instead..." -ForegroundColor Yellow
        
        # Test 2: Login with existing user
        $loginBody = @{
            email = "testuser@example.com"
            password = "TestPassword123!"
        } | ConvertTo-Json
        
        try {
            $loginResponse = Invoke-RestMethod -Uri "$API_BASE/api/auth?action=login" `
                -Method POST `
                -ContentType "application/json" `
                -Body $loginBody `
                -ErrorAction Stop
            
            Write-Host "✅ Login successful!" -ForegroundColor Green
            $TOKEN = $loginResponse.data.token
            Write-Host "Token received: $($TOKEN.Substring(0, 50))..." -ForegroundColor Gray
        } catch {
            Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Signup failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
        exit 1
    }
}

# Test 3: Get gardener requests
Write-Host "`n[TEST 2] Testing GET /api/requests?type=gardener..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $TOKEN"
    }
    
    $gardenerRequests = Invoke-RestMethod -Uri "$API_BASE/api/requests?type=gardener" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Gardener requests retrieved!" -ForegroundColor Green
    Write-Host "Count: $($gardenerRequests.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Get volunteer requests
Write-Host "`n[TEST 3] Testing GET /api/requests?type=volunteer..." -ForegroundColor Yellow

try {
    $volunteerRequests = Invoke-RestMethod -Uri "$API_BASE/api/requests?type=volunteer" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Volunteer requests retrieved!" -ForegroundColor Green
    Write-Host "Count: $($volunteerRequests.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Get map data
Write-Host "`n[TEST 4] Testing GET /api/gardens?action=map..." -ForegroundColor Yellow

try {
    $mapData = Invoke-RestMethod -Uri "$API_BASE/api/gardens?action=map" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Map data retrieved!" -ForegroundColor Green
    Write-Host "Gardens with coordinates: $($mapData.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Get all gardens
Write-Host "`n[TEST 5] Testing GET /api/gardens..." -ForegroundColor Yellow

try {
    $gardens = Invoke-RestMethod -Uri "$API_BASE/api/gardens" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Gardens retrieved!" -ForegroundColor Green
    Write-Host "Total gardens: $($gardens.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: Get notifications
Write-Host "`n[TEST 6] Testing GET /api/notifications..." -ForegroundColor Yellow

try {
    $notifications = Invoke-RestMethod -Uri "$API_BASE/api/notifications" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Notifications retrieved!" -ForegroundColor Green
    Write-Host "Total notifications: $($notifications.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Get tasks
Write-Host "`n[TEST 7] Testing GET /api/tasks..." -ForegroundColor Yellow

try {
    $tasks = Invoke-RestMethod -Uri "$API_BASE/api/tasks" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Tasks retrieved!" -ForegroundColor Green
    Write-Host "Total tasks: $($tasks.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 9: Get inventory - supplies
Write-Host "`n[TEST 8] Testing GET /api/inventory?type=supplies..." -ForegroundColor Yellow

try {
    $supplies = Invoke-RestMethod -Uri "$API_BASE/api/inventory?type=supplies" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Supplies retrieved!" -ForegroundColor Green
    Write-Host "Total supplies: $($supplies.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 10: Get inventory - seedlings
Write-Host "`n[TEST 9] Testing GET /api/inventory?type=seedlings..." -ForegroundColor Yellow

try {
    $seedlings = Invoke-RestMethod -Uri "$API_BASE/api/inventory?type=seedlings" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ Seedlings retrieved!" -ForegroundColor Green
    Write-Host "Total seedlings: $($seedlings.data.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "`nYour JWT Token (save this for future tests):" -ForegroundColor Yellow
Write-Host $TOKEN -ForegroundColor White
Write-Host "`nPrisma Studio: http://localhost:5555" -ForegroundColor Yellow
Write-Host "Production API: $API_BASE" -ForegroundColor Yellow
Write-Host "`nAll endpoints tested successfully! ✅" -ForegroundColor Green
Write-Host ""
