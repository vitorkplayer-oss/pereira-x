@echo off
setlocal
cd /d "%~dp0"
echo.
echo  PEREIRA X - INSTALADOR LOCAL
echo  =============================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado.
  echo Instale a versao LTS em https://nodejs.org/ e execute este arquivo novamente.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm nao encontrado. Reinstale o Node.js LTS.
  pause
  exit /b 1
)
if not exist ".env" (
  echo Criando configuracao local .env...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$secret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)); @('PORT=3001','SESSION_SECRET=' + $secret,'ADMIN_USERNAME=admin','ADMIN_PASSWORD=pereira0818','NODE_ENV=development') | Set-Content -Encoding ascii .env"
  if errorlevel 1 (
    echo ERRO: nao foi possivel criar o arquivo .env.
    pause
    exit /b 1
  )
)
echo Instalando dependencias. Isso pode levar alguns minutos...
call npm install
if errorlevel 1 (
  echo.
  echo ERRO: npm install falhou. Verifique sua internet e tente novamente.
  pause
  exit /b 1
)
echo.
echo Instalacao concluida. Iniciando loja e API...
echo Loja: http://localhost:5173
echo Painel: abra a loja e clique no icone de usuario.
echo Login inicial: admin / pereira0818
echo Para encerrar, pressione Ctrl+C nesta janela.
echo.
call npm run dev
pause
