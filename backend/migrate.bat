@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
node scripts/migrate.js %*
pause
