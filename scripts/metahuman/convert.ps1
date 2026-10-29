param(
  [string]$EngineRoot='D:\Epic\UE_5.8',
  [string]$Blender='C:\Program Files\Blender Foundation\Blender 4.5\blender.exe'
)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$buildRoot=Join-Path $repoRoot '.sovereign\asset-build\metahuman'
$pluginRoot=Join-Path $EngineRoot 'Engine\Plugins\Marketplace\MetaHumanCrowdSample_5.8'
if(!(Test-Path -LiteralPath (Join-Path $pluginRoot 'MetaHumanCrowdContent.uplugin'))){throw 'Install the licensed Epic MetaHuman Crowd Sample through Epic Games Launcher first.'}
if(!(Test-Path -LiteralPath $Blender)){throw 'Specify the Blender executable.'}
New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Authoring') -Destination $buildRoot -Recurse -Force
$project=Join-Path $buildRoot 'Authoring\MetaHumanExport.uproject'
$settings=Get-Content -LiteralPath $project -Raw | ConvertFrom-Json
$settings.AdditionalPluginDirectories=@($pluginRoot.Replace('\','/'))
$settings | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $project -Encoding utf8
$env:GOC_METAHUMAN_SOURCE=$pluginRoot
$env:GOC_METAHUMAN_OUTPUT=Join-Path $buildRoot 'source'
& (Join-Path $EngineRoot 'Engine\Build\BatchFiles\Build.bat') MetaHumanExportEditor Win64 Development "-Project=$project" -WaitMutex -NoHotReloadFromIDE -MaxParallelActions=1 -NoUBA
if($LASTEXITCODE){throw 'The Unreal authoring helper did not compile. Check the Visual Studio C++ and .NET Framework 4.8 SDK installation.'}
& (Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe') $project -run=pythonscript "-script=$(Join-Path $PSScriptRoot 'export_unreal.py')" -NullRHI -nosound -unattended -nosplash -NoLiveCoding -NoShaderCompile -stdout -FullStdOutLogOutput
if($LASTEXITCODE){throw 'Unreal export failed.'}
$report=Get-Content -LiteralPath (Join-Path $env:GOC_METAHUMAN_OUTPUT 'export-report.json') -Raw | ConvertFrom-Json
if(!$report.success -or $report.error){throw 'Unreal did not finish the native facial bake. Inspect export-report.json.'}
& $Blender --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'assemble_blender.py') -- $env:GOC_METAHUMAN_OUTPUT (Join-Path $buildRoot 'epic-average-male-01.glb')
if($LASTEXITCODE){throw 'Blender assembly failed. Do not import the previous output.'}
Write-Output 'Conversion finished. Review geometry, facial articulation and clothing in the real browser before importing a new immutable model ID.'
