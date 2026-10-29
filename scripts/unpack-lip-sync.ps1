param([Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
$toolRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.sovereign/tools'))
$archivePath=[IO.Path]::GetFullPath($Archive)
$destinationPath=[IO.Path]::GetFullPath($Destination)
if(-not $archivePath.StartsWith($toolRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or -not $destinationPath.StartsWith($toolRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Lip-sync tool paths must stay inside this workspace tool folder.'}
Expand-Archive -LiteralPath $archivePath -DestinationPath $destinationPath
