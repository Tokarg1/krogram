@echo off
echo --- Обновление сайта в облаке (Vercel) ---
echo Сохраняю новый код (переход на Supabase)...
git add .
git commit -m "Migrated to Pure Supabase Serverless"
echo Отправляю код на GitHub...
git push origin main
echo.
echo --- ГОТОВО! ---
echo Теперь Vercel автоматически соберет новую версию,
echo и твой сайт начнет работать без старого сервера!
pause
