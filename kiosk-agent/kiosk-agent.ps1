# 키오스크 PC(Windows)에서 백그라운드로 계속 돌면서, store-solution 서버에
# "원격 명령이 왔는지" 주기적으로 물어보다가(폴링) 실제로 실행하는 에이전트.
#
# 브라우저(/kiosk/[id] 화면)는 보안상 자기 자신이 떠 있는 컴퓨터를 재시작/종료할 수
# 없다 — 이건 모든 브라우저의 공통된 제약이라 우회할 방법이 없다. 그래서 이 스크립트가
# 그 일을 대신한다: 컴퓨터 자체에서 돌고, 필요하면 OS 명령(shutdown.exe)을 직접 호출한다.
#
# 하는 일
# - 30초마다 상태 확인(= 생존 신호). 5분 넘게 신호가 끊기면 관리자 화면에 "응답 없음" 알림이 뜬다.
# - 원격 명령: 다시 로그인(브라우저 세션 초기화 후 재실행) / 상태 점검 / 프로그램·기기 재시작 / 종료
# - 30분마다(그리고 "상태 점검" 명령 시) 기기 상태를 점검해 서버로 보고 — 이상이 있으면 알림
# - 키오스크 화면(브라우저)이 꺼져 있으면 다시 띄우고, 그 사실을 오류로 보고
#
# 설정 방법은 같은 폴더의 README.md를 참고하세요.

param(
  [string]$KioskId = "여기에-키오스크-ID-입력",
  [string]$ApiBase = "https://store-solution-one.vercel.app",
  [string]$BrowserPath = "C:\Program Files\Google\Chrome\Application\chrome.exe",
  # 키오스크 전용 브라우저 프로필 — "다시 로그인" 때 이 폴더만 지워서 세션을 초기화한다.
  [string]$ProfileDir = "C:\kiosk-agent\chrome-profile"
)

$AgentVersion = "2"
$KioskUrl = "$ApiBase/kiosk/$KioskId"
$StateUrl = "$ApiBase/api/kiosk/$KioskId/state?hb=agent"
$HealthUrl = "$ApiBase/api/kiosk/$KioskId/health"
$ErrorUrl = "$ApiBase/api/kiosk/$KioskId/errors"
$PollSeconds = 30
$HealthEveryMinutes = 30

$lastCommandAt = $null
$lastRebootDate = $null
$lastHealthAt = [datetime]::MinValue

function Get-KioskBrowser {
  # 키오스크 전용 프로필로 띄운 크롬만 찾는다(다른 크롬 창은 건드리지 않음).
  Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$ProfileDir*" }
}

function Start-KioskBrowser {
  if (-not (Get-KioskBrowser)) {
    Start-Process -FilePath $BrowserPath -ArgumentList "--kiosk", "--user-data-dir=`"$ProfileDir`"", "--no-first-run", "`"$KioskUrl`""
    return $true
  }
  return $false
}

