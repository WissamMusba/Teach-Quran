# Search Policy — MANDATORY (applies to this repo, all sub-agents, and every Agent tool call)
All code discovery MUST use Codebase Memory MCP only: search_graph / query_graph to find, get_code_snippet to read. Do NOT use grep, cat, Glob, ripgrep, or generic Explore/sub-agents for searching. Direct Read is only allowed after MCP has given you the exact file_path and line range. This overrides any other search habit.
Rule for sub-agents: Every Agent prompt you send that involves code discovery MUST include the sentence "MANDATORY: Use Codebase Memory MCP only (search_graph / query_graph / get_code_snippet) — do not use grep/cat/Glob/Explore." and MUST specify subagent_type "general-purpose" (the only type with MCP tools). Any Agent launched without that sentence is a violation.

# Release Workflow (TeachQuran APK)

When the user says "release" / "build APK" / "make a release" (or similar), execute the release pipeline below. Do NOT run it unprompted — only when the user tells you to.

## Version numbering

Each release increments the version number by 1. Check the latest git tag (or existing `TeachQuran-v*.apk` files) to determine the next number, e.g. latest tag `v79` -> build `v80`; after that, `v81`, `v82`, etc. Use the next number consistently in:
- `TeachQuran-v<N>.apk` (APK filename)
- Commit message: `Release v<N>: Package Release v<N> APK`
- Git tag: `v<N>`

Current state as of last check: latest tag `v79` (release `v79` exists) -> next release is **v80**.

## Commands

```powershell
# 1. Clear stale Metro bundler cache (prevents React Native build cache bugs)
Remove-Item -Recurse -Force $env:TEMP\metro-* -ErrorAction SilentlyContinue ;

# 2. Set JDK 17 environment path & build the Android Release APK
#    SPEED RULE: do NOT run `clean` — it wipes all compiled output (dex, native
#    libs, JS bundle, resources) and turns every release into a from-scratch
#    rebuild. Gradle's up-to-date checks + local build cache (org.gradle.caching=true)
#    skip unchanged work, so repeat releases take minutes. Only run `clean` when a
#    build misbehaves with stale-output errors.
$env:JAVA_HOME="C:\Users\wissa\Downloads\jdk17\jdk-17.0.19+10" ;
cd android ;
.\gradlew assembleRelease ;
cd .. ;

# Optional speed flags (NOT part of the default pipeline):
#   --offline                       -> skip dependency checks, fastest repeat builds (only after a full online build succeeded)
#   -PreactNativeArchitectures=arm64-v8a  -> phone-only release (fastest); emulator: =x86_64
#   .\gradlew clean assembleRelease       -> ONLY when a stale-output build error demands it

# 3. Copy the compiled APK binary to the root directory as TeachQuran-v<N>.apk
Copy-Item "android\app\build\outputs\apk\release\app-release.apk" -Destination "TeachQuran-v<N>.apk" -Force ;

# 4. Stage all source code changes AND force-add the APK file (bypassing .gitignore)
git add . ;
git add -f TeachQuran-v<N>.apk ;

# 5. Commit with release message and create/update the git tag 'v<N>'
git commit -m "Release v<N>: Package Release v<N> APK" ;
git tag -f v<N> ;

# 6. Push all new commits and tags directly to GitHub (origin/main)
git push origin main --tags
```

Replace `<N>` with the next version number. Verify the build succeeded before copying/committing (abort on gradle failure).
