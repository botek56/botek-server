@echo off
echo Starting BOTEK Server and Cloudflare Tunnel via PM2...

cd /d D:\BOTEK
npx pm2 restart all

schtasks /run /tn "BotekNotifyOn"

echo Done! Both BOTEK server and Cloudflare Tunnel are online.