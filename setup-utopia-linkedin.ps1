# ============================================================
#  setup-utopia-linkedin.ps1
#  Run this script in PowerShell (as yourself, not as Admin)
#  It will: create the GitHub repo, set up .gitignore,
#  create .github/workflows/, init git, and push everything.
# ============================================================

$ErrorActionPreference = "Stop"

# ── CONFIG ──────────────────────────────────────────────────
$GITHUB_TOKEN    = "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"
$GITHUB_USERNAME = "mesigetu7"
$REPO_NAME       = "utopia-linkedin"
$PROJECT_PATH    = "C:\Users\KB\OneDrive\Documents\Claude\utopia-linkedin"
# ────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Utopia LinkedIn - GitHub Setup Script " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# STEP 1: Check Git is installed
Write-Host "[1/6] Checking Git installation..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>&1
    Write-Host "      Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "  ERROR: Git is not installed on this machine." -ForegroundColor Red
    Write-Host "  Please install Git from: https://git-scm.com/download/win" -ForegroundColor Red
    Write-Host "  After installing, re-run this script." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# STEP 2: Create the GitHub repository via API
Write-Host "[2/6] Creating private GitHub repository '$REPO_NAME'..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "token $GITHUB_TOKEN"
    "Accept"        = "application/vnd.github.v3+json"
    "User-Agent"    = "PowerShell-Setup-Script"
}
$body = @{
    name        = $REPO_NAME
    private     = $true
    description = "LinkedIn automation project"
    auto_init   = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod `
        -Uri "https://api.github.com/user/repos" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ContentType "application/json"
    Write-Host "      Repository created: $($response.html_url)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 422) {
        Write-Host "      Repository '$REPO_NAME' already exists on GitHub. Continuing..." -ForegroundColor Yellow
    } else {
        Write-Host "  ERROR creating repository: $_" -ForegroundColor Red
        exit 1
    }
}

# STEP 3: Verify project folder exists
Write-Host "[3/6] Verifying project folder..." -ForegroundColor Yellow
if (-not (Test-Path $PROJECT_PATH)) {
    Write-Host "  ERROR: Project folder not found at: $PROJECT_PATH" -ForegroundColor Red
    Write-Host "  Please check the path and re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host "      Found: $PROJECT_PATH" -ForegroundColor Green
Set-Location $PROJECT_PATH

# STEP 4: Create .gitignore and .github/workflows/
Write-Host "[4/6] Creating .gitignore and .github/workflows/ folder..." -ForegroundColor Yellow

# Create .gitignore (only if it doesn't exist)
$gitignorePath = Join-Path $PROJECT_PATH ".gitignore"
if (-not (Test-Path $gitignorePath)) {
    Set-Content -Path $gitignorePath -Value ".env" -Encoding UTF8
    Write-Host "      .gitignore created (contains: .env)" -ForegroundColor Green
} else {
    # Make sure .env is in it
    $existing = Get-Content $gitignorePath
    if ($existing -notcontains ".env") {
        Add-Content -Path $gitignorePath -Value "`n.env"
        Write-Host "      .gitignore updated to include .env" -ForegroundColor Green
    } else {
        Write-Host "      .gitignore already contains .env - no changes needed" -ForegroundColor Green
    }
}

# Create .github/workflows/ directory
$workflowsDir = Join-Path $PROJECT_PATH ".github\workflows"
if (-not (Test-Path $workflowsDir)) {
    New-Item -ItemType Directory -Path $workflowsDir -Force | Out-Null
    Write-Host "      Created folder: .github\workflows\" -ForegroundColor Green
} else {
    Write-Host "      Folder .github\workflows\ already exists" -ForegroundColor Green
}

# STEP 5: Check if post.yml needs to be moved
$postYmlSource = Join-Path $PROJECT_PATH "post.yml"
$postYmlDest   = Join-Path $workflowsDir "post.yml"
if (Test-Path $postYmlSource) {
    if (-not (Test-Path $postYmlDest)) {
        Move-Item -Path $postYmlSource -Destination $postYmlDest
        Write-Host "      Moved post.yml -> .github\workflows\post.yml" -ForegroundColor Green
    } else {
        Write-Host "      post.yml already in .github\workflows\ - skipping move" -ForegroundColor Green
    }
} else {
    Write-Host "      NOTE: post.yml not found in project root yet." -ForegroundColor DarkYellow
    Write-Host "            Drop it into the project folder and the script will pick it up" -ForegroundColor DarkYellow
    Write-Host "            OR manually place it in .github\workflows\ before pushing." -ForegroundColor DarkYellow
}

# STEP 6: Initialise git, commit, and push
Write-Host "[5/6] Initialising Git and making first commit..." -ForegroundColor Yellow

# Safety check: make sure .env won't be pushed
$envFile = Join-Path $PROJECT_PATH ".env"
if (Test-Path $envFile) {
    Write-Host "      .env file detected - it will be excluded by .gitignore (safe)" -ForegroundColor Green
}

# Init git if not already a repo
if (-not (Test-Path (Join-Path $PROJECT_PATH ".git"))) {
    git init
    Write-Host "      Git repository initialised" -ForegroundColor Green
} else {
    Write-Host "      Git already initialised - skipping init" -ForegroundColor Green
}

# Configure remote
$remoteUrl = "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
$existingRemote = git remote 2>&1
if ($existingRemote -contains "origin") {
    git remote set-url origin $remoteUrl
    Write-Host "      Updated remote 'origin'" -ForegroundColor Green
} else {
    git remote add origin $remoteUrl
    Write-Host "      Remote 'origin' added" -ForegroundColor Green
}

# Stage all files (respects .gitignore, so .env is automatically excluded)
git add .

# Verify .env is NOT staged
$stagedFiles = git diff --cached --name-only 2>&1
if ($stagedFiles -contains ".env") {
    Write-Host ""
    Write-Host "  CRITICAL ERROR: .env was about to be committed!" -ForegroundColor Red
    Write-Host "  Aborting. Please check your .gitignore file." -ForegroundColor Red
    git reset HEAD .env
    exit 1
}

Write-Host "      Files staged (excluding .env):" -ForegroundColor Green
$stagedFiles | ForEach-Object { Write-Host "        - $_" -ForegroundColor Gray }

# Commit
git commit -m "Initial commit: utopia-linkedin automation project"

# Set branch to main and push
git branch -M main
Write-Host "[6/6] Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SUCCESS! Your repo is live at:" -ForegroundColor Green
Write-Host "  https://github.com/$GITHUB_USERNAME/$REPO_NAME" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  REMINDER: You can revoke your GitHub token anytime at:" -ForegroundColor DarkYellow
Write-Host "  https://github.com/settings/tokens" -ForegroundColor DarkYellow
Write-Host ""
