# Starts the WhoAmI server, or restarts it if it is already running, then opens the page.
# Used by the desktop shortcut. Set PORT before running to use a different port.
$ErrorActionPreference = "Stop"
$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$dir = $PSScriptRoot

function Fail($msg) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($msg, "WhoAmI", "OK", "Error") | Out-Null
  exit 1
}

try {
  $node = (Get-Command node).Source
} catch { Fail "Node.js was not found. Install Node.js 18 or newer." }

# Stop the old server, but only if it is a WhoAmI server and not some other program on the port.
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ($proc.CommandLine -notmatch "server\.js") {
    Fail "Port $port is used by another program ($($proc.Name)), so the server was not started."
  }
  Stop-Process -Id $listener.OwningProcess -Force
  Start-Sleep -Milliseconds 500
}

$env:PORT = $port
Start-Process $node -ArgumentList "server.js" -WorkingDirectory $dir -WindowStyle Hidden

# Wait until the port accepts connections, then open the page. A plain TCP check,
# because Invoke-WebRequest in Windows PowerShell can go through a system proxy.
$up = $false
for ($i = 0; $i -lt 30 -and -not $up; $i++) {
  $tcp = New-Object System.Net.Sockets.TcpClient
  try { $tcp.Connect("127.0.0.1", $port); $up = $true } catch { Start-Sleep -Milliseconds 300 } finally { $tcp.Close() }
}
if (-not $up) { Fail "The server did not start on port $port." }
Start-Process "http://localhost:$port/"
