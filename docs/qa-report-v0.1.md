# Nova v0.1 — QA Report

> 100 failure scenarios against the current implementation.
> No new features. No redesign. Pure adversarial testing.

---

## 1. Invalid Missions (5)

### 1.1 Empty string with whitespace only
- **Scenario:** `parseGoal("   ")` — message trims to empty string.
- **Expected:** Throws ParseError, mission returns `status: 'failed'`.
- **Current:** Works — `trimmed.length === 0` catches it. Tested.
- **Severity:** Handled.
- **Recovery:** None needed.

### 1.2 Message containing only "three.js" with no actionable intent
- **Scenario:** `parseGoal("three.js")` — keyword matched, projectName = "three-js", language defaults to typescript, bundler defaults to vite.
- **Expected:** Parse succeeds, plan generated, but `npm create vite@latest three-js` creates a project with that name. The user didn't ask for a full project.
- **Current:** Succeeds silently. Misleading to user.
- **Severity:** Minor — low-impact, but UX is confusing.
- **Recovery:** Require minimum message length or detect imperative verbs.

### 1.3 Message with no known framework keyword
- **Scenario:** `parseGoal("Build a React app")` — no "three", "three.js", "threejs" found.
- **Expected:** Throws UnsupportedGoalError, mission fails early.
- **Current:** Works — throws correctly.
- **Severity:** Handled.
- **Recovery:** None needed.

### 1.4 Message that mentions three.js but is actually asking for something else
- **Scenario:** `parseGoal("I don't want Three.js, I want to delete my project")` — keyword matcher matches "three.js" ignoring negation.
- **Expected:** Should detect this is not a project creation request.
- **Current:** Misparses as a Three.js project. Creates project despite user saying they don't want it.
- **Severity:** Medium — executes destructive misunderstanding.
- **Recovery:** Add negative-lookahead or sentiment check in v0.2.

### 1.5 Extremely long message (10,000+ characters)
- **Scenario:** User pastes an entire codebase into the message. `process.argv[2]` receives truncated input or a massive string.
- **Expected:** Parser handles gracefully, projectName slug is truncated to 64 chars.
- **Current:** Message is stored in `raw`, slugified. If `message.trim()` is huge, memory usage spikes but no crash. 64-char limit on projectName protects filesystem.
- **Severity:** Minor — performance degradation but no crash.
- **Recovery:** Hard cap on input length (e.g., 1024 chars).

---

## 2. Missing Files (5)

### 2.1 Working directory deleted mid-mission
- **Scenario:** After step-0 creates `my-project/`, external user or process deletes `my-project/` before step-1 runs.
- **Expected:** Step-1 fails with clear error. Mission retries step-1. Retry also fails because directory is gone.
- **Current:** `npm create vite@latest my-project` will fail because the directory doesn't exist. Error message: "Command failed: npm create vite@latest ...". The error is opaque — user won't know the directory was deleted.
- **Severity:** Critical — silent failure with misleading error.
- **Recovery:** Re-create directory before each terminal step if missing. Detect "directory not found" in error output.

### 2.2 node_modules deleted after npm install
- **Scenario:** After step-2 (npm install), user deletes `my-project/node_modules/`. Step-3 (npm install three) may partially succeed.
- **Expected:** Step-3 re-installs three, but missing node_modules causes inconsistent state.
- **Current:** Step-3's `npm install three @types/three` runs npm install which will detect missing deps and re-install. Likely succeeds.
- **Severity:** Medium — inconsistent state, but npm is self-healing.
- **Recovery:** Run `npm install` before targeted installs to restore state.

### 2.3 package.json deleted after Vite scaffold
- **Scenario:** After step-1 creates project, `my-project/package.json` is deleted. Step-2 (npm install) runs without package.json.
- **Expected:** npm install fails with "package.json not found" error.
- **Current:** Step-2 fails with "Command failed: npm install". Error message doesn't indicate missing package.json. Retry fails.
- **Severity:** Critical — mission fails with opaque error. No insight into root cause.
- **Recovery:** Check package.json exists before npm install. Classify "package.json not found" in error output.

### 2.4 tsconfig.json missing for build step
- **Scenario:** If `tsconfig.json` was deleted after step-1, step-7's `npm run build` (which runs `tsc && vite build`) will fail.
- **Expected:** Detect missing tsconfig and provide clear error.
- **Current:** Build fails with TypeScript error, but error message is generic "Command failed: npm run build". User gets no clue about which file is missing.
- **Severity:** Medium — build fails, error is vague.
- **Recovery:** Check critical files exist before build step.

### 2.5 Vite binary missing after successful npm install
- **Scenario:** npm install in step-2 succeeds but the vite binary is corrupted or removed.
- **Expected:** Step-7 fails clearly.
- **Current:** Step-7's `npm run build` calls vite via the npm script. If vite binary is missing, npm will fail but the error is just "Command failed: npm run build". No hint about which binary is missing.
- **Severity:** Medium — build fails, error lacks specificity.
- **Recovery:** Run `npx vite --version` as a pre-check before build.

---

## 3. Network Failures (5)

### 3.1 npm registry unreachable at step-1 (create vite)
- **Scenario:** No internet. `npm create vite@latest` fails to download the create-vite package.
- **Expected:** Step-1 fails, retry happens, retry also fails, mission reports failure with diagnosis "Network error".
- **Current:** `execFileAsync` rejects. Terminal handler catches it, returns `success: false`. Error message: "Command failed: npm create vite@latest ..." with stderr containing network error. Mission retries once, then fails.
- **Severity:** Critical — user has no way to retry later (max 1 retry). Mission aborts permanently.
- **Recovery:** Exponential backoff retry. Detect network errors (ENOTFOUND, ECONNREFUSED) and suggest `--offline` or `npm cache` usage.

### 3.2 npm registry unreachable at step-3 (install three)
- **Scenario:** Network drops after step-2 succeeds, during step-3 npm install three.
- **Expected:** Step-3 fails with network error. Retry also fails.
- **Current:** Same as 3.1 — retries once, then fails. Partial state exists (scaffold created, deps partially installed).
- **Severity:** Critical — leaves project in broken state with no cleanup.
- **Recovery:** Save network errors as retryable. Clean up partial install on failure.

### 3.3 npm registry returns 503 mid-download
- **Scenario:** npm registry returns HTTP 503 during package download. npm retries internally then fails.
- **Expected:** Step fails with registry error. Retry might succeed if registry recovers.
- **Current:** First attempt fails. Retry happens (MAX_RETRIES=1). If registry is still down, mission fails.
- **Severity:** High — single retry might not be enough for transient registry issues.
- **Recovery:** Increase retries to 3 for network-related failures. Add backoff.

### 3.4 DNS resolution failure
- **Scenario:** DNS temporarily fails to resolve `registry.npmjs.org`.
- **Expected:** npm fails with DNS error.
- **Current:** Same as 3.1. Error message is "Command failed: ..." with "ENOTFOUND". User sees no distinction between DNS failure and other network errors.
- **Severity:** Medium — confusing error message.
- **Recovery:** Classify ENOTFOUND in error handler. Suggest "check your internet connection".

### 3.5 Proxy authentication required
- **Scenario:** User is behind a corporate proxy requiring authentication. npm cannot reach registry.
- **Expected:** npm fails with proxy auth error. Mission should detect proxy issues.
- **Current:** Error is generic "Command failed: npm ...". No proxy-specific detection.
- **Severity:** Medium — no actionable guidance for corporate users.
- **Recovery:** Check for proxy-related error codes (ECONNREFUSED, HTTP 407). Suggest `npm config set proxy` and `npm config set https-proxy`.

