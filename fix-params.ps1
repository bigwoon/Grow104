#!/usr/bin/env pwsh
# Script to fix TypeScript parameter ordering issues
# Moves optional 'origin' parameter to the end of function signatures

$files = @(
    "api\volunteer-requests.ts",
    "api\tasks.ts",
    "api\reports.ts",
    "api\notifications.ts",
    "api\messages.ts",
    "api\inventory.ts",
    "api\gardens.ts",
    "api\gardener-requests.ts",
    "api\garden-invitations.ts",
    "api\events.ts"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Pattern 1: origin?: string, id: string -> id: string, origin?: string
    $content = $content -replace '(\w+)\(([^)]*), origin\?: string, (\w+: string)\)', '$1($2, $3, origin?: string)'
    
    # Pattern 2: origin?: string, type: string, id: string -> type: string, id: string, origin?: string  
    $content = $content -replace '(\w+)\(([^)]*), origin\?: string, (type: string), (id: string)\)', '$1($2, $3, $4, origin?: string)'
    
    # Pattern 3: origin?: string, type: string -> type: string, origin?: string
    $content = $content -replace '(\w+)\(([^)]*), origin\?: string, (type: string)\)', '$1($2, $3, origin?: string)'
    
    # Pattern 4: origin?: string, userId: string -> userId: string, origin?: string
    $content = $content -replace '(\w+)\(([^)]*), origin\?: string, (userId: string)\)', '$1($2, $3, origin?: string)'
    
    Set-Content $file -Value $content -NoNewline
    Write-Host "Fixed: $file"
}

Write-Host "`nAll files fixed!"
