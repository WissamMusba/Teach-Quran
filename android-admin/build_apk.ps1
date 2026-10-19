$ErrorActionPreference = "Stop"

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$buildTools = "$sdk\build-tools\36.0.0"
$platform = "$sdk\platforms\android-34\android.jar"
$jdk = "C:\Program Files\Android\Android Studio\jbr\bin"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$jdk;$env:PATH"

$rootDir = "c:\Users\wissa\Downloads\SDCA Website\android-admin"
$appDir = "$rootDir\app"
$srcDir = "$appDir\src\main"
$buildDir = "$appDir\build"

Write-Host "--- 1. Cleaning build directory ---"
if (Test-Path $buildDir) { Remove-Item -Recurse -Force $buildDir }
New-Item -ItemType Directory -Force -Path "$buildDir\gen" | Out-Null
New-Item -ItemType Directory -Force -Path "$buildDir\compiled_res" | Out-Null
New-Item -ItemType Directory -Force -Path "$buildDir\classes" | Out-Null
New-Item -ItemType Directory -Force -Path "$buildDir\dex" | Out-Null
New-Item -ItemType Directory -Force -Path "$buildDir\out" | Out-Null

Write-Host "--- 2. Compiling resources with AAPT2 ---"
& "$buildTools\aapt2.exe" compile --dir "$srcDir\res" -o "$buildDir\compiled_res"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "--- 3. Linking resources and generating R.java ---"
$resZip = Get-ChildItem "$buildDir\compiled_res\*.flat" | ForEach-Object { $_.FullName }
& "$buildTools\aapt2.exe" link -I $platform `
    --manifest "$srcDir\AndroidManifest.xml" `
    --java "$buildDir\gen" `
    -o "$buildDir\resources.apk" `
    --auto-add-overlay `
    $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "--- 4. Compiling Java sources with javac ---"
$javaFiles = Get-ChildItem -Path "$srcDir\java", "$buildDir\gen" -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
& "$jdk\javac.exe" -d "$buildDir\classes" -cp $platform -source 8 -target 8 $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "--- 5. Converting bytecode to DEX with D8 ---"
$classFiles = Get-ChildItem -Path "$buildDir\classes" -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& "$buildTools\d8.bat" --min-api 24 --output "$buildDir\dex" --lib $platform $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "--- 6. Creating unaligned APK package ---"
Copy-Item "$buildDir\resources.apk" "$buildDir\unaligned.apk"
$zipExe = "7z"
# Use jar.exe from JDK to add classes.dex into unaligned.apk
Set-Location "$buildDir\dex"
& "$jdk\jar.exe" uf "$buildDir\unaligned.apk" classes.dex
Set-Location $rootDir

Write-Host "--- 7. Aligning APK with zipalign ---"
& "$buildTools\zipalign.exe" -v -p 4 "$buildDir\unaligned.apk" "$buildDir\out\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "--- 8. Creating debug keystore (if needed) & Signing APK ---"
$keystore = "$rootDir\debug.keystore"
if (-not (Test-Path $keystore)) {
    & "$jdk\keytool.exe" -genkey -v -keystore $keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
}

$finalApk = "c:\Users\wissa\Downloads\SDCA-Admin.apk"
& "$buildTools\apksigner.bat" sign --ks $keystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out $finalApk "$buildDir\out\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Write-Host "--- 9. Verifying signed APK ---"
& "$buildTools\apksigner.bat" verify --verbose $finalApk

$apkItem = Get-Item $finalApk
Write-Host "BUILD SUCCESSFUL!"
Write-Host "APK Location: $finalApk"
Write-Host "Size: $([math]::round($apkItem.Length / 1KB, 2)) KB"
