# Original geometric Cyber Runner mark, rendered without external image assets.
Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '..\desktop'
$bitmap = New-Object System.Drawing.Bitmap 256,256
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(11,19,25))
$cyan = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(31,226,217)),18
$cyan.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$cyan.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawArc($cyan,43,43,170,170,45,270)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(241,249,250))
$bolt = [System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(145,65), [System.Drawing.Point]::new(100,135),
  [System.Drawing.Point]::new(135,135), [System.Drawing.Point]::new(113,193),
  [System.Drawing.Point]::new(181,112), [System.Drawing.Point]::new(145,112))
$g.FillPolygon($white,$bolt)
$png = Join-Path $iconRoot 'icon.png'
$bitmap.Save($png,[System.Drawing.Imaging.ImageFormat]::Png)
$bytes = [System.IO.File]::ReadAllBytes($png)
$stream = [System.IO.File]::Create((Join-Path $iconRoot 'icon.ico'))
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32)
$writer.Write([uint32]$bytes.Length); $writer.Write([uint32]22); $writer.Write($bytes)
$writer.Dispose(); $g.Dispose(); $bitmap.Dispose(); $cyan.Dispose(); $white.Dispose()
