@echo off
echo --- Шаг 1: Настройка базы данных в Supabase ---
echo Устанавливаем библиотеку для работы с БД...
pip install asyncpg
echo Запускаем скрипт создания таблиц...
python backend\setup_supabase.py
echo.
echo --- Шаг 2: Установка клиента Supabase для фронтенда ---
cd frontend
echo Устанавливаем @supabase/supabase-js...
npm install @supabase/supabase-js
cd ..
echo.
echo --- ГОТОВО! Бэкенд настроен. Окно можно закрывать ---
pause
