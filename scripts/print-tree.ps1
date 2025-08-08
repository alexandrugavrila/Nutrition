<#
Prints Home Assistant config tree with custom behavior:
- Fully recurse normal folders
- Inside custom_components/, list only top-level folders
- Copies output to clipboard
#>

param (
    [string]$Path = ".",
    [int]$Depth = [int]::MaxValue
)

function Get-GitIgnorePatterns {
    param ([string]$BasePath)

    $gitignore = Join-Path $BasePath ".gitignore"
    $patterns = @()

    if (Test-Path $gitignore) {
        $lines = Get-Content $gitignore | Where-Object {
            $_ -and -not ($_ -match '^\s*#')
        }

        foreach ($line in $lines) {
            $pattern = $line.Trim()
            if ($pattern -eq "") { continue }
            if ($pattern.EndsWith("/")) {
                $pattern = $pattern.TrimEnd("/")
            }

            $regex = "^" + [Regex]::Escape($pattern).Replace('\*', '.*').Replace('\?', '.') + "$"
            $patterns += $regex
        }
    }

    return $patterns
}

function Test-IgnorePath {
    param (
        [string]$RelativePath,
        [string[]]$IgnorePatterns
    )

    foreach ($pattern in $IgnorePatterns) {
        if ($RelativePath -match $pattern) {
            return $true
        }
    }
    return $false
}

function Get-Tree {
    param (
        [string]$CurrentPath,
        [int]$CurrentDepth,
        [int]$MaxDepth,
        [string]$Prefix = "",
        [string[]]$IgnorePatterns,
        [string]$BasePath,
        [ref]$Output
    )

    if ($CurrentDepth -gt $MaxDepth) { return }

    $items = Get-ChildItem -LiteralPath $CurrentPath -Force | Sort-Object {
        if ($_.PSIsContainer) { 0 } else { 1 }
    }, Name

    $isCustomComponents = ($CurrentPath -replace '\\', '/') -match '/custom_components$'
    if ($isCustomComponents) {
        $items = $items | Where-Object { $_.PSIsContainer }
    }

    $count = $items.Count
    for ($i = 0; $i -lt $count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $count - 1)

        $relative = ($item.FullName.Substring($BasePath.Length)).TrimStart('\','/')
        $relative = $relative -replace '\\', '/'

        if (Test-IgnorePath -RelativePath $relative -IgnorePatterns $IgnorePatterns) {
            continue
        }

        $connector = if ($isLast) { "+-- " } else { "|-- " }
        $newPrefix = if ($isLast) { $Prefix + "    " } else { $Prefix + "|   " }

        $Output.Value += "$Prefix$connector$($item.Name)"

        if ($item.PSIsContainer -and -not $isCustomComponents) {
            Get-Tree -CurrentPath $item.FullName -CurrentDepth ($CurrentDepth + 1) -MaxDepth $MaxDepth -Prefix $newPrefix -IgnorePatterns $IgnorePatterns -BasePath $BasePath -Output $Output
        }
    }
}

# MAIN

$ResolvedPath = Resolve-Path -LiteralPath $Path
$ResolvedPathStr = $ResolvedPath.Path.TrimEnd('\','/')

$IgnorePatterns = Get-GitIgnorePatterns -BasePath $ResolvedPathStr

# Build output
$treeOutput = @()
$treeOutput += ""
$treeOutput += "Directory Tree for: $ResolvedPathStr"
$treeOutput += "-----------------------------------"

Get-Tree -CurrentPath $ResolvedPathStr -CurrentDepth 1 -MaxDepth $Depth -IgnorePatterns $IgnorePatterns -BasePath $ResolvedPathStr -Output ([ref]$treeOutput)

# Output to console
$treeOutput | ForEach-Object { Write-Host $_ }

# Copy to clipboard
$treeOutput -join "`r`n" | Set-Clipboard
Write-Host "`n(Tree copied to clipboard)" -ForegroundColor Yellow
