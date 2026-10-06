# 키오스크 PC(Windows)에서 백그라운드로 계속 돌면서, store-solution 서버에
# "원격 명령이 왔는지" 주기적으로 물어보다가(폴링) 실제로 실행하는 에이전트.
#
# 브라우저(/kiosk/[id] 화면)는 보안상 자기 자신이 떠 있는 컴퓨터를 재시작/종료할 수
# 없다 — 이건 모든 브라우저의 공통된 제약이라 우회할 방법이 없다. 그래서 이 스크립트가
# 그 일을 대신한다: 컴퓨터 자체에서 돌고, 필요하면 OS 명령(shutdown.exe)을 직접 호출한다.
#
# 설정 방법은 같은 폴더의 README.md를 참고하세요.

param(
  [string]$KioskId = "여기에-키오스크-ID-입력",
  [string]$ApiBase = "https://store-solution-one.vercel.app",
  [string]$BrowserPath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
)

$KioskUrl = "$ApiBase/kiosk/$KioskId"
$StateUrl = "$ApiBase/api/kiosk/$KioskId/state"
$PollSeconds = 30

$lastCommandAt = $null
$lastRebootDate = $null

function Start-KioskBrowser {
  if (-not (Get-Process -Name "chrome" -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $BrowserPath -ArgumentList "--kiosk", "`"$KioskUrl`""
  }
}

function Restart-KioskBrowser {
  Get-Process -Name "chrome" -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
  Start-Process -FilePath $BrowserPath -ArgumentList "--kiosk", "`"$KioskUrl`""
}

# 부팅 직후 한 번 — 화면이 아직 안 떠 있으면 띄운다.
Start-Sleep -Seconds 15
Start-KioskBrowser

while ($true) {
  try {
    $state = Invoke-RestMethod -Uri $StateUrl -TimeoutSec 10 -ErrorAction Stop

    if ($state.remote_command_at -and $state.remote_command_at -ne $lastCommandAt) {
      $lastCommandAt = $state.remote_command_at
      switch ($state.remote_command) {
        "restart_program" { Restart-KioskBrowser }
        "restart_device"  { shutdown.exe /r /t 5 /c "store-solution 원격 명령으로 재시작합니다." }
        "shutdown_device" { shutdown.exe /s /t 5 /c "store-solution 원격 명령으로 종료합니다." }
        # "refresh"는 브라우저 화면 자체가 폴링해서 처리하므로 여기서는 할 일이 없다.
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

    # 브라우저가 죽어있으면(크래시 등) 다시 띄운다.
    Start-KioskBrowser
  } catch {
    # 네트워크가 잠깐 끊겨도 스크립트 자체는 죽지 않고 다음 주기에 다시 시도한다.
  }

  Start-Sleep -Seconds $PollSeconds
}
