@echo off
echo Installing SSH Key for iPhone Siri...

powershell -Command "if (!(Test-Path 'C:\Users\aldhy\.ssh')) { New-Item -ItemType Directory -Path 'C:\Users\aldhy\.ssh' }"
powershell -Command "Set-Content -Path 'C:\Users\aldhy\.ssh\authorized_keys' -Value 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ6uY2GoH6y0qBS1fq6SRXA585k0c7reN7XcvYTgTfyn Shortcuts on Botek'"
powershell -Command "Set-Content -Path 'C:\ProgramData\ssh\administrators_authorized_keys' -Value 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ6uY2GoH6y0qBS1fq6SRXA585k0c7reN7XcvYTgTfyn Shortcuts on Botek'"
powershell -Command "icacls 'C:\ProgramData\ssh\administrators_authorized_keys' /inheritance:r /grant 'Administrators:F' /grant 'SYSTEM:F'"
powershell -Command "Restart-Service sshd"

echo.
echo SUCCESS! SSH Key has been configured completely.
echo You can now test Siri / Shortcuts on your iPhone.
pause

