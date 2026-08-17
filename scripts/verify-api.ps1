#!/usr/bin/env pwsh
# WEVSOCIAL API Verification Script
# Verifies all architectural boundaries with live HTTP calls
# Usage: .\scripts\verify-api.ps1

$baseUrl = "http://localhost:3001/api"
$passed = 0
$total = 8

function Report-Result {
    param([string]$name, [bool]$success, [string]$detail)
    if ($success) {
        Write-Host " [PASS] $name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host " [FAIL] $name" -ForegroundColor Red
        if ($detail) {
            Write-Host "        Reason: $detail" -ForegroundColor DarkYellow
        }
    }
}

# Generate random unique email for clean test run
$guestEmail = "guest_$([guid]::NewGuid().ToString().Substring(0,8))@test.com"
$password = "password123"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  WEVSOCIAL Live API Verification Suite   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# --- Test 1: Register & Login as Guest ---
$guestToken = $null
$guestRefreshToken = $null
try {
    $regBody = @{
        email = $guestEmail
        password = $password
        displayName = "Test Guest"
    } | ConvertTo-Json

    $reg = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $guestToken = $reg.data.accessToken
    $guestRefreshToken = $reg.data.refreshToken
    $t1 = ($null -ne $guestToken -and $reg.data.user.role -eq "GUEST")
    Report-Result "Test 1: Register & Login as Guest (Argon2id + JWT)" $t1
} catch {
    Report-Result "Test 1: Register & Login as Guest (Argon2id + JWT)" $false $_.Exception.Message
}

# --- Test 2: Guest hits POST /api/sports/activities -> 403 Forbidden ---
try {
    $actPayload = @{
        title = "Unauthorized Match"
        sportType = "soccer"
        location = "Central Park"
        latitude = 40.78
        longitude = -73.96
        startTime = (Get-Date).AddDays(1).ToString("o")
        endTime = (Get-Date).AddDays(1).AddHours(2).ToString("o")
        capacity = 10
    } | ConvertTo-Json

    $t2 = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/sports/activities" -Method Post -Headers @{ Authorization = "Bearer $guestToken" } -Body $actPayload -ContentType "application/json"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 403) {
            $t2 = $true
        }
    }
    Report-Result "Test 2: RBAC Enforcement (Guest -> POST /api/sports/activities returns 403)" $t2
} catch {
    Report-Result "Test 2: RBAC Enforcement (Guest -> POST /api/sports/activities returns 403)" $false $_.Exception.Message
}

# --- Test 3: GET /api/care/providers -> Obfuscated coords, NO exactLat / exactLng / address ---
try {
    $providersRes = Invoke-RestMethod -Uri "$baseUrl/care/providers?userLat=40.75&userLng=-73.98" -Method Get -Headers @{ Authorization = "Bearer $guestToken" }
    $providers = $providersRes.data
    
    $hasSecretLeak = $false
    foreach ($p in $providers) {
        if ($null -ne $p.exactLat -or $null -ne $p.exactLng -or $null -ne $p.address) {
            $hasSecretLeak = $true
            break
        }
    }
    $t3 = (-not $hasSecretLeak -and $providers.Count -gt 0)
    Report-Result "Test 3: Geo-Privacy (GET /care/providers never exposes exactLat/exactLng/address)" $t3
} catch {
    Report-Result "Test 3: Geo-Privacy (GET /care/providers never exposes exactLat/exactLng/address)" $false $_.Exception.Message
}

