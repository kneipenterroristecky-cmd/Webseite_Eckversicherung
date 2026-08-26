<#
.SYNOPSIS
  Richtet einen wiederkehrenden Windows-Task für den Social-Lead-Scout ein
  (Neukundengewinn über soziale Medien, siehe tools/social_lead_scout.md).

.PARAMETER DayOfWeek
  Wochentag des Laufs, Standard: Monday.

.PARAMETER Time
  Uhrzeit im Format HH:mm, Standard: 07:00.

.PARAMETER IntervalWeeks
  Alle wie viele Wochen der Task läuft, Standard: 1 (jede Woche).
  Auf 2 setzen für "alle zwei Wochen" usw.

.EXAMPLE
  .\register_social_lead_scout_task.ps1
  .\register_social_lead_scout_task.ps1 -DayOfWeek Friday -Time "08:30" -IntervalWeeks 2
#>
param(
  [ValidateSet("Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday")]
  [string]$DayOfWeek = "Monday",
  [string]$Time = "07:00",
  [int]$IntervalWeeks = 1
)

$TaskName   = "EckVersicherung-SocialLeadScout"
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$ScriptPath = Join-Path $PSScriptRoot "social_lead_scout.py"
$LogPath    = Join-Path $PSScriptRoot "social_lead_scout.log"

$PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
  Write-Error "Python wurde nicht im PATH gefunden. Bitte Python installieren oder PATH pruefen."
  exit 1
}

$Action = New-ScheduledTaskAction -Execute $PythonExe `
  -Argument "`"$ScriptPath`"" `
  -WorkingDirectory $RepoRoot

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DayOfWeek -At $Time -WeeksInterval $IntervalWeeks

$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description "Sucht woechentlich nach Social-Media-Beitraegen mit Versicherungsbedarf und traegt Treffer ins Google Sheet 'Social-Leads' ein." `
  -Force | Out-Null

Write-Host "Task '$TaskName' eingerichtet: laeuft alle $IntervalWeeks Woche(n) am $DayOfWeek um $Time Uhr."
Write-Host "Log der Läufe (falls per > umgeleitet) bzw. manueller Test:"
Write-Host "  python `"$ScriptPath`" *>> `"$LogPath`""
Write-Host ""
Write-Host "Zum Entfernen: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
