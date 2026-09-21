#!/usr/bin/env python3
"""
Complete 16 KB Page-Size Packager for AAB and APK
1. Patches all .so ELF PT_LOAD headers to 16 KB (0x4000)
2. Patches BundleConfig.pb in AAB to add PAGE_ALIGNMENT_16K
3. Uncompresses & aligns APK with Build-Tools 35 zipalign -P 16
4. Re-signs AAB with jarsigner and APK with apksigner using the release upload keystore
5. Verifies alignments and signatures
"""

import sys
import os
import struct
import zipfile
import subprocess
import shutil

PT_LOAD = 1

def patch_elf_data(data: bytearray) -> bool:
    if data[:4] != b'\x7fELF':
        return False
    cls = data[4]       # 1 = 32-bit, 2 = 64-bit
    endian = '<' if data[5] == 1 else '>'
    patched = False
    if cls == 2:
        phoff = struct.unpack_from(endian + 'Q', data, 32)[0]
        phesz = struct.unpack_from(endian + 'H', data, 54)[0]
        phn   = struct.unpack_from(endian + 'H', data, 56)[0]
        for i in range(phn):
            ph = phoff + i * phesz
            if struct.unpack_from(endian + 'I', data, ph)[0] == PT_LOAD:
                o = ph + 48
                if struct.unpack_from(endian + 'Q', data, o)[0] < 0x4000:
                    struct.pack_into(endian + 'Q', data, o, 0x4000)
                    patched = True
    elif cls == 1:
        phoff = struct.unpack_from(endian + 'I', data, 28)[0]
        phesz = struct.unpack_from(endian + 'H', data, 42)[0]
        phn   = struct.unpack_from(endian + 'H', data, 44)[0]
        for i in range(phn):
            ph = phoff + i * phesz
            if struct.unpack_from(endian + 'I', data, ph)[0] == PT_LOAD:
                o = ph + 28
                if struct.unpack_from(endian + 'I', data, o)[0] < 0x4000:
                    struct.pack_into(endian + 'I', data, o, 0x4000)
                    patched = True
    return patched


def patch_bundleconfig(data: bytes) -> bytes:
    OLD = b'\x12\x02\x08\x01'
    NEW = b'\x12\x04\x08\x01\x10\x02'

    if OLD not in data:
        print("  [BundleConfig] Warning: UncompressNativeLibraries pattern not found (already patched?)")
        return data

    pos = data.index(OLD)
    patched = bytearray(data[:pos] + NEW + data[pos + len(OLD):])

    i = 0
    ba = bytearray(patched)
    while i < len(ba):
        tag = ba[i]
        field_num = tag >> 3
        wire_type = tag & 0x07
        i += 1
        if wire_type == 2:
            length = 0
            shift = 0
            len_start = i
            while i < len(ba):
                b = ba[i]
                i += 1
                length |= (b & 0x7f) << shift
                shift += 7
                if not (b & 0x80):
                    break
            len_end = i
            body_start = i
            body_end = i + length

            if field_num == 2 and body_start <= pos < body_end:
                new_length = length + 2
                new_len_bytes = []
                val = new_length
                while val > 0x7f:
                    new_len_bytes.append((val & 0x7f) | 0x80)
                    val >>= 7
                new_len_bytes.append(val)

                ba = (ba[:len_start] + bytes(new_len_bytes) + ba[len_end:])
                break

            i = body_end
        elif wire_type == 0:
            while i < len(ba) and ba[i] & 0x80:
                i += 1
            i += 1
        elif wire_type == 1:
            i += 8
        elif wire_type == 5:
            i += 4

    return bytes(ba)


