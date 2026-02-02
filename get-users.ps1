#!/usr/bin/env pwsh
# Query database for all users

$env:DATABASE_URL = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace 'DATABASE_URL=', ''

Write-Host "=== Fetching Users from Database ===" -ForegroundColor Cyan

npx prisma db execute --stdin <<EOF
SELECT id, email, name, role, "createdAt" 
FROM "User" 
ORDER BY "createdAt" DESC;
EOF
