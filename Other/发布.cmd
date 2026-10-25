@echo off
setlocal enabledelayedexpansion
set "TD=%TEMP%\serh_build"
if not exist "%TD%" md "%TD%"
for %%F in (*.*.*.user.js) do (
set "FN=%%~nxF"
set "CK=!FN:Search-Engine-Result-Hider_=!"
if "!CK!"=="!FN!" (
set "V=!FN:.user.js=!"
set "S=!V:_= !"
for %%T in (!S!) do set "V=%%T"
copy /y "%%F" "Search-Engine-Result-Hider_!V!.user.js" >nul
set "K="
for /f "tokens=1 delims=:" %%N in ('findstr /o /c:"// ==/UserScript==" "%%F"') do if not defined K if %%N GEQ 1 set "K=%%N"
if defined K (
set /a "KE=K-1"
set "U=file:///%%~fF"
set "U=!U:\=/!"
set "U=!U: =%%20!"
del /q "!TD!\ins.bin" 2>nul
>"!TD!\ins64.tmp" (
echo -----BEGIN CERTIFICATE-----
echo Ly8gQGRvd25sb2FkVVJMICBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5j
echo b20vQ2FydGVhaGVyZS9TZWFyY2gtRW5naW5lLVJlc3VsdC1IaWRlci9tYWluL1Nl
echo YXJjaC1FbmdpbmUtUmVzdWx0LUhpZGVyX2F1dG91cGRhdGUudXNlci5qcwovLyBA
echo dXBkYXRlVVJMICAgIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9D
echo YXJ0ZWFoZXJlL1NlYXJjaC1FbmdpbmUtUmVzdWx0LUhpZGVyL21haW4vU2VhcmNo
echo LUVuZ2luZS1SZXN1bHQtSGlkZXJfYXV0b3VwZGF0ZS51c2VyLmpzCg==
echo -----END CERTIFICATE-----
)
certutil -decode "!TD!\ins64.tmp" "!TD!\ins.bin" >nul
curl -sS -r 0-!KE! "!U!" -o "!TD!\head.tmp"
curl -sS -r !K!- "!U!" -o "!TD!\tail.tmp"
copy /b "!TD!\head.tmp"+"!TD!\ins.bin"+"!TD!\tail.tmp" "Search-Engine-Result-Hider_autoupdate.user.js" >nul
)
)
)
del /q "%TD%" 2>nul
rd "%TD%" 2>nul