---

## 4. Permission Errors (5)

### 4.1 No write permission on current working directory
- **Scenario:** User runs Nova from a read-only directory (e.g., `/usr/share/` or `C:\Program Files\`).
- **Expected:** Step-0 `mkdir` fails with EACCES or EPERM. Mission fails with clear error.
- **Current:** `mkdir` throws. Error is caught. Message: "EACCES: permission denied, mkdir '...'". The error is propagated but Windows error codes may differ.
- **Severity:** Critical — mission fails immediately but error message is OS-dependent.
- **Recovery:** Check write permission on cwd before starting mission. Provide actionable error.

### 4.2 No write permission on parent directory of project
- **Scenario:** User has write permission on cwd but not on parent (e.g., cwd is a subdirectory they own, but the project dir creation traverses into a restricted area).
- **Expected:** mkdir fails with permission error.
- **Current:** Same as 4.1 — error caught, mission fails. On Windows, permission errors may manifest as EPERM or EACCES differently.
- **Severity:** High — error message may be unclear on Windows.
- **Recovery:** Use `access` or `fs.constants.W_OK` to pre-check target directory.

### 4.3 npm global permission error (EACCES on node_modules)
- **Scenario:** npm tries to write to a globally-cached package but lacks permissions. On Unix, this often happens with `sudo npm install` anti-patterns.
- **Expected:** npm fails with EACCES. Mission retries, fails.
- **Current:** Terminal handler captures stderr which contains npm's permission error. Error message includes it. Mission fails.
- **Severity:** Medium — error is visible but user might not know how to fix npm permissions.
- **Recovery:** Detect npm EACCES and suggest `npm config set prefix` or using nvm.

### 4.4 Antivirus/firewall blocks npm or node
- **Scenario:** Windows Defender or corporate antivirus blocks `node.exe` from creating subprocesses or npm from making network connections.
- **Expected:** npm spawn fails or is killed silently. Mission fails.
- **Current:** execFile might fail with "The operation was canceled" or similar Windows-specific error. Terminal handler catches it but the error message is OS-specific and potentially misleading.
- **Severity:** Critical — silent kill = mission fails with no actionable error.
- **Recovery:** Detect process kill signals and check antivirus status. Log command that was killed.

### 4.5 Windows 10/11 long path permission (MAX_PATH)
- **Scenario:** Project name slug produces a deep path, or user's cwd is already deep (e.g., `C:\Users\verylongusername\Documents\projects\my-nested-stuff\...`). Combined path exceeds 260 chars.
- **Expected:** Step-0 mkdir fails, or step-4/5/6 write file fails with ENAMETOOLONG.
- **Current:** Filesystem handler calls `mkdir` and `writeFile` directly. On Windows without long-path enabled, these fail with ENAMETOOLONG. Error message: "ENAMETOOLONG: Filename too long". User may not understand.
- **Severity:** High — Windows-specific. Silent failure on path creation.
- **Recovery:** Check combined path length before filesystem operations. Suggest enabling LongPathsEnabled in Windows registry.

---

## 5. Git Failures (5)

### 5.1 Target directory is already a git repo with uncommitted changes
- **Scenario:** `my-project/` already exists with a git repo and dirty working tree. Step-1 `npm create vite@latest my-project -- --template vanilla-ts` tries to scaffold into existing directory.
- **Expected:** If directory exists but is empty, Vite scaffolds. If non-empty, Vite prompts or fails.
- **Current:** Current behavior depends on how `npm create vite@latest` handles existing directories. On modern Vite, it may refuse to scaffold into a non-empty directory. The error from npm will be opaque.
- **Severity:** High — mission fails on existing project with unclear error.
- **Recovery:** Check if target directory exists and is non-empty before step-0. Add `--force` flag or abort with clear message.

### 5.2 Repository cloned into target after step-0
- **Scenario:** Between step-0 (mkdir) and step-1 (create vite), user or external process does `git clone` into `my-project/`, populating it.
- **Expected:** Step-1 detects non-empty directory and fails gracefully.
- **Current:** `npm create vite@latest` will fail if the target directory is non-empty. Mission fails with retry, then aborts. No cleanup.
- **Severity:** High — race condition between steps.
- **Recovery:** Check directory is empty before step-1. Offer to remove conflicting files.

### 5.3 User runs `git init` in project dir after scaffold
- **Scenario:** Between step-1 and step-2, user initializes git. This doesn't break anything but pollutes the project with untracked files from npm install.
- **Expected:** No failure, but the git repo now contains node_modules.
- **Current:** No issue — .gitignore from Vite template handles node_modules. Not a failure scenario per se, but the git history is uncontrolled.
- **Severity:** Minor — cosmetic, not a failure.
- **Recovery:** N/A — user action, outside Nova's control.

### 5.4 Git hooks installed by npm that break build
- **Scenario:** A package installed by npm installs a git hook (e.g., husky, pre-commit) that runs during `npm run build` and fails because git is not configured (no user.name/user.email).
- **Expected:** Build fails due to git hook error.
- **Current:** Build fails with hook error. Error message contains hook output. Mission retries, fails.
- **Severity:** Medium — edge case, depends on transitive dependencies.
- **Recovery:** Set `HUSKY=0` or `GIT_DISABLE_HOOKS=1` environment variable during terminal commands.

### 5.5 .gitignore conflicts with written files
- **Scenario:** If the Vite template generates a `.gitignore` that excludes certain paths, and we write files to those paths, they'd be git-ignored. Not a failure but a user surprise.
- **Expected:** Files are written but invisible to git.
- **Current:** Template's `.gitignore` likely ignores `dist/`. Our files (`vite.config.ts`, `src/main.ts`, `index.html`) are not ignored. No issue.
- **Severity:** Minor — no failure scenario.
- **Recovery:** N/A

---

## 6. npm Failures (5)

### 6.1 npm create vite@latest installs incompatible Vite version
- **Scenario:** `npm create vite@latest` fetches a new major version of create-vite that changes the scaffolding output format (e.g., different file layout, new tooling).
- **Expected:** Our hardcoded templates (vite.config.ts, main.ts) may conflict with the new scaffolding output. Project is in inconsistent state.
- **Current:** We overwrite vite.config.ts, main.ts, and index.html regardless of the template output. Our templates are frozen at v0.1. If Vite changes, our files might be incompatible with the package versions installed.
- **Severity:** Critical — time-bomb. Works today, breaks when Vite releases breaking changes.
- **Recovery:** Pin create-vite version (`npm create vite@5`). Or detect template output version.

### 6.2 npm create vite@latest --template vanilla-ts removed
- **Scenario:** Vite drops the `vanilla-ts` template in a future release.
- **Expected:** Step-1 fails with "unavailable template" error.
- **Current:** `npm create vite@latest my-project -- --template vanilla-ts` fails. Error message: "Command failed: npm create vite@latest ...". No indication that the template was removed.
- **Severity:** Critical — mission completely blocked by external change.
- **Recovery:** Pin template version or fall back to `--template vanilla`.

### 6.3 npm install fails due to package resolution conflict
- **Scenario:** `three` or `@types/three` has a peer dependency conflict with Vite's TypeScript version.
- **Expected:** npm install fails with ERESOLVE. Mission retries, fails.
- **Current:** npm reports ERESOLVE. Stderr contains the conflict tree. Mission fails with this error.
- **Severity:** Medium — error message is visible but long. User may not understand the tree.
- **Recovery:** Add `--legacy-peer-deps` option to npm install commands. Detect ERESOLVE and offer guidance.

### 6.4 npm install hangs indefinitely on a postinstall script
- **Scenario:** A dependency has a `postinstall` script that hangs (e.g., waiting for stdin).
- **Expected:** Step-2 times out after 60s timeout. Retry also times out. Mission fails.
- **Current:** terminal.run sets `timeoutMs` to 60_000. If npm hangs, execFile rejects with timeout error after 60s. Error: "killed = true, code = timed-out". Mission retries (another 60s) then fails. Total: 120s wasted.
- **Severity:** High — user waits 2+ minutes for timeout. No way to cancel.
- **Recovery:** Add cancellation signal. Use shorter timeout for postinstall. Detect hanging processes.

### 6.5 npm audit / fund messages in stderr mistaken for errors
- **Scenario:** npm outputs warnings to stderr (deprecation notices, funding requests, audit messages). These are not errors but appear in stderr.
- **Expected:** The terminal handler should not treat informational stderr as a failure.
- **Current:** The handler matches exit code, not stderr. If exit code is 0, it's a success regardless of stderr content.
- **Severity:** Handled — exit code is the correct signal.
- **Recovery:** None needed, but note that our error message appends stderr to the message string, which may include noise.

---

## 7. Disk Full (5)

### 7.1 Disk full during step-0 (mkdir)
- **Scenario:** Filesystem has no space left. `mkdir` fails with ENOSPC.
- **Expected:** Mission fails with clear "disk full" error.
- **Current:** `mkdir` throws ENOSPC. Error caught in FilesystemHandler. Message: "ENOSPC: no space left on device, mkdir ..." (or Windows equivalent). Mission fails.
- **Severity:** High — error is clear on Unix, but Windows may produce different errors.
- **Recovery:** Check available disk space before mission start. Offer disk cleanup guidance.

### 7.2 Disk full during step-2 (npm install)
- **Scenario:** Disk fills up while npm is extracting packages to node_modules.
- **Expected:** npm fails with ENOSPC. Mission catches and reports.
- **Current:** execFile throws with ENOSPC in stderr. Terminal handler captures it. Mission fails.
- **Severity:** High — npm may leave partial node_modules in inconsistent state.
- **Recovery:** Delete partial node_modules on ENOSPC. Report free space required.

### 7.3 Disk full during step-7 (vite build)
- **Scenario:** Disk fills up during vite build output generation.
- **Expected:** Build fails with disk error.
- **Current:** Same pattern — execFile fails, error caught. Mission fails.
- **Severity:** Medium — partial build output in dist/ directory.
- **Recovery:** Clean up partial build output on failure.

### 7.4 Quota exceeded on network filesystem
- **Scenario:** User is on NFS, SMB, or OneDrive with a storage quota. All filesystem operations fail with EDQUOT (disk quota exceeded).
- **Expected:** All files.create and files.write steps fail with quota error.
- **Current:** Every step fails individually. Mission retries each, then fails. Five+ attempts all hit the same quota issue.
- **Severity:** High — repeated failures for same root cause. Wastes time.
- **Recovery:** Cache the failure cause. If multiple steps fail with EDQUOT, abort immediately without retrying each.

### 7.5 Disk becomes full between retry attempts
- **Scenario:** First attempt fails with ENOSPC. User frees 100MB during the retry window. Retry succeeds.
- **Expected:** Retry succeeds because space was freed.
- **Current:** Works — retry executes the same task, disk now has space, succeeds.
- **Severity:** Handled.
- **Recovery:** None needed.

---

## 8. Existing Project Conflicts (5)

### 8.1 Project directory already exists and is non-empty
- **Scenario:** User runs Nova in a directory that already contains a project. `my-project/` already exists with files.
- **Expected:** Step-1 should detect this and either abort or overwrite with warning.
- **Current:** Step-0 creates the directory (which already exists — `mkdir -p` succeeds silently). Step-1 `npm create vite@latest my-project` will fail if the directory is non-empty. Mission fails with opaque error.
- **Severity:** Critical — no check means user can accidentally corrupt existing projects.
- **Recovery:** Check if target directory exists and is non-empty before step-0. Offer to work in a different location.

### 8.2 Port conflict — Vite dev server port already in use
- **Scenario:** Not applicable — we run `npm run build`, not `npm run dev`. No dev server port conflict for build.
- **Expected:** N/A
- **Current:** N/A
- **Severity:** Not applicable to v0.1.

### 8.3 File lock held by another process prevents file writes
- **Scenario:** Another process (IDE, antivirus, search indexer) has a lock on vite.config.ts or main.ts. Step-4/5/6 write fails.
- **Expected:** Write fails with EBUSY or EACCES. Mission retries (but retryOnce is false for these steps).
- **Current:** `writeFile` throws EBUSY. Error caught. Files.write has `retryOnce: false`, so mission fails immediately. User doesn't know which file is locked.
- **Severity:** High — immediate failure, no retry, no helpful error.
- **Recovery:** Set `retryOnce: true` for files.write steps too. Detect EBUSY and name the locked file.

### 8.4 Conflicting package name with npm registry
- **Scenario:** `my-project` name matches an existing npm package. Not a real failure for project creation.
- **Expected:** No impact.
- **Current:** No impact.
- **Severity:** Not applicable.

### 8.5 Project name uses reserved Windows names (CON, NUL, COM1, etc.)
- **Scenario:** Message is "Create a Three.js project called CON" — slug becomes "con".
- **Expected:** Step-0 `mkdir "con"` fails on Windows because "con" is a reserved device name.
- **Current:** `mkdir con` on Windows throws EPERM or similar. Error message: "EPERM: operation not permitted, mkdir 'con'" (or Windows-specific error). User has no idea why.
- **Severity:** Critical — Windows-specific silent failure with confusing error.
- **Recovery:** Validate project name against Windows reserved names before creating directory.

---

## 9. Partial Execution (5)

### 9.1 Step-2 fails after step-1 succeeded (scaffolded but no deps)
- **Scenario:** npm install (step-2) fails due to network. Project is scaffolded but node_modules is empty.
- **Expected:** Mission reports failure. Project directory remains with scaffolded files.
- **Current:** Mission fails. No cleanup. The directory `my-project/` is left with scaffolded files and no node_modules.
- **Severity:** High — leaves a broken project on disk with no indication that it's incomplete.
- **Recovery:** Clean up project directory on failure, or at minimum log a warning about residual files.

### 9.2 Step-4 (write vite.config.ts) fails after step-3 (npm install three) succeeded
- **Scenario:** Filesystem write fails. Three.js is installed but vite.config.ts is missing.
- **Expected:** Mission reports failure. Build will fail if attempted manually.
- **Current:** Mission fails at step-4. Project has three installed but no vite config. User is left with a project that won't build.
- **Severity:** High — partial state with no indication of what's missing.
- **Recovery:** Mark step-4,5,6 as transactional — either all three write or none.

### 9.3 Step-7 (build) fails after all previous steps succeeded
- **Scenario:** All 7 prior steps succeed. Build fails due to TypeScript error in our main.ts template.
- **Expected:** Mission fails at build verification. Project is otherwise complete.
- **Current:** Mission fails. User has a complete project except it doesn't build. No guidance on what's wrong.
- **Severity:** Medium — project is 95% done, but the last step failed.
- **Recovery:** Offer to skip build verification. Provide build error directly to user.

### 9.4 Step-1 fails after step-0 succeeded
- **Scenario:** mkdir succeeds but Vite scaffold fails (e.g., npm registry error).
- **Expected:** Mission fails. Empty project directory remains.
- **Current:** Empty directory left behind. User has no idea what happened.
- **Severity:** High — empty directory with no explanation.
- **Recovery:** Remove empty directory on failure. Or retry with an empty directory.

### 9.5 Mission succeeds but not all expected files were written
- **Scenario:** A subtle bug causes one of the template writes to silently produce an empty or truncated file. The build might still pass if the file isn't critical.
- **Expected:** Mission reports success but project is missing content.
- **Current:** No file-content verification in v0.1. The executor only checks if the write didn't throw. A 0-byte write would report success.
- **Severity:** Critical — silent data loss. Mission lies about success.
- **Recovery:** Verify written file has non-zero size. Checksum template content vs written content.

---

## 10. Interrupted Execution (5)

### 10.1 Process killed (Ctrl+C / SIGINT) during npm install
- **Scenario:** User presses Ctrl+C while step-2 (npm install) is running.
- **Expected:** npm is killed. Terminal handler returns failure. Mission loop stops.
- **Current:** Ctrl+C kills the entire Node process immediately. The `finally` block in index.ts calls `toolManager.dispose()`. No mission result is returned. Exit code is whatever the OS assigns.
- **Severity:** Critical — process termination leaves no record of failure. No cleanup.
- **Recovery:** Handle SIGINT/SIGTERM gracefully: log current state, return partial MissionResult, clean up.

### 10.2 Process killed during filesystem write
- **Scenario:** Process killed mid-write of vite.config.ts. File is partially written.
- **Expected:** Corrupted file on disk.
- **Current:** If killed mid-write, the file system may have a partial write. On Windows, file locking may prevent partial writes, but not guaranteed.
- **Severity:** High — corrupted file with no detection mechanism.
- **Recovery:** Write to temporary file, then rename. Detect partial files on startup.

### 10.3 Laptop sleeps/hibernates during execution
- **Scenario:** Laptop lid closed during npm install. On resume, npm process may have timed out or failed.
- **Expected:** On resume, the process may still be running (if within timeout) or has been killed by OS.
- **Current:** If the npm process was killed during sleep, execFile returns an error. Terminal handler catches it. Mission fails.
- **Severity:** Medium — mission fails, but no data loss.
- **Recovery:** Detect sleep/wake cycles. Offer to resume from last completed step.

### 10.4 Node.js out of memory during large dependency resolution
- **Scenario:** npm memory usage spikes during dependency resolution for a large project. Node.js dies with "JavaScript heap out of memory".
- **Expected:** execFile fails. Terminal handler catches it.
- **Current:** execFile may crash before returning. The promise rejects. executeTask catches the rejection. Mission fails with "out of memory" error.
- **Severity:** Medium — rare but mission fails.
- **Recovery:** Use `--max-old-space-size` flag for node subprocesses.

### 10.5 Timeout during step-3 (npm install three) — slow network
- **Scenario:** User has a very slow connection. npm install three takes >60s.
- **Expected:** Step-3 times out at 60_000ms. Retry also times out at another 60_000ms. Total wait: 2 minutes.
- **Current:** Both attempts wait the full timeout. 2 minutes of wall time. No way for user to adjust timeout.
- **Severity:** High — user waits 2 minutes for something that would succeed with more time.
- **Recovery:** Make timeout configurable. Detect slow network and auto-extend timeout.

---

## 11. Invalid Paths (5)

### 11.1 Project name with path traversal characters
- **Scenario:** Message: "Create a Three.js project named ../../etc/passwd" — slug parses to "etc-passwd".
- **Expected:** slugify removes dots and slashes. Project name is safe.
- **Current:** slugify replaces `[^a-z0-9]+` with `-`. Dots, slashes, and special chars are removed. `../../etc/passwd` → `etc-passwd`. Safe.
- **Severity:** Handled — slugify acts as sanitizer.
- **Recovery:** None needed.

### 11.2 Project name with Unicode or emoji
- **Scenario:** Message: "Create a Three.js 🎮 project for 🎯" — slug produces "create-a-three-js-project-for".
- **Expected:** Emoji are stripped by slugify regex.
- **Current:** `[^a-z0-9]+` matches emoji (not a-z0-9), replaces with `-`. Works, but project name loses all emoji content.
- **Severity:** Minor — cosmetic loss, not a failure.
- **Recovery:** Acceptable for v0.1.

### 11.3 Project name with only special characters
- **Scenario:** Message: "@#$%^& Create a Three.js project" — slug filters to "create-a-three-js-project".
- **Expected:** Project name is just based on the meaningful words.
- **Current:** Works correctly. Special chars are removed.
- **Severity:** Handled.
- **Recovery:** None needed.

### 11.4 Absolute path in project name
- **Scenario:** `goal-parser.ts` doesn't use paths. The projectName is only used as a directory name by the planner. No absolute path injection possible.
- **Current:** Safe by design — projectName is a slugified string used as a relative directory name.
- **Severity:** Handled.
- **Recovery:** None.

### 11.5 Very deep relative path via multiple nested directories
- **Scenario:** Not applicable — projectName is a single-level directory name. No nested path construction.
- **Current:** Safe.
- **Severity:** Handled.

---

## 12. Dependency Conflicts (5)

### 12.1 three@latest is a breaking change from @types/three
- **Scenario:** `npm install three@latest` installs three v0.200.0, but `@types/three` is at v0.185.1. Type definitions are mismatched.
- **Expected:** npm install may show peer dep warnings. Step-7 build may fail with type errors.
- **Current:** npm install succeeds with warnings. TypeScript build may fail because types are incompatible. Error is "Type error in ..." which the user sees.
- **Severity:** High — build fails due to type mismatch, even though runtime code works.
- **Recovery:** Pin three version to match @types/three. Or install `three@<major>` that aligns.

### 12.2 Vite template installs an incompatible TypeScript version
- **Scenario:** Vite's vanilla-ts template specifies TypeScript 5.7 in its package.json. `three` uses TypeScript 5.5 features. Build fails.
- **Expected:** TypeScript compilation error. Build verification fails.
- **Current:** Step-7 fails. Mission fails. User sees TypeScript error.
- **Severity:** Medium — external incompatibility, Nova can't fix.
- **Recovery:** Override TypeScript version in project after scaffold.

### 12.3 npm global cache has corrupted packages
- **Scenario:** User's npm global cache has a corrupted package. `npm install` hits the cache instead of downloading fresh.
- **Expected:** npm install fails with integrity check error.
- **Current:** npm reports "Integrity check failed" in stderr. Mission fails. No suggestion to use `npm cache clean --force`.
- **Severity:** Medium — mission fails, user has no guidance.
- **Recovery:** Detect integrity errors and suggest `npm cache clean --force`.

### 12.4 package-lock.json from scaffold conflicts with new installs
- **Scenario:** Vite's scaffold generates a `package-lock.json`. Step-3 (npm install three) updates it. Step-7 build might use a different resolution.
- **Expected:** No issue — npm manages lockfile correctly.
- **Current:** Works correctly. Lockfile is updated by subsequent npm commands.
- **Severity:** Handled.

### 12.5 npm audit fix changes dependency tree after install
- **Scenario:** npm install produces warnings about vulnerabilities. npm audit fix modifies package.json and node_modules between steps.
- **Expected:** Not triggered by Nova — we don't run `npm audit fix`.
- **Current:** Not applicable.
- **Severity:** Not applicable.

---

## 13. Windows/Linux/macOS Differences (5)

### 13.1 Path separator: backslash vs forward slash
- **Scenario:** All paths in planner.ts use forward slash (`${p}/vite.config.ts`). On Windows, Node.js handles this correctly with `fs` module, but npm commands may receive mixed paths.
- **Expected:** Forward slashes work in Node.js fs operations on Windows. npm commands may need backslashes for certain operations.
- **Current:** `mkdir`, `writeFile`, `execFile` with `cwd` parameter all handle forward slashes on Windows. However, npm args may contain the project name as a path argument. `npm create vite@latest project-name` works because it's used as a npm argument, not a filesystem path.
- **Severity:** Handled for current operations. Potential issue if any future path is passed as a command-line argument to a Windows tool.
- **Recovery:** Use `path.normalize()` before passing paths to terminal commands.

### 13.2 Shell behavior: cmd.exe vs bash vs PowerShell
- **Scenario:** On Windows, `shell: true` uses `cmd.exe`. On Unix, it uses `/bin/sh`. Command parsing differs between shells.
- **Expected:** Simple commands like `npm run build` work identically. Complex commands may differ.
- **Current:** All terminal commands are simple (`npm` with args). `shell: true` is used on Windows for compatibility. On Unix, shell=false by default (execFile runs directly). This means Windows gets shell-wrapped execution while Unix gets direct exec.
- **Severity:** Medium — asymmetry could cause subtle differences.
- **Recovery:** Test all terminal commands on both platforms. Avoid shell-specific syntax.

### 13.3 npm create vite@latest interactive prompts differ
- **Scenario:** `npm create vite@latest` might show interactive prompts on some platforms or configurations, hanging indefinitely.
- **Expected:** Should run with `--` flag to pass args directly.
- **Current:** We pass `['create', 'vite@latest', p, '--', '--template', 'vanilla-ts']`. The `--` separator ensures Vite gets the template flag. On newer npm versions, `npm create` behaves differently.
- **Severity:** High — npm create behavior has changed across versions. What works on npm 9 may not work on npm 10.
- **Recovery:** Pin npm create version or use `npx create-vite` directly.

### 13.4 Windows Defender slows npm extract to timeout
- **Scenario:** Windows Defender scans every extracted npm package. For large dependency trees, extraction takes >60s, triggering the timeout.
- **Expected:** Step-2 times out even though network is fast. User on Windows with Defender gets false failure.
- **Current:** 60s timeout may be insufficient for Windows+Defender. The install might actually succeed given 90-120s.
- **Severity:** High — Windows users disproportionately affected.
- **Recovery:** Increase npm install timeout to 120s on Windows. Check for Defender interference.

### 13.5 Case-insensitive filesystem issues (macOS)
- **Scenario:** Default macOS filesystem is case-insensitive (APFS). If any file writes conflict in case (e.g., `src/main.ts` vs `src/Main.ts`), behavior differs from Linux.
- **Expected:** No conflicts in v0.1 — all file writes have deterministic paths.
- **Current:** No case conflicts in our templates. Safe.
- **Severity:** Handled.

---

## 14. Tool Runtime Failures (5)

### 14.1 ToolManager.register throws ToolAlreadyRegisteredError
- **Scenario:** If `createNativeToolManager()` is called twice in the same process (e.g., user runs two missions), the second call fails because tools are already registered.
- **Expected:** Second call should create a fresh manager or handle duplicate registration gracefully.
- **Current:** `ToolManager.register()` throws `ToolAlreadyRegisteredError`. The second `createNativeToolManager()` crashes the process.
- **Severity:** Critical — prevents running multiple missions in one process. Crash with unhandled error.
- **Recovery:** Make `createNativeToolManager()` idempotent or wrap registration in try/catch.

### 14.2 ToolManager connection fails silently
- **Scenario:** `manager.connect()` throws or fails. The `void` operator swallows the promise rejection.
- **Expected:** Connection errors should be caught and reported.
- **Current:** Line 248-249: `void manager.connect(FILESYSTEM_TOOL_ID, { kind: 'director' });`. The `void` keyword ignores the promise. If connect fails, the error is an unhandled promise rejection.
- **Severity:** Critical — connection failures are invisible. Tool appears healthy but invoke calls will fail.
- **Recovery:** Await connect promises, or at least catch errors.

### 14.3 ToolManager.dispose races with ongoing invocation
- **Scenario:** A terminal command is running. User Ctrl+C triggers `finally { toolManager.dispose() }`. If dispose runs while invoke is in flight, the handler map is cleared mid-invocation.
- **Expected:** Dispose should wait for active invocations to complete, or cancel them.
- **Current:** `dispose()` clears all handler maps synchronously. Any in-flight `handler.invoke()` calls will fail when they try to access disposed state.
- **Severity:** High — race condition during cleanup could throw unhandled errors.
- **Recovery:** Track active invocations and await them in dispose.

### 14.4 InMemoryEventBus runs out of memory for large payloads
- **Scenario:** A terminal command returns extremely large stdout (megabytes). The event bus publishes this as part of the invocation payload. InMemoryEventBus stores all events in memory.
- **Expected:** Large outputs should not be stored in the event bus.
- **Current:** The event bus receives the result payload containing stdout/stderr. For a 10MB file listing, this is stored in memory. Repeated large commands could exhaust memory.
- **Severity:** Medium — potential OOM for extreme cases.
- **Recovery:** Truncate large outputs before publishing. Stream large outputs to disk.

### 14.5 ToolManager.invoke permission denied despite granted permissions
- **Scenario:** The ToolManager is created with `grantedPermissions: ['fs.read', 'fs.write', 'fs.delete', 'process.spawn', 'system.env']`. But the ToolInvoker checks if the action's required permissions are a subset of granted permissions. If a handler capability lists a permission not in the granted set, the invoke fails with `permission-denied`.
- **Expected:** All required permissions should be in the granted set.
- **Current:** `filesystemCapabilities` lists `['fs.read', 'fs.write']` — these are in the granted set. `terminalCapabilities` lists `['process.spawn', 'system.env']` — also in the granted set. Works currently.
- **Severity:** Handled in v0.1. Fragile if any capability adds new permissions.
- **Recovery:** Audit capability permissions against granted permissions at registration time.

---

## 15. Unexpected Terminal Output (5)

### 15.1 npm outputs ANSI escape codes in stdout/stderr
- **Scenario:** npm uses progress bars and color output. When piped, some versions still emit ANSI codes.
- **Expected:** The terminal handler should strip ANSI codes for clean logs.
- **Current:** Raw stdout/stderr is returned as-is. ANSI codes may appear in logs and error messages.
- **Severity:** Minor — cosmetic issue in log output.
- **Recovery:** Strip ANSI escape codes before logging. Set `npm_config_color=false` or `CI=true` env var.

### 15.2 npm outputs progress bars that overwrite previous lines
- **Scenario:** npm install uses a progress bar with `\r` carriage returns. The captured stdout contains interleaved progress lines.
- **Expected:** Clean output without progress bar artifacts.
- **Current:** The captured stdout contains all the progress bar lines. The final output is correct but intermediate artifacts pollute the captured data.
- **Severity:** Minor — log noise.
- **Recovery:** Set `CI=true` environment variable to disable progress bars.

### 15.3 npm outputs warning about deprecated packages
- **Scenario:** npm install succeeds but outputs deprecation warnings to stderr.
- **Expected:** Task succeeds (exit code 0). Warnings are in the output but not treated as errors.
- **Current:** Works correctly — exit code 0 = success, regardless of stderr content.
- **Severity:** Handled.

### 15.4 npm run build outputs errors to stdout instead of stderr
- **Scenario:** Some tools (especially on Windows) write errors to stdout, not stderr. The terminal handler returns `success: true` because exit code is 0, but the build actually had errors.
- **Expected:** Build errors should result in failure, regardless of which stream they go to.
- **Current:** The handler only checks exit code. If a tool exits 0 but writes errors to stdout, we report success.
- **Severity:** Critical — false positive on success. User thinks build passed but it didn't.
- **Recovery:** Scan stdout for error patterns. Or use `npm run build 2>&1` to merge streams.

### 15.5 Massive terminal output exceeds maxBuffer
- **Scenario:** `npm install` outputs more than 10MB of data. execFile's maxBuffer (10MB) is exceeded.
- **Expected:** execFile rejects with "stdout maxBuffer exceeded". Terminal handler catches and reports failure.
- **Current:** execFile throws. The error is caught. Message: "stdout maxBuffer exceeded." Mission fails.
- **Severity:** Medium — rare but fails mission for large dependency trees.
- **Recovery:** Increase maxBuffer or stream output instead of buffering.

---

## 16. Large Projects (5)

### 16.1 Project name collision with many concurrent runs
- **Scenario:** The slug from "Create a Three.js project" is deterministic: "create-a-three-js-project". Running Nova twice with the same message creates a second project in the same directory.
- **Expected:** Second run should either use a unique suffix or detect the existing directory and abort.
- **Current:** Step-0: `mkdir "create-a-three-js-project"` with `{ recursive: true }` — succeeds silently if dir exists. Step-1: `npm create vite@latest create-a-three-js-project` — fails because directory is non-empty.
- **Severity:** Critical — second run corrupts first project or fails confusingly.
- **Recovery:** Append timestamp or UUID to directory name. Check for existing projects.

### 16.2 npm install with hundreds of dependencies
- **Scenario:** A future version of our template or dependencies pulls in a framework with hundreds of transitive dependencies.
- **Expected:** npm install completes successfully, just takes longer.
- **Current:** 60s timeout may be insufficient for large dependency trees. Step-2 fails.
- **Severity:** Medium — timeout is a risk for unexpectedly large dependency graphs.
- **Recovery:** Dynamic timeout based on dependency count. Or detect progress in npm output.

### 16.3 Vite build takes too long for large template
- **Scenario:** Build step takes >30s due to complex compilation.
- **Expected:** Step-7 times out. Mission fails.
- **Current:** 30s timeout may be tight for first build with large dependency tree.
- **Severity:** Medium — tight timeout.
- **Recovery:** Increase build timeout to 60s.

### 16.4 Multiple missions run concurrently
- **Scenario:** User opens two terminals and runs Nova twice simultaneously. Both try to create projects.
- **Expected:** Both should complete without interfering with each other.
- **Current:** Each creates its own tool manager via `createNativeToolManager()`. Tool IDs are the same but each manager instance is independent. No global state conflict. However, if both target the same project name (same slug), step-0 succeeds for both, step-1 fails for the second.
- **Severity:** High — concurrent runs with same input cause one to fail.
- **Recovery:** Use unique project names per run.

### 16.5 Vite build produces 10,000+ files in dist/
- **Scenario:** Build output directory has many files. Not a failure for Nova — this is the expected output.
- **Current:** No issue.
- **Severity:** Not applicable.

---

## 17. Existing Repositories (5)

### 17.1 User runs Nova inside an existing git repo with tracked files
- **Scenario:** User's cwd is a git repo with files. The project is created inside this repo. git status shows the new project as untracked.
- **Expected:** Nova should inform the user that the project was created within an existing repo.
- **Current:** No detection. Project is created silently inside the existing repo.
- **Severity:** Low — not a failure, but user may be surprised when they push and the new project is included.
- **Recovery:** Check for `.git` directory at start and warn.

### 17.2 .gitignore prevents tracking of important files
- **Scenario:** Existing .gitignore in parent directory matches our template files (e.g., `vite.config.*`).
- **Expected:** Files are created but ignored by git.
- **Current:** Files are written successfully. User may not realize they're gitignored.
- **Severity:** Low — no failure, but user surprise.
- **Recovery:** Warn if created files match parent .gitignore patterns.

### 17.3 Existing project has a different package manager (yarn, pnpm)
- **Scenario:** User's cwd has `yarn.lock` or `pnpm-lock.yaml`. But we use `npm` commands. npm will create `package-lock.json` alongside the existing lockfile.
- **Expected:** Project should use the same package manager as the containing repo.
- **Current:** We hardcode `npm` commands. If the repo uses yarn/pnpm, we still use npm. Mixed lockfiles can cause confusion.
- **Severity:** Medium — mixed package managers cause subtle dependency issues.
- **Recovery:** Detect existing lockfile and use matching package manager.

### 17.4 CI/CD pipeline runs Nova (non-interactive)
- **Scenario:** `CI=true` environment variable is set. npm behaves differently (no progress bars, stricter error handling).
- **Expected:** Should handle CI mode gracefully.
- **Current:** npm in CI mode is more verbose about errors. This is actually helpful. No known issues.
- **Severity:** Handled.
- **Recovery:** We should set `CI=true` to get cleaner npm output.

### 17.5 GitHub Actions or similar runner environment
- **Scenario:** Nova runs in ephemeral CI runner with limited disk, no persistent npm cache.
- **Expected:** Should complete within CI timeout.
- **Current:** Each install fetches fresh packages (no cache). Slower but functional. CI timeout (usually 60min) is far above our 2-3min mission.
- **Severity:** Handled for short missions.
- **Recovery:** Not needed for v0.1.

---

## 18. Corrupted Files (5)

### 18.1 npm cache corruption causes install failure
- **Scenario:** npm's local cache has corrupted tarballs. `npm install` fails with integrity hash mismatch.
- **Expected:** Step-2/3 fails. Retry also fails.
- **Current:** npm reports "shasum check failed" or "integrity check failed". Error is in stderr. Mission fails. No cache cleanup suggestion.
- **Severity:** Medium — user can fix with `npm cache clean --force` but Nova doesn't suggest it.
- **Recovery:** Detect integrity failure and suggest cache clean.

### 18.2 Filesystem corruption causes partial file write
- **Scenario:** Underlying filesystem silently corrupts a written file (bit rot on ZFS, silent data corruption on certain SSDs).
- **Expected:** Extremely rare. No reasonable mitigation for v0.1.
- **Current:** File is written but may be corrupt. No checksum verification.
- **Severity:** Low — extremely rare edge case.
- **Recovery:** Checksum critical files after writing.

### 18.3 BOM (Byte Order Mark) in written UTF-8 files
- **Scenario:** On Windows, some editors add a BOM to UTF-8 files. Node's `writeFile` with `'utf-8'` encoding writes without BOM.
- **Expected:** Our templates are plain ASCII/UTF-8 without BOM.
- **Current:** `writeFile` writes clean UTF-8. No BOM. Vite and TypeScript handle this correctly.
- **Severity:** Handled.
- **Recovery:** None needed.

### 18.4 CRLF vs LF line ending corruption
- **Scenario:** Windows uses CRLF line endings. Our template strings use `\n` (LF). When written on Windows, they remain LF.
- **Expected:** Vite and TypeScript handle both line endings. No issue.
- **Current:** Templates use `\n` which becomes LF in the file. Works on all platforms.
- **Severity:** Minor — cosmetic if user views files in Notepad.
- **Recovery:** Use `os.EOL` for platform-appropriate line endings (minor priority).

### 18.5 Template string contains unescaped characters that break file format
- **Scenario:** Our main.ts template contains backticks, `$`, or `${}` that could be interpreted as template literals if pasted into the wrong context. But we're constructing the template programmatically, not via string substitution.
- **Expected:** The template strings are static and correctly escaped.
- **Current:** `MAIN_TS` uses `\n` for line breaks. `htmlTemplate` uses backtick interpolation for `${projectName}` — this is the template literal substitution, not the file content. The file content receives the resolved value. Correct.
- **Severity:** Handled.
- **Recovery:** None needed.

---

## 19. Race Conditions (5)

### 19.1 ToolManager.invoke called before tools are connected
- **Scenario:** `manager.connect()` is called with `void` (fire-and-forget). If `executeTask` runs before the connection completes, invoke fails with "not-connected".
- **Expected:** Mission fails at step-0 because filesystem tool is not yet connected.
- **Current:** Lines 248-249: `void manager.connect(...)`. The promise is unawaited. If connect hasn't resolved by the time invoke runs, the tool reports `isConnected() === false`. Invoke returns `permission-denied` or `not-connected`.
- **Severity:** Critical — race condition between connect and first task execution. Intermittent failure.
- **Recovery:** Await connect promises. Or check connection before each invoke and wait if needed.

### 19.2 Multiple tasks with same dependsOn resolving simultaneously
- **Scenario:** Steps 4, 5, 6 all depend on step-1. When step-1 completes, the next loop iteration finds all three ready. The `for` loop executes them sequentially in order. No parallelism in v0.1.
- **Current:** Sequential execution — no race condition.
- **Severity:** Handled.

### 19.3 Timer resolution: performance.now() vs Date.now()
- **Scenario:** `performance.now()` is used for duration in executor.ts. This is high-resolution and monotonic. No race issues.
- **Current:** Correct.
- **Severity:** Handled.

### 19.4 Mission result accessed/modified concurrently
- **Scenario:** The `taskResults` array is only accessed from the main mission loop. No concurrent access in v0.1.
- **Current:** Single-threaded (async/await, no concurrent task execution). Safe.
- **Severity:** Handled.

### 19.5 Logger writes interleave with console output
- **Scenario:** Multiple log writes may interleave if multiple async operations log simultaneously. In v0.1, all operations are sequential. No interleaving.
- **Current:** Sequential. Safe.
- **Severity:** Handled.

---

## 20. Human Mistakes (5)

### 20.1 User runs node index.js without compiling TypeScript first
- **Scenario:** `node packages/nova-v0.1/src/index.ts` — Node.js can't run TypeScript directly without tsx or ts-node.
- **Expected:** Error: "Cannot use import statement outside a module" or "Unexpected token ':'".
- **Current:** Fails immediately with a JavaScript syntax error. User has no guidance.
- **Severity:** High — entry point is .ts, not .js. User must use tsx or build first.
- **Recovery:** Add a `#!/usr/bin/env tsx` shebang. Or document the correct command. Or compile to JS in package.json `"bin"`.

### 20.2 User passes --flag instead of a string message
- **Scenario:** User runs `nova --help` or `nova --version`. `process.argv[2]` is `--help` or `--version`.
- **Expected:** Nova should recognize flags and respond appropriately.
- **Current:** `--help` is passed to parseGoal as a message. The keyword matcher finds no framework, throws UnsupportedGoalError: "No supported framework found in: '--help'". User is confused.
- **Severity:** Medium — misinterprets flags as mission messages.
- **Recovery:** Detect `--` prefixed args and show usage message.

### 20.3 User passes multiple arguments without quotes
- **Scenario:** User runs `node index.js Create a Three.js project` (no quotes). `process.argv[2]` is only `"Create"`.
- **Expected:** Nova should handle partial message gracefully.
- **Current:** Parses "Create" — no framework keyword found. Throws UnsupportedGoalError: "No supported framework found in: 'Create'". User is confused because they clearly typed a valid request.
- **Severity:** High — common user mistake with no guidance.
- **Recovery:** Join all remaining argv into a single message. Detect missing framework and hint at quoting.

### 20.4 User answers "yes" to interactive npm prompts
- **Scenario:** Some npm commands show interactive prompts (e.g., "Proceed anyway?" on license violations). Our commands use `--` args and `@latest` suffix which should skip prompts.
- **Expected:** No interactive prompts.
- **Current:** Current commands are non-interactive. Safe.
- **Severity:** Handled.

### 20.5 User runs Nova from a directory that doesn't exist
- **Scenario:** `cd /nonexistent && node index.js "Create a Three.js project"` — cwd doesn't exist.
- **Expected:** Step-0 creates a project directory relative to cwd, but cwd doesn't exist. `mkdir` should handle this — it receives an absolute or relative path. If cwd doesn't exist, relative path resolution fails.
- **Current:** `mkdir 'create-a-three-js-project'` resolves relative to cwd. If cwd doesn't exist (how did Node even start?), `mkdir` throws ENOENT. Error: "ENOENT: no such file or directory".
- **Severity:** Medium — user can't cd to a non-existent dir. Node would fail before Nova runs.
- **Recovery:** Not realistically reachable.

---

# Ranking: Critical → Minor

## Critical (20)

| # | Scenario | Category | Why |
|---|----------|----------|-----|
| 1 | **19.1** Connect race — invoke before connection | Race Conditions | Intermittent failure on first task. Every run is a race. |
| 2 | **14.2** Connect promise swallowed | Tool Runtime | Silent failure. Tool appears healthy but invoke fails. |
| 3 | **14.1** Duplicate registration crash | Tool Runtime | Prevents multi-mission in one process. |
| 4 | **16.1** Deterministic project name collision | Large Projects | Second run corrupts first project. |
| 5 | **8.1** Existing non-empty directory | Existing Conflicts | Overwrites/corrupts existing projects. |
| 6 | **8.5** Windows reserved name (CON, NUL) | Existing Conflicts | Windows silent failure. |
| 7 | **9.5** Zero-byte write reports success | Partial Execution | Mission lies about success. |
| 8 | **15.4** Errors in stdout not detected | Terminal Output | False positive success. |
| 9 | **10.1** Ctrl+C leaves no record | Interrupted | No cleanup, no failure report. |
| 10 | **6.1** Vite breaking changes break v0.1 | npm Failures | Time-bomb. Works now, breaks later. |
| 11 | **6.2** Template `vanilla-ts` removed | npm Failures | External dependency vanishes. |
| 12 | **2.1** Working directory deleted mid-mission | Missing Files | Opaque failure on subsequent steps. |
| 13 | **2.3** package.json deleted after scaffold | Missing Files | npm install fails, no diagnosis. |
| 14 | **3.1** Network down at step-1 | Network | Single retry insufficient for network issues. |
| 15 | **3.2** Network down mid-install | Network | Leaves broken state, no cleanup. |
| 16 | **4.1** No write permission on cwd | Permission | Mission fails, OS-dependent error message. |
| 17 | **4.4** Antivirus blocks node subprocess | Permission | Silent kill, no actionable error. |
| 18 | **20.1** User runs .ts without compiling | Human Mistakes | Entry point is TypeScript, not JS. |
| 19 | **20.3** Multiple args without quotes | Human Mistakes | Only first word is parsed as message. |
| 20 | **18.2** Silent file corruption | Corrupted Files | No checksum verification. |

## High (20)

| # | Scenario | Category | Why |
|---|----------|----------|-----|
| 21 | **7.1** Disk full at mkdir | Disk Full | Clear on Linux, unclear on Windows. |
| 22 | **7.4** Quota exceeded on NFS/SMB | Disk Full | Multiple retries for same root cause. |
| 23 | **8.3** File lock held by another process | Existing Conflicts | `retryOnce: false` for write steps. Immediate fail. |
| 24 | **5.1** Existing git repo in target directory | Git Failures | Vite may refuse to scaffold. |
| 25 | **5.2** Directory populated between steps | Git Failures | Race condition. |
| 26 | **9.1** Partial state after step failure | Partial Execution | Leaves broken project with no cleanup. |
| 27 | **9.2** Partial state after write failure | Partial Execution | Invariant violated (three installed but no config). |
| 28 | **9.4** Empty directory after fail | Partial Execution | No cleanup of empty dir. |
| 29 | **10.2** Killed mid-write leaves corrupted file | Interrupted | Partial file on disk, no detection. |
| 30 | **10.5** Slow user gets 2min timeout deadlock | Interrupted | Would succeed with longer timeout. |
| 31 | **12.1** three/@types/three version mismatch | Dependency Conflicts | Build fails due to type mismatch. |
| 32 | **13.3** npm create version differences | Platform Differences | Behavior change across npm versions. |
| 33 | **13.4** Windows Defender slows install to timeout | Platform Differences | Windows users disproportionately fail. |
| 34 | **14.3** Dispose races with active invocation | Tool Runtime | Unhandled errors during cleanup. |
| 35 | **16.4** Multiple concurrent runs | Large Projects | Second run with same input fails. |
| 36 | **17.3** Mixed package managers | Existing Repositories | npm in pnpm/yarn repo creates confusion. |
| 37 | **3.3** Transient registry 503 | Network | Single retry not enough. |
| 38 | **6.4** npm postinstall hangs | npm Failures | 2min wait, no cancellation. |
| 39 | **7.2** Disk full at npm install | Disk Full | Partial node_modules. |
| 40 | **10.3** Laptop sleep during execution | Interrupted | Process killed during sleep, mission fails. |

## Medium (25)

| # | Scenario | Category | Why |
|---|----------|----------|-----|
| 41 | **1.4** Negation not understood | Invalid Missions | "I don't want Three.js" creates Three.js project. |
| 42 | **2.2** node_modules deleted after install | Missing Files | npm self-heals, but state is inconsistent. |
| 43 | **2.4** tsconfig missing for build | Missing Files | Build fails with opaque error. |
| 44 | **2.5** vite binary missing | Missing Files | Build fails, no hint about missing binary. |
| 45 | **3.4** DNS resolution failure | Network | Error message doesn't distinguish DNS. |
| 46 | **3.5** Proxy auth required | Network | No guidance for corporate users. |
| 47 | **4.3** npm EACCES global permission | Permission | Error visible but no fix guidance. |
| 48 | **5.4** Git hooks break build | Git Failures | Husky/pre-commit can break npm run build. |
| 49 | **6.3** Peer dependency conflict | npm Failures | ERESOLVE error, user sees long tree. |
| 50 | **7.3** Disk full at build step | Disk Full | Partial build output in dist/. |
| 51 | **9.3** Build fails after all prior steps succeed | Partial Execution | Project is 95% done but last step fails. |
| 52 | **11.2** Emoji in message stripped | Invalid Paths | Cosmetic loss, not functional. |
| 53 | **12.2** Vite template TypeScript mismatch | Dependency Conflicts | External incompatibility. |
| 54 | **12.3** Corrupted npm cache | Dependency Conflicts | No cache-clean suggestion. |
| 55 | **13.2** Shell behavior asymmetry | Platform Differences | cmd.exe vs sh subtle differences. |
| 56 | **14.4** Event bus OOM for large outputs | Tool Runtime | Large stdout stored in memory. |
| 57 | **15.5** maxBuffer exceeded | Terminal Output | Rare but fails on large dep trees. |
| 58 | **16.2** Hundreds of deps timeout | Large Projects | 60s timeout insufficient. |
| 59 | **16.3** Build timeout too tight | Large Projects | 30s timeout for build. |
| 60 | **18.1** npm cache corruption | Corrupted Files | No cache-clean suggestion. |
| 61 | **20.2** --help flag misinterpreted | Human Mistakes | Flag becomes mission message. |
| 62 | **20.5** CWD doesn't exist | Human Mistakes | Node can't start from non-existent dir. |
| 63 | **6.5** npm fund messages in stderr | npm Failures | Not a failure but noisy logs. |
| 64 | **7.5** Disk frees between retries | Disk Full | Works but luck-based. |
| 65 | **4.5** Windows MAX_PATH exceeded | Permission | Windows-specific path length issue. |

## Minor (15)

| # | Scenario | Category | Why |
|---|----------|----------|-----|
| 66 | **1.2** "three.js" alone as message | Invalid Missions | Works but UX is confusing. |
| 67 | **1.5** Extremely long input | Invalid Missions | Performance degradation but no crash. |
| 68 | **5.3** User runs git init mid-mission | Git Failures | Cosmetic, not a failure. |
| 69 | **5.5** .gitignore conflicts | Git Failures | Not a failure, user surprise. |
| 70 | **11.2** Unicode/emoji stripped | Invalid Paths | Cosmetic. |
| 71 | **13.1** Forward slash paths on Windows | Platform Differences | Works but not idiomatic. |
| 72 | **15.1** ANSI codes in output | Terminal Output | Log noise. |
| 73 | **15.2** Progress bar artifacts | Terminal Output | Log noise. |
| 74 | **17.1** Inside existing git repo | Existing Repositories | User surprise, not failure. |
| 75 | **17.2** .gitignore hides files | Existing Repositories | User surprise. |
| 76 | **18.4** CRLF vs LF line endings | Corrupted Files | Cosmetic. |
| 77 | **11.3** Only special chars in name | Invalid Paths | Handled correctly. |
| 78 | **1.1** Empty string whitespace | Invalid Missions | Handled correctly. Tested. |
| 79 | **1.3** No known framework | Invalid Missions | Handled correctly. Tested. |
| 80 | **20.4** Interactive prompts | Human Mistakes | Handled correctly with -- flags. |

## Already Handled (20)

Scenarios the current code handles correctly (included for completeness).

| # | Scenario | How It's Handled |
|---|----------|-----------------|
| 81 | Empty message | Throws ParseError |
| 82 | Whitespace-only message | Throws ParseError |
| 83 | Unsupported framework | Throws UnsupportedGoalError |
| 84 | Path traversal in projectName | Slugify strips dots/slashes |
| 85 | Invalid npm command (exit code != 0) | Mission retries, then fails |
| 86 | File write failure (EACCES) | Caught, success=false, error reported |
| 87 | mkdir failure (ENOSPC) | Caught, success=false, error reported |
| 88 | Unknown action to handler | Returns action-not-found error |
| 89 | Empty command string | Returns invalid-input error |
| 90 | npm install with warnings (exit 0) | Correctly reports success |
| 91 | npm fund messages (exit 0) | Correctly reports success |
| 92 | npm audit messages (exit 0) | Correctly reports success |
| 93 | Tool not registered (shouldn't happen) | ToolNotFoundError by ToolManager |
| 94 | Missing permissions in handler | Permission-denied by ToolInvoker |
| 95 | Unsupported platform | ToolPlatformError on register |
| 96 | Duplicate tool registration | ToolAlreadyRegisteredError |
| 97 | Circular dependency (shouldn't exist) | Mission returns "Blocked" result |
| 98 | Task with missing dependency reference | handled — dep not in set, skipped |
| 99 | Large stdout within maxBuffer | Returned in output field |
| 100 | projectName slug truncated to 64 chars | Prevents absurd dir names |

---

# Summary

- **Critical:** 20 — must fix before any external use
- **High:** 20 — should fix in v0.1.1
- **Medium:** 25 — address in v0.2
- **Minor:** 15 — cosmetic or low-impact
- **Handled:** 20 — existing code covers these

Top 3 most dangerous:
1. **19.1** — Connection race causes intermittent first-task failure
2. **14.2** — Swallowed connect promise makes tool failures invisible
3. **16.1** — Deterministic project names cause second-run collisions
