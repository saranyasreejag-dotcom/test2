@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
node backend/scripts/migrate.js %*
pause
