# 中道商城管理后台兼容性测试工具 - PowerShell 启动脚本
# 使用方式: .\run-admin-test.ps1

param(
    [string]$Mode = 'interactive',
    [string]$ApiUrl = 'http://localhost:3000/api/v1'
)

# 颜色定义
$colors = @{
    'Green'   = [ConsoleColor]::Green
    'Red'     = [ConsoleColor]::Red
    'Yellow'  = [ConsoleColor]::Yellow
    'Cyan'    = [ConsoleColor]::Cyan
    'Blue'    = [ConsoleColor]::Blue
    'Gray'    = [ConsoleColor]::Gray
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = 'Gray'
    )
    Write-Host $Message -ForegroundColor $colors[$Color]
}

function Show-Banner {
    Clear-Host
    Write-ColorOutput "===== 中道商城 - 管理后台兼容性测试工具 =====" -Color 'Cyan'
    Write-Host ""
}

function Test-NodeInstalled {
    try {
        $node = node --version
        Write-ColorOutput "OK: Node.js installed: $node" -Color 'Green'
        return $true
    } catch {
        Write-ColorOutput "ERROR: Node.js not found!" -Color 'Red'
        Write-ColorOutput "Please download from: https://nodejs.org/" -Color 'Yellow'
        return $false
    }
}

function Install-Dependencies {
    Write-ColorOutput "Checking dependencies..." -Color 'Cyan'
    
    if (-not (Test-Path "node_modules")) {
        Write-ColorOutput "Installing dependencies..." -Color 'Yellow'
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "ERROR: Installation failed!" -Color 'Red'
            return $false
        }
        Write-ColorOutput "OK: Dependencies installed" -Color 'Green'
    } else {
        Write-ColorOutput "OK: Dependencies ready" -Color 'Green'
    }
    return $true
}

function Test-ApiConnection {
    Write-ColorOutput "`nTesting API connection..." -Color 'Cyan'
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl/admin" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "OK: API connection successful" -Color 'Green'
            return $true
        } else {
            Write-ColorOutput "WARNING: API status: $($response.StatusCode)" -Color 'Yellow'
            Write-ColorOutput "  Hint: Ensure backend is running (npm run dev)" -Color 'Yellow'
            return $false
        }
    } catch {
        Write-ColorOutput "ERROR: Cannot connect to API: Backend may not be running" -Color 'Red'
        Write-ColorOutput "  API URL: $ApiUrl" -Color 'Gray'
        Write-ColorOutput "  Hint: Start backend: npm run dev" -Color 'Yellow'
        return $false
    }
}

function Test-DatabaseConnection {
    Write-ColorOutput "`nTesting database connection..." -Color 'Cyan'
    
    try {
        Write-ColorOutput "Running validation..." -Color 'Yellow'
        npm run db:validate 2>&1 | ForEach-Object {
            if ($_ -match 'error|fail') {
                Write-ColorOutput "  ERROR: $_" -Color 'Red'
            } else {
                Write-ColorOutput "  $_" -Color 'Green'
            }
        }
        return $true
    } catch {
        Write-ColorOutput "ERROR: Database test failed" -Color 'Red'
        return $false
    }
}

function Run-FullTest {
    Write-ColorOutput "`nRunning full compatibility test..." -Color 'Cyan'
    Write-ColorOutput "This may take a few minutes, please wait..." -Color 'Yellow'
    Write-Host ""
    
    try {
        node test-admin-compatibility.js
        Write-ColorOutput "`nOK: Test complete! Report saved as admin-test-report.html" -Color 'Green'
        return $true
    } catch {
        Write-ColorOutput "`nERROR: Test failed: $($_.Exception.Message)" -Color 'Red'
        return $false
    }
}

function Show-Report {
    if (Test-Path "admin-test-report.html") {
        Write-ColorOutput "`nOpening test report..." -Color 'Cyan'
        Invoke-Item "admin-test-report.html"
        Write-ColorOutput "OK: Report opened" -Color 'Green'
    } else {
        Write-ColorOutput "ERROR: Report not found, please run tests first" -Color 'Red'
    }
}

function Generate-TestData {
    param([string]$Type = 'standard')
    
    Write-ColorOutput "`nGenerating test data ($Type)..." -Color 'Cyan'
    
    try {
        switch ($Type) {
            'minimal' {
                npm run db:seed:minimal
            }
            'standard' {
                npm run db:seed:standard
            }
            'comprehensive' {
                npm run db:seed:comprehensive
            }
        }
        Write-ColorOutput "OK: Test data generated" -Color 'Green'
    } catch {
        Write-ColorOutput "ERROR: Generation failed: $($_.Exception.Message)" -Color 'Red'
    }
}