# --- Test 4: Login as Host, create activity -> 201 Created ---
$activityId = $null
try {
    $hostLogin = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body (@{ email = "host1@example.com"; password = "password123" } | ConvertTo-Json) -ContentType "application/json"
    $hostToken = $hostLogin.data.accessToken

    $newActPayload = @{
        title = "Host Basketball Tournament"
        sportType = "basketball"
        location = "Brooklyn Court"
        latitude = 40.69
        longitude = -73.98
        startTime = (Get-Date).AddDays(2).ToString("o")
        endTime = (Get-Date).AddDays(2).AddHours(2).ToString("o")
        capacity = 10
    } | ConvertTo-Json

    $createdAct = Invoke-RestMethod -Uri "$baseUrl/sports/activities" -Method Post -Headers @{ Authorization = "Bearer $hostToken" } -Body $newActPayload -ContentType "application/json"
    $activityId = $createdAct.data.id
    $t4 = ($null -ne $activityId)
    Report-Result "Test 4: Host Activity Creation (Host token -> 201 Created)" $t4
} catch {
    Report-Result "Test 4: Host Activity Creation (Host token -> 201 Created)" $false $_.Exception.Message
}

# --- Test 5: Idempotency with clientId ---
try {
    $clientId = [guid]::NewGuid().ToString()
    $bookPayload = @{
        activityId = $activityId
        clientId = $clientId
    } | ConvertTo-Json

    $b1 = Invoke-RestMethod -Uri "$baseUrl/sports/bookings" -Method Post -Headers @{ Authorization = "Bearer $guestToken" } -Body $bookPayload -ContentType "application/json"
    $b2 = Invoke-RestMethod -Uri "$baseUrl/sports/bookings" -Method Post -Headers @{ Authorization = "Bearer $guestToken" } -Body $bookPayload -ContentType "application/json"

    $t5 = ($b1.data.id -eq $b2.data.id -and $null -ne $b1.data.id)
    Report-Result "Test 5: Booking Idempotency (Same clientId -> Same booking returned)" $t5
} catch {
    Report-Result "Test 5: Booking Idempotency (Same clientId -> Same booking returned)" $false $_.Exception.Message
}

# --- Test 6: Refresh Token Rotation ---
$newRefreshToken = $null
try {
    $refPayload = @{ refreshToken = $guestRefreshToken } | ConvertTo-Json
    $refRes = Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -Body $refPayload -ContentType "application/json"
    $newRefreshToken = $refRes.data.refreshToken

    # Now presenting the OLD refresh token must fail with 401
    $oldTokenRejected = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -Body $refPayload -ContentType "application/json"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            $oldTokenRejected = $true
        }
    }
    $t6 = ($null -ne $newRefreshToken -and $oldTokenRejected)
    Report-Result "Test 6: Refresh Token Rotation (Old refresh token invalidated upon rotation)" $t6
} catch {
    Report-Result "Test 6: Refresh Token Rotation (Old refresh token invalidated upon rotation)" $false $_.Exception.Message
}

# --- Test 7: Token Reuse Detection (Revokes entire family) ---
try {
    # Since old refresh token was reused above, the family was marked compromised.
    # Therefore, attempting to use the NEW refresh token must ALSO be rejected (401).
    $familyRevoked = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -Body (@{ refreshToken = $newRefreshToken } | ConvertTo-Json) -ContentType "application/json"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            $familyRevoked = $true
        }
    }
    Report-Result "Test 7: Token Family Reuse Detection (Compromised family revoked -> 401)" $familyRevoked
} catch {
    Report-Result "Test 7: Token Family Reuse Detection (Compromised family revoked -> 401)" $false $_.Exception.Message
}

# --- Test 8: Missing Auth Header -> 401 ---
try {
    $unauthRejected = $false
    try {
        Invoke-RestMethod -Uri "$baseUrl/care/providers" -Method Get
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            $unauthRejected = $true
        }
    }
    Report-Result "Test 8: Unauthenticated Access Guard (Missing token -> 401 Unauthorized)" $unauthRejected
} catch {
    Report-Result "Test 8: Unauthenticated Access Guard (Missing token -> 401 Unauthorized)" $false $_.Exception.Message
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($passed -eq $total) {
    Write-Host " Final Result: $passed/$total Tests Passed (All boundaries verified!)" -ForegroundColor Green
} else {
    Write-Host " Final Result: $passed/$total Tests Passed" -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan
