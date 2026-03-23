# cleanup-src-app.ps1
# Elimina los archivos fantasma en web/src/app/

# Verificar que estamos en la carpeta correcta
if (-not (Test-Path "app" -PathType Container)) {
    Write-Error "Ejecutar desde web/ — no se encontró la carpeta app/"
    exit 1
}

# Archivos a eliminar
$filesToRemove = @(
    "src\app\layout.tsx",
    "src\app\page.tsx"
)

foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "Eliminado: $file" -ForegroundColor Green
    } else {
        Write-Host "No existe: $file" -ForegroundColor Yellow
    }
}

# Eliminar carpeta src/app si está vacía
if (Test-Path "src\app") {
    $remaining = @(Get-ChildItem "src\app" -Recurse -ErrorAction SilentlyContinue)
    if ($remaining.Count -eq 0) {
        Remove-Item "src\app" -Force -Recurse
        Write-Host "Carpeta src/app/ eliminada (estaba vacía)" -ForegroundColor Green
    } else {
        Write-Host "src/app/ aún tiene archivos" -ForegroundColor Yellow
        $remaining | ForEach-Object { Write-Host "  $_" }
    }
}

Write-Host "Limpieza completada" -ForegroundColor Cyan
