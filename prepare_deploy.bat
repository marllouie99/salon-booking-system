@echo off
echo ========================================
echo   Salon Booking System - Deploy Prep
echo ========================================
echo.

echo Step 1: Copying environment file...
copy backend\.env.hostinger backend\.env
echo ✓ .env file ready
echo.

echo Step 2: Collecting static files...
cd backend
python manage.py collectstatic --noinput
echo ✓ Static files collected
echo.

cd ..
echo ========================================
echo   Deployment Preparation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Update ALLOWED_HOSTS in backend\.env with your domain
echo 2. Upload backend\ folder to Hostinger
echo 3. Upload frontend\public\ folder to Hostinger
echo 4. Follow QUICK_START_DEPLOY.md for remaining steps
echo.
pause
