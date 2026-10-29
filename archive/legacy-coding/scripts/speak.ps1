$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$memory = [System.IO.MemoryStream]::new()
try {
  $voices = @($synth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { $_.VoiceInfo.Name })
  $preferred = if ($request.role -eq 'builder') { 'David|Mark|George' } elseif ($request.role -eq 'inspector') { 'Hazel|Susan|Zira' } else { 'Zira|Hazel|Susan' }
  $voice = $voices | Where-Object { $_ -match $preferred } | Select-Object -First 1
  if ($voice) { $synth.SelectVoice($voice) }
  $synth.Rate = if ($request.role -eq 'builder') { -1 } else { 0 }
  $synth.SetOutputToWaveStream($memory)
  $synth.Speak([string]$request.text)
  $synth.SetOutputToNull()
  [Console]::Out.Write([Convert]::ToBase64String($memory.ToArray()))
} finally { $synth.Dispose(); $memory.Dispose() }
