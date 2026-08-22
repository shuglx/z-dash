Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class IconExtract {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct SHFILEINFO { public IntPtr hIcon; public int iIcon; public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)] public string szTypeName; }
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes,
    ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);
  public static IntPtr Get(string path, uint sizeFlag) {   // 0x1=large(32) 0x100=small(16) 0x4=shell jumbo(256, 需 0x4000|0x4? 简化用 0x100/0x1)
    var fi = new SHFILEINFO();
    IntPtr h = SHGetFileInfo(path, 0, ref fi, (uint)Marshal.SizeOf(typeof(SHFILEINFO)), 0x100 | 0x1 | sizeFlag);
    return h == IntPtr.Zero ? IntPtr.Zero : fi.hIcon;
  }
  public static IntPtr Jumbo(string path) {
    // SHIL_JUMBO 通过 SHGetImageList 拿系统图像列表再按索引取
    var fi = new SHFILEINFO();
    SHGetFileInfo(path, 0, ref fi, (uint)Marshal.SizeOf(typeof(SHFILEINFO)), 0x4); // SHGFI_SYSICONINDEX
    var iid = new Guid("46EB5926-582E-4017-9FDF-E8998DAA0950"); // IImageList
    IntPtr list;
    var hr = SHGetImageList(0x4, ref iid, out list); // SHIL_JUMBO
    if (hr != 0) return IntPtr.Zero;
    IntPtr icon = IntPtr.Zero;
    var t = Type.GetTypeFromCLSID(typeof(System.Runtime.InteropServices.Marshal).GetType().GUID);
    // 直接 P/Invoke IImageList 无法简单调; 退而求其次返回索引
    return new IntPtr(fi.iIcon);
  }
  [DllImport("shell32.dll")] static extern int SHGetImageList(int iImageList, ref Guid riid, out IntPtr ppv);
}
"@
function MeanDiff($a, $b) {
  $sum = 0.0; $n = 0
  for ($x = 0; $x -lt $a.Width; $x += 2) { for ($y = 0; $y -lt $a.Height; $y += 2) {
    $pa = $a.GetPixel($x, $y); $pb = $b.GetPixel($x, $y)
    $sum += [Math]::Abs($pa.R - $pb.R) + [Math]::Abs($pa.G - $pb.G) + [Math]::Abs($pa.B - $pb.B); $n += 3 } }
  [Math]::Round($sum / $n, 1)
}
$src = [System.Drawing.Image]::FromFile('F:\WorkSpace\z-dash\build\zdash_cyberpunk_logo.jpg')
$exe = 'F:\WorkSpace\z-dash\build\stage\dist\win-unpacked\Z-DASH.exe'
foreach ($flag in @(@{n='small(16)'; f=0}, @{n='large(32)'; f=1})) {
  $h = [IconExtract]::Get($exe, $flag.f)
  if ($h -eq [IntPtr]::Zero) { "$($flag.n): 句柄为空"; continue }
  $got = [System.Drawing.Icon]::FromHandle($h).ToBitmap()
  $s = $got.Width
  $exp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($exp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($src, 0, 0, $s, $s); $g.Dispose()
  "$($flag.n): got=$($s)x$($got.Height) diff=$(MeanDiff $got $exp) (阈值<30 即完整无裁剪)"
  $got.Dispose(); $exp.Dispose()
}
$src.Dispose()