function Show-Help {
    Clear-Host
    Write-ColorOutput "===== Management Backend Compatibility Test Tool - Help =====" -Color 'Cyan'
    Write-Host ""
    Write-ColorOutput "OVERVIEW:" -Color 'Blue'
    Write-Host "This tool comprehensively tests the compatibility between the management backend and API/Database."
    Write-Host ""
    Write-Host "TEST ITEMS:"
    Write-Host "  - API interface compatibility"
    Write-Host "  - Database consistency verification"
    Write-Host "  - Functional availability testing"
    Write-Host "  - Frontend component integrity"
    Write-Host ""
    
    Write-ColorOutput "QUICK START:" -Color 'Blue'
    Write-Host "  1. Start backend: npm run dev"
    Write-Host "  2. Initialize DB: npm run admin:setup"
    Write-Host "  3. Run tests: npm run test:admin"
    Write-Host ""
    
    Write-ColorOutput "COMMON COMMANDS:" -Color 'Blue'
    Write-Host "  npm run dev                 Start backend"
    Write-Host "  npm run admin:setup         Initialize environment"
    Write-Host "  npm run test:admin          Run full test"
    Write-Host "  npm run test:admin:report   Test and open report"
    Write-Host "  npm run admin:diagnostic    Quick diagnostic"
    Write-Host ""
    
    Write-ColorOutput "TROUBLESHOOTING:" -Color 'Blue'
    Write-Host "  API Connection Failed:"
    Write-Host "    1. Ensure backend is running: npm run dev"
    Write-Host "    2. Check API_URL configuration"
    Write-Host "    3. Check firewall settings"
    Write-Host ""
    Write-Host "  Database Connection Failed:"
    Write-Host "    1. Run migration: npm run db:migrate"
    Write-Host "    2. Generate data: npm run db:seed:standard"
    Write-Host "    3. Verify database is running"
    Write-Host ""
    
    Write-Host "Press Enter to return to menu..."
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Show-Menu {
    while ($true) {
        Show-Banner
        
        Write-ColorOutput "Please select an option:" -Color 'Cyan'
        Write-Host ""
        Write-Host "  1. Run full compatibility test"
        Write-Host "  2. Check API connection"
        Write-Host "  3. Check database connection"
        Write-Host "  4. Generate test data"
        Write-Host "  5. View test report"
        Write-Host "  6. Quick diagnostic"
        Write-Host "  7. Help"
        Write-Host "  0. Exit"
        Write-Host ""
        
        $choice = Read-Host "Enter choice (0-7)"
        
        switch ($choice) {
            '1' {
                if (Test-ApiConnection) {
                    Run-FullTest
                } else {
                    Write-ColorOutput "WARNING: API not connected, please start backend first" -Color 'Yellow'
                }
                Read-Host "Press Enter to continue"
            }
            '2' {
                Test-ApiConnection
                Read-Host "Press Enter to continue"
            }
            '3' {
                Test-DatabaseConnection
                Read-Host "Press Enter to continue"
            }
            '4' {
                Write-ColorOutput "`nSelect data size:" -Color 'Cyan'
                Write-Host "  1. minimal   (fast)"
                Write-Host "  2. standard  (recommended)"
                Write-Host "  3. comprehensive (detailed)"
                Write-Host ""
                $seedChoice = Read-Host "Enter choice (1-3)"
                
                switch ($seedChoice) {
                    '1' { Generate-TestData 'minimal' }
                    '2' { Generate-TestData 'standard' }
                    '3' { Generate-TestData 'comprehensive' }
                    default { Write-ColorOutput "Invalid choice" -Color 'Red' }
                }
                Read-Host "Press Enter to continue"
            }
            '5' {
                Show-Report
                Read-Host "Press Enter to continue"
            }
            '6' {
                Write-ColorOutput "`nRunning quick diagnostic..." -Color 'Cyan'
                Test-ApiConnection
                Test-DatabaseConnection
                Read-Host "Press Enter to continue"
            }
            '7' {
                Show-Help
            }
            '0' {
                Write-ColorOutput "`nGoodbye!" -Color 'Cyan'
                exit 0
            }
            default {
                Write-ColorOutput "Invalid choice, please try again" -Color 'Red'
                Read-Host "Press Enter to continue"
            }
        }
    }
}

# Main
if (-not (Test-NodeInstalled)) {
    exit 1
}

if (-not (Install-Dependencies)) {
    exit 1
}

if ($Mode -eq 'interactive') {
    Show-Menu
} else {
    switch ($Mode) {
        'test' {
            Run-FullTest
        }
        'report' {
            Show-Report
        }
        'api' {
            Test-ApiConnection
        }
        'db' {
            Test-DatabaseConnection
        }
        default {
            Show-Banner
            Write-ColorOutput "Unknown mode: $Mode" -Color 'Red'
            Write-Host ""
            Write-Host "Usage:"
            Write-Host "  .\run-admin-test.ps1                  Interactive mode"
            Write-Host "  .\run-admin-test.ps1 -Mode test        Run test"
            Write-Host "  .\run-admin-test.ps1 -Mode report      View report"
            Write-Host "  .\run-admin-test.ps1 -Mode api         Check API"
            Write-Host "  .\run-admin-test.ps1 -Mode db          Check database"
        }
    }
}
