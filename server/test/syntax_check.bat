@echo off
node --check src/models/Otp.model.js
if errorlevel 1 goto fail
node --check src/services/otp.service.js
if errorlevel 1 goto fail
node --check src/controllers/otp.controller.js
if errorlevel 1 goto fail
node --check src/routes/auth.routes.js
if errorlevel 1 goto fail
node --check src/controllers/auth.controller.js
if errorlevel 1 goto fail
node --check src/utils/sendEmail.js
if errorlevel 1 goto fail
node --check src/index.js
if errorlevel 1 goto fail
echo BACKEND_SYNTAX_OK
goto end
:fail
echo SYNTAX_ERROR
exit /b 1
:end
