@echo off
setlocal

:menu
cls
echo ======================================================
echo [KroGram] Control Center
echo ======================================================
echo 1. Start KroGram Normally (Build + Up)
echo 2. Start KroGram with CLEAN DB (Reset Tables)
echo 3. Just Start (No build)
echo 4. Stop All
echo 5. Exit
echo ======================================================
set /p choice="Enter choice (1-5): "

if "%choice%"=="1" goto start_normal
if "%choice%"=="2" goto start_clean
if "%choice%"=="3" goto start_fast
if "%choice%"=="4" goto stop_all
if "%choice%"=="5" exit
goto menu

:start_normal
echo [KroGram] Building and starting...
docker-compose up --build
pause
goto menu

:start_clean
echo.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo WARNING: This will delete ALL messages, users and servers!
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
set /p confirm="Are you sure you want to RESET? (Y/N): "
if /i "%confirm%"=="Y" (
    echo [KroGram] Resetting database volume and starting...
    docker-compose down -v
    docker-compose up --build
) else (
    echo Reset cancelled.
)
pause
goto menu

:start_fast
echo [KroGram] Starting without rebuild...
docker-compose up
pause
goto menu

:stop_all
echo [KroGram] Stopping containers...
docker-compose down
pause
goto menu
