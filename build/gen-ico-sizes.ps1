Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('F:\WorkSpace\z-dash\build\zdash_cyberpunk_logo.jpg')
$out = 'F:\WorkSpace\z-dash\build\.ico-parts'
New-Item -ItemType Directory -Force -Path $out | Out-Null
foreach ($s in 16, 24, 32, 48, 64) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'
  $g.DrawImage($src, 0, 0, $s, $s)
  $g.Dispose()
  $rect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)
  $bd = $bmp.LockBits($rect, 'ReadOnly', 'Format32bppArgb')
  $bytes = [byte[]]::new($bd.Stride * $s)
  [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($bd)
  [System.IO.File]::WriteAllBytes("$out\s$s.bin", $bytes)
  $bmp.Dispose()
}
$b256 = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($b256)
$g.InterpolationMode = 'HighQualityBicubic'
$g.SmoothingMode = 'HighQuality'
$g.DrawImage($src, 0, 0, 256, 256)
$g.Dispose()
$b256.Save("$out\s256.png", [System.Drawing.Imaging.ImageFormat]::Png)
$b256.Dispose()
$src.Dispose()
Get-ChildItem $out | ForEach-Object { "{0}  {1}B" -f $_.Name, $_.Length }