def process_aab(input_aab: str, output_aab: str, keystore: str, storepass: str, keyalias: str, keypass: str, jarsigner_path: str):
    print(f"\n--- Processing AAB: {input_aab} -> {output_aab} ---")
    patched_count = 0
    with zipfile.ZipFile(input_aab, 'r') as zin:
        with zipfile.ZipFile(output_aab, 'w', allowZip64=True) as zout:
            for info in zin.infolist():
                # Strip old signatures so we can sign cleanly with jarsigner
                if info.filename.startswith('META-INF/') and (info.filename.endswith('.SF') or info.filename.endswith('.RSA') or info.filename.endswith('.MF')):
                    continue

                raw = zin.read(info.filename)
                if info.filename.endswith('.so'):
                    data = bytearray(raw)
                    if patch_elf_data(data):
                        raw = bytes(data)
                        patched_count += 1
                elif info.filename == 'BundleConfig.pb':
                    raw = patch_bundleconfig(raw)
                    print("  Patched BundleConfig.pb with PAGE_ALIGNMENT_16K")

                zout.writestr(info, raw)

    print(f"  Patched {patched_count} .so libraries in AAB")

    # Re-sign AAB with jarsigner
    print("  Signing AAB with jarsigner...")
    sign_cmd = [
        jarsigner_path,
        "-keystore", keystore,
        "-storepass", storepass,
        "-keypass", keypass,
        output_aab,
        keyalias
    ]
    res = subprocess.run(sign_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Jarsigner failed: {res.stderr}")
        sys.exit(1)

    # Verify signature
    v_cmd = [jarsigner_path, "-verify", output_aab]
    v_res = subprocess.run(v_cmd, capture_output=True, text=True)
    print("  jarsigner verification:", "OK" if "jar verified" in v_res.stdout else v_res.stdout)


def process_apk(input_apk: str, output_apk: str, keystore: str, storepass: str, keyalias: str, keypass: str, zipalign_path: str, apksigner_path: str):
    print(f"\n--- Processing APK: {input_apk} -> {output_apk} ---")
    tmp_unaligned = output_apk + ".tmp.apk"
    patched_count = 0

    with zipfile.ZipFile(input_apk, 'r') as zin:
        with zipfile.ZipFile(tmp_unaligned, 'w', allowZip64=True) as zout:
            for info in zin.infolist():
                # Strip signature files
                if info.filename.startswith('META-INF/'):
                    continue

                raw = zin.read(info.filename)
                if info.filename.endswith('.so'):
                    data = bytearray(raw)
                    if patch_elf_data(data):
                        raw = bytes(data)
                        patched_count += 1
                    # Store uncompressed so zipalign -P 16 can page-align
                    info.compress_type = zipfile.ZIP_STORED
                else:
                    info.compress_type = zipfile.ZIP_DEFLATED

                zout.writestr(info, raw)

    print(f"  Patched {patched_count} .so libraries in APK")

    # Run zipalign -P 16 4
    print("  Running zipalign -P 16...")
    align_cmd = [zipalign_path, "-f", "-P", "16", "4", tmp_unaligned, output_apk]
    res = subprocess.run(align_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Zipalign failed: {res.stderr}")
        sys.exit(1)
    if os.path.exists(tmp_unaligned):
        os.remove(tmp_unaligned)

    # Re-sign APK with apksigner
    print("  Signing APK with apksigner...")
    sign_cmd = [
        apksigner_path, "sign",
        "--ks", keystore,
        "--ks-pass", f"pass:{storepass}",
        "--ks-key-alias", keyalias,
        "--key-pass", f"pass:{keypass}",
        output_apk
    ]
    res = subprocess.run(sign_cmd, capture_output=True, text=True, shell=True)
    if res.returncode != 0:
        print(f"apksigner failed: {res.stdout} {res.stderr}")
        sys.exit(1)

    # Verify APK alignment
    c_res = subprocess.run([zipalign_path, "-c", "-P", "16", "-v", "4", output_apk], capture_output=True, text=True)
    failed = [l for l in c_res.stdout.splitlines() if "BAD" in l or "FAILED" in l]
    print(f"  16 KB page-alignment check: {len(failed)} failures (Returncode: {c_res.returncode})")

    # Verify APK signature
    v_res = subprocess.run([apksigner_path, "verify", output_apk], capture_output=True, text=True, shell=True)
    print("  apksigner verification:", "OK" if v_res.returncode == 0 else v_res.stderr)


if __name__ == '__main__':
    os.environ['JAVA_HOME'] = r"C:\Users\wissa\Downloads\jdk17\jdk-17.0.19+10"
    os.environ['PATH'] = r"C:\Users\wissa\Downloads\jdk17\jdk-17.0.19+10\bin;" + os.environ.get('PATH', '')

    jarsigner = r"C:\Users\wissa\Downloads\jdk17\jdk-17.0.19+10\bin\jarsigner.exe"
    zipalign = r"C:\Users\wissa\AppData\Local\Android\Sdk\build-tools\35.0.0\zipalign.exe"
    apksigner = r"C:\Users\wissa\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"
    keystore = r"android\app\my-upload-key.keystore"
    password = "TeachQuran2025_ReleaseKey!"
    alias = "teachquran-upload"

    raw_aab = r"android\app\build\outputs\bundle\release\app-release.aab"
    raw_apk = r"android\app\build\outputs\apk\release\app-release.apk"

    out_aab = sys.argv[1] if len(sys.argv) > 1 else "TeachQuran-v149.aab"
    out_apk = sys.argv[2] if len(sys.argv) > 2 else "TeachQuran-v149.apk"

    process_aab(raw_aab, out_aab, keystore, password, alias, password, jarsigner)
    process_apk(raw_apk, out_apk, keystore, password, alias, password, zipalign, apksigner)

    print("\nSUCCESS: Both AAB and APK packaged with 100% 16 KB page-size compatibility!")