function Stop-KioskBrowser {
  Get-KioskBrowser | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

function Restart-KioskBrowser {
  Stop-KioskBrowser
  Start-KioskBrowser | Out-Null
}

# 다시 로그인 — 브라우저를 끄고 쿠키·세션·저장소가 들어 있는 전용 프로필을 지운 뒤 새로 띄운다.
function Reset-KioskSession {
  Stop-KioskBrowser
  if (Test-Path $ProfileDir) {
    Remove-Item -Path $ProfileDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Start-KioskBrowser | Out-Null
}

function Send-Json($Url, $Body) {
  try {
    $json = $Body | ConvertTo-Json -Depth 4 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json; charset=utf-8" -Body $bytes -TimeoutSec 15 | Out-Null
  } catch {
    # 보고 실패는 다음 주기에 다시 시도
  }
}

function Report-Error($Message, $Device) {
  Send-Json $ErrorUrl @{ message = $Message; device = $Device }
}

# 상태 점검 — 서버 응답, 디스크, 메모리, CPU, 화면 실행 여부, 연결 장치(PnP) 오류를 확인한다.
function Send-HealthReport {
  $problems = @()

  $networkMs = $null
  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-RestMethod -Uri $StateUrl -TimeoutSec 10 | Out-Null
    $networkMs = [int]$sw.ElapsedMilliseconds
  } catch { }

  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
  $memUsed = $null; $uptime = $null
  if ($os) {
    $memUsed = [math]::Round((1 - ($os.FreePhysicalMemory / $os.TotalVisibleMemorySize)) * 100, 1)
    $uptime = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
  }

  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID = 'C:'" -ErrorAction SilentlyContinue
  $diskFree = if ($disk) { [math]::Round($disk.FreeSpace / 1GB, 1) } else { $null }

  $cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average
  if ($null -ne $cpu) { $cpu = [math]::Round($cpu, 1) }

  # 장치 관리자에서 오류 상태인 장치(프린터·결제 단말·현금 방출기 등 USB/시리얼 장치 포함)
  $deviceErrors = @()
  try {
    $deviceErrors = @(Get-PnpDevice -PresentOnly -Status ERROR -ErrorAction Stop | Select-Object -First 10 | ForEach-Object { $_.FriendlyName })
  } catch { }

  $browserRunning = [bool](Get-KioskBrowser)

  Send-Json $HealthUrl @{
    uptime_hours = $uptime
    cpu_percent = $cpu
    memory_used_percent = $memUsed
    disk_free_gb = $diskFree
    browser_running = $browserRunning
    network_ms = $networkMs
    device_errors = $deviceErrors
    problems = $problems
    agent_version = $AgentVersion
  }
}

# 부팅 직후 한 번 — 화면이 아직 안 떠 있으면 띄운다.
Start-Sleep -Seconds 15
Start-KioskBrowser | Out-Null

while ($true) {
  try {
    $state = Invoke-RestMethod -Uri $StateUrl -TimeoutSec 10 -ErrorAction Stop

    if ($state.remote_command_at -and $state.remote_command_at -ne $lastCommandAt) {
      $firstPoll = ($null -eq $lastCommandAt)
      $lastCommandAt = $state.remote_command_at
      # 에이전트가 막 켜졌을 때 남아 있던 예전 명령(예: 어제 보낸 "기기 종료")을 다시 실행하지 않는다.
      if (-not $firstPoll) {
        switch ($state.remote_command) {
          "relogin"         { Reset-KioskSession }
          "health_check"    { Send-HealthReport; $lastHealthAt = Get-Date }
          "restart_program" { Restart-KioskBrowser }
          "restart_device"  { shutdown.exe /r /t 5 /c "store-solution 원격 명령으로 재시작합니다." }
          "shutdown_device" { shutdown.exe /s /t 5 /c "store-solution 원격 명령으로 종료합니다." }
          # "refresh"는 브라우저 화면 자체가 폴링해서 처리하므로 여기서는 할 일이 없다.
        }
      }
    }

    if ($state.daily_reboot_time) {
      $today = (Get-Date).ToString("yyyy-MM-dd")
      $target = [datetime]::Parse("$today $($state.daily_reboot_time)")
      if ((Get-Date) -ge $target -and $lastRebootDate -ne $today) {
        $lastRebootDate = $today
        shutdown.exe /r /t 5 /c "store-solution 예약 재부팅 시각이 되어 재시작합니다."
      }
    }

    # 브라우저가 죽어있으면(크래시 등) 다시 띄우고, 오류로 보고한다.
    if (Start-KioskBrowser) {
      Report-Error "키오스크 화면이 꺼져 있어 자동으로 다시 실행했습니다." "키오스크 화면"
    }

    if (((Get-Date) - $lastHealthAt).TotalMinutes -ge $HealthEveryMinutes) {
      Send-HealthReport
      $lastHealthAt = Get-Date
    }
  } catch {
    # 네트워크가 잠깐 끊겨도 스크립트 자체는 죽지 않고 다음 주기에 다시 시도한다.
  }

  Start-Sleep -Seconds $PollSeconds
}
