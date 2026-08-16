# Register Windows Scheduled Tasks for BOTEK Server Notifications
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive

$actionOn  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -File "D:\BOTEK\notify.ps1" -Title "BOTEK Server" -Message "🟢 BOTEK Server & Cloudflare Tunnel NOW ONLINE!"'
$actionOff = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -File "D:\BOTEK\notify.ps1" -Title "BOTEK Server" -Message "🔴 BOTEK Server & Cloudflare Tunnel NOW OFFLINE!"'

Register-ScheduledTask -TaskName 'BotekNotifyOn'  -Action $actionOn  -Principal $principal -Force | Out-Null
Register-ScheduledTask -TaskName 'BotekNotifyOff' -Action $actionOff -Principal $principal -Force | Out-Null

Write-Host "✅ Scheduled tasks 'BotekNotifyOn' & 'BotekNotifyOff' registered successfully!"
