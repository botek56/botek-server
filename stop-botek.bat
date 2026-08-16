@echo off
echo Stopping BOTEK Server and Cloudflare Tunnel via PM2...

cd /d D:\BOTEK
npx pm2 stop all

schtasks /run /tn "BotekNotifyOff"

echo Done! Server stopped.
