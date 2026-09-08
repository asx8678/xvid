# Reproducible command log

## V002 — Final validation

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001.

Status: **passed**; exit code: 0.

223 baseline/current citation ranges valid; six unique findings; all referenced commands/artifacts present; 15 delivered files match the tested copy; no unrelated tracked changes or permission changes; git diff --check passes.

````bash
timeout 30s python3 '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/validate_audit.py' '/home/adam/projects/xvid' '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7' '/tmp/xvid-audit-kyq46bbr'
````

Output:

````text
{
  "baseline": "8569aa44ff01de50ea656dec2120fc649bb15b14",
  "source_citation_ranges_checked": 223,
  "unique_findings": 6,
  "feature_matrix_rows": 20,
  "command_records_before_V002": 72,
  "artifact_files_redaction_checked": 26,
  "delivered_files_matching_tested_snapshot": 15,
  "unrelated_tracked_files_changed": false,
  "extension_manifest_changes_except_version": false,
  "git_diff_check_exit": 0,
  "git_status": " M .github/workflows/lint.yml\n M .prettierignore\n M CHANGELOG.md\n M CLAUDE.md\n M CONTRIBUTING.md\n M README.md\n M content.css\n M content.js\n M eslint.config.mjs\n M manifest.json\n M package-lock.json\n M package.json\n?? audit-output/\n?? tests/\n",
  "errors": [],
  "status": "passed"
}
````

The full result is also in [validation-results.json](validation-results.json). This final entry is placed first for review; the remaining records follow their audit/implementation groups.


Exact commands are recorded below; multiline commands retain their actual line breaks. Shell commands use bash. Public documentation calls record the exact web.run JSON request instead of a shell command. Outputs are concise/redacted; source-reading output is summarized rather than copied. No secret values or raw contributor identities are recorded. Artifact authoring is preserved in the resulting files and implementation.patch; this log records the inspection, environment, execution and transfer commands that establish evidence.

## ENV-001

- platform: Linux x86_64, glibc 2.39
- shell: bash
- node: 24.20.0
- python: 3.12.3
- git: 2.43.0
- chromium: Chrome for Testing 152.0.7977.64
- npm: initially absent; audit-only 12.0.2
- audit_dom_model: jsdom 30.0.1
- timezone: Europe/Warsaw; primary registry timestamps UTC
- notes: Commands before tooling bootstrap cannot be interpreted as npm 12 runs. Source/status reads use session environment without dumping it. Package execution uses explicit clean env/configs as recorded. No duration benchmarking inferred from tool timings.

Exit status and timeout classification are distinct from application quality. Early setup/read failures did not count as defect reproductions. Commands with no configured/applicable check are explicitly not run. The original audit baseline is distinct from later authorized implementation; B/C/D/E001–E005 concern the audit, I/E006–E007 the fixes, and V the provenance/final validation.

## B001 — Identify working directory

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
pwd
````

Output summary:

````text
/home/adam/projects/xvid
````

## B002 — Record initial dirty/untracked status

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
git status --porcelain=v1 --untracked-files=all
````

Output summary:

````text
Public-source retrieval completed.
````

## B003 — Record root, branch and shallow flag; SHA resolution corrected in B006

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
git rev-parse --show-toplevel --abbrev-ref HEAD HEAD --is-shallow-repository
````

Output summary:

````text
/home/adam/projects/xvid
main
main
false
````

## B004 — Find stack, workflow and existing audit files

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
rg --files --hidden -g '!**/.git/**' -g 'AGENTS.md' -g 'package.json' -g '*lock*' -g 'README*' -g '*AUDIT*' -g '*.toml' -g 'Makefile' -g 'go.mod' -g 'pyproject.toml' -g 'Cargo.toml' -g '*.sln' -g '*.csproj' -g '*.exs' -g 'requirements*'
````

Output summary:

````text
AGENTS.md
README.md
package-lock.json
package.json
````

## B005 — Check optional historical context; unavailable, no memory facts used

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 2.

Environment capability unavailable; not an application defect.

````bash
rg -n -i 'xvid|audit|isolat|push' /home/adam/.codex/memories/MEMORY.md
````

Output summary:

````text
Registry path unavailable: No such file or directory.
````

## B006 — Resolve the exact baseline SHA

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
git rev-parse HEAD
````

Output summary:

````text
8569aa44ff01de50ea656dec2120fc649bb15b14
````

## B007 — Inventory tracked files, executable modes and object identities

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
git ls-files -s
````

Output summary:

````text
31 tracked files listed with modes/blob IDs; no submodule entry.
````

## B008 — Check changes relative to HEAD

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
git diff --stat HEAD
````

Output summary:

````text
Public-source retrieval completed.
````

## B009 — Inspect recent history and current release hotspots

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
git log -8 --format='%h %aI %s'
````

Output summary:

````text
Latest commit 8569aa4 dated 2026-08-31; recent changes focus on mutation processing, quote ownership and runtime simplification.
````

## B010 — Read repository instructions, purpose, tooling and ignore rules

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
cat AGENTS.md README.md package.json .gitignore
````

Output summary:

````text
AGENTS.md, README.md, package.json and .gitignore read. Local MV3 extension, no runtime dependencies or build; documented lint/format and manual checks.
````

## B011 — Inventory platform, tool paths and root entries

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 -c 'import os,shutil,platform; print("platform:",platform.platform()); print("tools:",{x:shutil.which(x) for x in ["python3","node","npm","bd","timeout","bwrap","unshare","chromium","google-chrome"]}); print("root entries:"); [print(x.name+ ("/" if x.is_dir(follow_symlinks=False) else "")) for x in os.scandir(".")]'
````

Output summary:

````text
Linux x86_64/glibc 2.39. Node/Python/timeout/bwrap/unshare/Chromium launchers present. npm and bd absent. Root contains extension, tooling, docs, Git and tracker metadata.
````

## B012 — Record boundary and create unique audit output plus disposable tracked snapshot

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import pathlib,tempfile,subprocess,json,hashlib,os,datetime
root=pathlib.Path('/home/adam/projects/xvid')
out_parent=root/'audit-output'
out_parent.mkdir(exist_ok=True)
out=pathlib.Path(tempfile.mkdtemp(prefix='2026-09-08-8569aa4-',dir=out_parent))
sandbox=pathlib.Path(tempfile.mkdtemp(prefix='xvid-audit-'))
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
manifest=[]
for f in filter(None,files):
 p=root/f
 data=p.read_bytes()
 dst=sandbox/f
 dst.parent.mkdir(parents=True,exist_ok=True)
 dst.write_bytes(data)
 dst.chmod(p.stat().st_mode & 0o777)
 manifest.append({'path':f,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(out/'baseline-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'AUDIT_NOTES.md').write_text('''# Audit notes\n\n## Operating contract recorded before substantive review\n\n- Target: `/home/adam/projects/xvid`; branch `main`; HEAD `8569aa44ff01de50ea656dec2120fc649bb15b14`. Initial tracked and untracked status clean (B002, B008); history is not shallow (B003). B003 did not resolve SHA correctly; B006 supplies the SHA.\n- Audit date: 2026-09-08, user timezone Europe/Warsaw. Execution timestamps will be recorded independently.\n- Write boundary: only this new audit output directory in the original checkout. No application, dependency, lockfile, configuration, or existing-test edits. Disposable copy for any execution that can change state. No production/application endpoints, discovered credentials, deploy, publish, commit, pull, push, stash clearing, or pruning. The current user audit contract overrides the repository session push instructions.\n- Snapshot: byte-for-byte copy of all tracked files; SHA-256 manifest in `baseline-manifest.json`. Ignored local runtime state, Git configuration/hooks, and credentials are not copied. The disposable copy is outside the checkout.\n- Documented context (README.md): local Chrome/Chromium Manifest V3 extension, xHelper, x.com-only video downloads and promoted-post hiding. Users: individuals using X in a supported browser. No build step and no runtime dependencies claimed. Distribution beyond local unpacked installation, supported browser versions, private-post requirements, and operational usage are unresolved. These are documentation claims awaiting code tracing.\n- Review priority: extension privileges/message boundaries; URL/media lookup and download completion; DOM button ownership and page mutation handling; ad hiding/canary; scripts/CI and dependencies. Inventory is not end-to-end assurance.\n- Included initially: all tracked runtime files, manifest, tooling/CI, docs, available Git history and metadata. Beads/agent files inspected for workflow and sensitive information only; icons inventoried with image metadata only. Live X/syndication/CDN traffic, real browser profiles, real downloads, remote repository operations, and actual deployed behavior excluded by safety boundary.\n- Capabilities at baseline (B011): unrestricted filesystem and network technically available; user restricts usage to safe audit. Python, Node launcher, timeout, bwrap, unshare, Chromium launcher present. npm and bd absent from PATH. No user time/token limit specified; commands will have finite timeouts and no indefinite jobs. Actual executable availability and isolated-browser feasibility remain to be checked.\n- Local historical memory registry unavailable (B005); no historical repository facts used.\n\n## Evidence handling\n\nCommand IDs are stable. Exact commands, directories, environment, results, and concise redacted output will be recorded in command artifacts. Source citations refer to the inspected baseline, not proposed changes. Findings use one F-number register. No live endpoint or credential validation is authorized.\n''')
(out/'environment.json').write_text(json.dumps({'repository':str(root),'output':str(out),'sandbox':str(sandbox),'head':'8569aa44ff01de50ea656dec2120fc649bb15b14','branch':'main','initial_status':'clean','shallow':False,'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n')
print(json.dumps({'output':str(out),'sandbox':str(sandbox),'files':len(manifest)}))
PY
````

Output summary:

````text
{"output": "/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7", "sandbox": "/tmp/xvid-audit-kyq46bbr", "files": 31}
````

## B013 — Try repository onboarding only in disposable copy

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 127.

Environment capability unavailable; not an application defect.

````bash
timeout 5s bd onboard
````

Output summary:

````text
timeout: failed to run command ‘bd’: No such file or directory
````

## B014 — Try detailed tracker context only in disposable copy

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 127.

Environment capability unavailable; not an application defect.

````bash
timeout 5s bd prime
````

Output summary:

````text
timeout: failed to run command ‘bd’: No such file or directory
````

## B015 — Inspect executable launchers before version checks

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
for name in ['node','chromium']:
 p=Path('/home/adam/.local/bin')/name
 print(name,'symlink=',p.is_symlink(),'resolved=',p.resolve())
 data=p.read_bytes()[:3000]
 if b'\x00' not in data: print(data.decode(errors='replace'))
 else: print('binary executable')
PY
````

Output summary:

````text
node symlink= True resolved= /home/adam/.local/node-v24.20.0/bin/node
binary executable
chromium symlink= True resolved= /home/adam/.local/share/chromium/chrome-linux64/chrome
binary executable
````

## C001 — Read all manifest and background runtime with numbered locations

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
for name in ['manifest.json','background.js']:
 print('\nFILE:',name)
 for n,line in enumerate(Path(name).read_text().splitlines(),1): print(f'{n:4}: {line}')
PY
````

Output summary:

````text
All manifest.json lines 1-35 and background.js lines 1-205 read with line numbers; full runtime flow traced.
````

## C002 — Read all DOM runtime and stylesheet

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
for name in ['content.js','content.css']:
 print('\nFILE:',name)
 for n,line in enumerate(Path(name).read_text().splitlines(),1): print(f'{n:4}: {line}')
PY
````

Output summary:

````text
content.js lines 1-252 and content.css lines 1-56 read with line numbers. Display output truncated near content.js:234; C005 supplies the complete tail.
````

## C003 — Inspect lifecycle scripts CI conventions and documented changes

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
for name in ['package.json','eslint.config.mjs','.github/workflows/lint.yml','.prettierrc','.prettierignore','CONTRIBUTING.md','CLAUDE.md','CHANGELOG.md','LICENSE']:
 print('\nFILE:',name)
 for n,line in enumerate(Path(name).read_text().splitlines(),1): print(f'{n:4}: {line}')
PY
````

Output summary:

````text
Read package scripts, ESLint/Prettier configs, 20-line CI workflow, contribution/agent docs, all changelog and license text.
````

## C004 — Verify available tool versions without application startup

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import shutil,subprocess,pathlib,os
for args in [['node','--version'],['python3','--version'],['git','--version'],['chromium','--version'],['bwrap','--version']]:
 p=subprocess.run(args,capture_output=True,text=True,timeout=5); print(args,p.returncode,(p.stdout+p.stderr).strip())
print('node sibling tools:',[p.name for p in pathlib.Path('/home/adam/.local/node-v24.20.0/bin').iterdir()])
print('npm candidates:',[str(p) for p in pathlib.Path('/home/adam/.local/node-v24.20.0').glob('lib/node_modules/npm/bin/*cli.js')])
print('available optional tools:',{n:shutil.which(n) for n in ['corepack','pnpm','yarn','bun','browser-harness-js','curl']})
PY
````

Output summary:

````text
['node', '--version'] 0 v24.20.0
['python3', '--version'] 0 Python 3.12.3
['git', '--version'] 0 git version 2.43.0
['chromium', '--version'] 0 Google Chrome for Testing 152.0.7977.64
['bwrap', '--version'] 0 bubblewrap 0.9.0
node sibling tools: ['corepack', 'ast-grep', 'sg', 'node']
npm candidates: []
available optional tools: {'corepack': '/home/adam/.local/bin/corepack', 'pnpm': '/home/adam/.local/bin/pnpm', 'yarn': '/home/adam/.local/bin/yarn', 'bun': '/home/adam/.bun/bin/bun', 'browser-harness-js': '/home/adam/.local/bin/browser-harness-js', 'curl': '/usr/bin/curl'}
````

## C005 — Complete runtime reading and inspect lock and local workflow configuration

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
for name,start,end in [('content.js',234,252),('README.md',1,70),('package-lock.json',1,90),('.beads/config.yaml',1,100),('.beads/README.md',1,160)]:
 print('\nFILE:',name)
 for n,line in enumerate(Path(name).read_text().splitlines(),1):
  if start <= n <= end: print(f'{n:4}: {line}')
PY
````

Output summary:

````text
Read content.js:234-252, complete README, lock root/early packages, beads config and README. No installation instructions from repository content were executed.
````

## C006 — Measure tracked inventory Git age hotspots and contributor counts (identities redacted)

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import subprocess,collections,json,pathlib,hashlib,datetime,struct
root=pathlib.Path('.')
files=subprocess.check_output(['git','ls-files','-z']).decode().split('\0'); files=list(filter(None,files))
commits=subprocess.check_output(['git','rev-list','--count','HEAD'],text=True).strip()
rows=subprocess.check_output(['git','log','--format=%H%x09%aI%x09%ae','--reverse'],text=True).splitlines()
counts=collections.Counter(x.split('\t')[2] for x in rows)
hot=collections.Counter(x for x in subprocess.check_output(['git','log','--format=','--name-only'],text=True).splitlines() if x)
print(json.dumps({'tracked_files':len(files),'commits':int(commits),'first_commit':rows[0].split('\t')[:2],'last_commit':rows[-1].split('\t')[:2],'author_identity_commit_counts':sorted(counts.values(),reverse=True),'hotspots_commit_touches':hot.most_common(12)},indent=2))
print('FILE METRICS: physical lines, bytes (all tracked; lock, docs, metadata not runtime)')
for f in files:
 b=(root/f).read_bytes()
 print(f,len(b.splitlines()) if b'\0' not in b else 'binary',len(b))
 if f.endswith('.png'): print('PNG dimensions',f,struct.unpack('>II',b[16:24]))
print('test or deployment candidate filenames:')
print([f for f in files if any(x in f.lower() for x in ['test','spec','docker','terraform','compose','deploy'])])
PY
````

Output summary:

````text
{
  "tracked_files": 31,
  "commits": 62,
  "first_commit": [
    "150fd8c7d086aaed3700188a4a2a3f6be0f1f709",
    "2026-03-15T23:27:30+01:00"
  ],
  "last_commit": [
    "8569aa44ff01de50ea656dec2120fc649bb15b14",
    "2026-08-31T03:07:53+02:00"
  ],
  "author_identity_commit_counts": [
    61,
    1
  ],
  "hotspots_commit_touches": [
    [
      "manifest.json",
      30
    ],
    [
      ".beads/issues.jsonl",
      27
    ],
    [
      "package.json",
      25
    ],
    [
      "content.js",
      18
    ],
    [
      "background.js",
      18
    ],
    [
      "CHANGELOG.md",
      15
    ],
    [
      "README.md",
      13
    ],
    [
      "package-lock.json",
      11
    ],
    [
      ".gitignore",
      6
    ],
    [
      "content/content.js",
      6
    ],
    [
      "popup/popup.js",
      6
    ],
    [
      "CONTRIBUTING.md",
      5
    ]
  ]
}
FILE METRICS: physical lines, bytes (all tracked; lock, docs, metadata not runtime)
.beads/.gitignore 73 1679
.beads/README.md 81 2253
.beads/config.yaml 5 114
.beads/hooks/post-checkout 24 801
.beads/hooks/post-merge 24 789
.beads/hooks/pre-commit 24 789
.beads/hooks/pre-push 24 781
.beads/hooks/prepare-commit-msg 24 821
.beads/issues.jsonl 32 56903
.beads/metadata.json 7 152
.claude/settings.json 26 389
.github/workflows/lint.yml 20 347
.gitignore 36 298
.prettierignore 1 18
.prettierrc 7 106
AGENTS.md 89 2904
CHANGELOG.md 160 7804
CLAUDE.md 89 3364
CONTRIBUTING.md 22 618
LICENSE 21 1056
README.md 60 2411
background.js 205 7196
content.css 56 1251
content.js 252 8655
eslint.config.mjs 25 589
icons/icon128.png binary 557
PNG dimensions icons/icon128.png (128, 128)
icons/icon16.png binary 106
PNG dimensions icons/icon16.png (16, 16)
icons/icon48.png binary 186
PNG dimensions icons/icon48.png (48, 48)
manifest.json 35 988
package-lock.json 1133 39676
package.json 21 462
test or deployment candidate filenames:
[]
````

## C007 — Inspect entire resolved dependency metadata and lifecycle indicators

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import json,collections,pathlib
p=json.loads(pathlib.Path('package-lock.json').read_text()); entries=p['packages']
print('lockfileVersion:',p['lockfileVersion'])
print('resolved packages excluding root:',len(entries)-1)
print('runtime dependencies:',[k for k,v in entries.items() if k and not v.get('dev')])
print('install scripts:',[k for k,v in entries.items() if v.get('hasInstallScript')])
print('registry hosts:',sorted(set(__import__('urllib.parse',fromlist=['urlparse']).urlparse(v['resolved']).hostname for v in entries.values() if 'resolved' in v)))
print('entries missing integrity:',[k for k,v in entries.items() if k and not v.get('integrity')])
print('direct resolved:')
for name,decl in entries['']['devDependencies'].items():
 v=entries['node_modules/'+name]; print(name,decl,json.dumps({k:v.get(k) for k in ['version','license','engines','dependencies']}))
print('repeated names:',{n:versions for n,versions in (lambda d:d.items())(dict((n,[v['version'] for k,v in entries.items() if k.rsplit('node_modules/',1)[-1]==n]) for n in set(k.rsplit('node_modules/',1)[-1] for k in entries if k))) if len(versions)>1})
PY
````

Output summary:

````text
lockfileVersion: 3
resolved packages excluding root: 88
runtime dependencies: []
install scripts: []
registry hosts: ['registry.npmjs.org']
entries missing integrity: []
direct resolved:
@eslint/js ^9.23.0 {"version": "9.39.5", "license": "MIT", "engines": {"node": "^18.18.0 || ^20.9.0 || >=21.1.0"}, "dependencies": null}
eslint ^9.23.0 {"version": "9.39.5", "license": "MIT", "engines": {"node": "^18.18.0 || ^20.9.0 || >=21.1.0"}, "dependencies": {"@eslint-community/eslint-utils": "^4.8.0", "@eslint-community/regexpp": "^4.12.1", "@eslint/config-array": "^0.21.2", "@eslint/config-helpers": "^0.4.2", "@eslint/core": "^0.17.0", "@eslint/eslintrc": "^3.3.6", "@eslint/js": "9.39.5", "@eslint/plugin-kit": "^0.4.1", "@humanfs/node": "^0.16.6", "@humanwhocodes/module-importer": "^1.0.1", "@humanwhocodes/retry": "^0.4.2", "@types/estree": "^1.0.6", "ajv": "^6.14.0", "chalk": "^4.0.0", "cross-spawn": "^7.0.6", "debug": "^4.3.2", "escape-string-regexp": "^4.0.0", "eslint-scope": "^8.4.0", "eslint-visitor-keys": "^4.2.1", "espree": "^10.4.0", "esquery": "^1.5.0", "esutils": "^2.0.2", "fast-deep-equal": "^3.1.3", "file-entry-cache": "^8.0.0", "find-up": "^5.0.0", "glob-parent": "^6.0.2", "ignore": "^5.2.0", "imurmurhash": "^0.1.4", "is-glob": "^4.0.0", "json-stable-stringify-without-jsonify": "^1.0.1", "lodash.merge": "^4.6.2", "minimatch": "^3.1.5", "natural-compare": "^1.4.0", "optionator": "^0.9.3"}}
globals ^15.14.0 {"version": "15.15.0", "license": "MIT", "engines": {"node": ">=18"}, "dependencies": null}
prettier ^3.5.3 {"version": "3.9.5", "license": "MIT", "engines": {"node": ">=14"}, "dependencies": null}
repeated names: {'globals': ['14.0.0', '15.15.0'], 'eslint-visitor-keys': ['3.4.3', '4.2.1']}
````

## C008 — Check whether kernel permits a disposable network namespace

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 1.

Environment capability unavailable; not an application defect.

````bash
timeout 10s unshare -Urn true
````

Output summary:

````text
unshare: write failed /proc/self/uid_map: Operation not permitted
````

## C009 — Locate reusable tooling without executing repository setup scripts

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import pathlib,shutil
for root in ['/usr/share/nodejs','/usr/local/lib/node_modules','/opt','/tmp','/home/adam/.npm','/home/adam/.cache']:
 p=pathlib.Path(root)
 if not p.exists(): continue
 print(root,[x.name for x in list(p.iterdir())[:40]])
for name in ['eslint','prettier']:
 print(name,shutil.which(name))
PY
````

Output summary:

````text
No preinstalled eslint/prettier command; npm cache directory present. Unrelated directory-entry names omitted from this redacted output.
````

## C010 — Bounded redacted heuristic secret scan of locally available history

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import subprocess,re,collections,json,time
start=time.monotonic(); refs=subprocess.check_output(['git','rev-list','--objects','--all'],text=True).splitlines(); candidates=[]; count=0; total=0; skipped=0
patterns={'private key':re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),'provider token':re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})'),'literal credential assignment':re.compile(rb'(?i)(?:api[_-]?key|client[_-]?secret|password|access[_-]?token)\s*[=:]\s*[\x22\x27][^\x22\x27\r\n]{12,}[\x22\x27]')}
proc=subprocess.Popen(['git','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for row in refs:
 if time.monotonic()-start>20: raise TimeoutError('history scan reached 20s bound')
 oid,_,path=row.partition(' ');proc.stdin.write((oid+'\n').encode());proc.stdin.flush(); header=proc.stdout.readline().decode().split()
 if len(header)<3: continue
 size=int(header[2]); data=proc.stdout.read(size);proc.stdout.read(1)
 if header[1]!='blob': continue
 if b'\0' in data or size>2000000: skipped+=1;continue
 count+=1;total+=size
 for kind,pattern in patterns.items():
  for match in pattern.finditer(data): candidates.append({'object':oid,'path_hint':path,'line':data[:match.start()].count(b'\n')+1,'type':kind})
proc.stdin.close();proc.wait(timeout=3)
print(json.dumps({'scope':'all locally reachable refs; unique text blobs <=2MB; heuristic patterns only','objects_listed':len(refs),'text_blobs_scanned':count,'bytes_scanned':total,'binary_or_oversize_blobs_skipped':skipped,'candidates_redacted':candidates},indent=2))
PY
````

Output summary:

````text
{
  "scope": "all locally reachable refs; unique text blobs <=2MB; heuristic patterns only",
  "objects_listed": 576,
  "text_blobs_scanned": 346,
  "bytes_scanned": 3182981,
  "binary_or_oversize_blobs_skipped": 11,
  "candidates_redacted": []
}
````

## C011 — Inspect tracked hooks and workflow metadata without running hooks or printing issue bodies

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
import json
for p in sorted(Path('.beads/hooks').glob('*')):
 print('FILE:',p)
 for n,line in enumerate(p.read_text().splitlines(),1): print(n,line)
for name in ['.beads/metadata.json','.claude/settings.json']:
 data=json.loads(Path(name).read_text()); print(name,'top-level keys',list(data))
issues=[json.loads(x) for x in Path('.beads/issues.jsonl').read_text().splitlines() if x.strip()]
print('beads issue status counts:',__import__('collections').Counter(x.get('status') for x in issues))
print('beads issue count:',len(issues))
PY
````

Output summary:

````text
All five tracked beads hook scripts read; conditional bd hooks, timeout handling. Metadata/automation top-level keys inspected. 32 issue entries: 28 closed, 3 open, 1 in progress; bodies and identities not output.
````

## C012 — Inspect historical test inventory and deletion provenance

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
git log --all --format='%h %aI %s' -- '**/*test*' '**/*spec*' '*test*' '*spec*'
````

Output summary:

````text
History shows suite removal at 89e2187 (2026-07-12) and earlier test additions. Historical tests inventoried only; not run or assumed current.
````

## C013 — Cross-check entry points, environment/persistence absence and exact resolved dependency source locations

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import pathlib,json,re
files=['background.js','content.js','content.css','manifest.json','package.json','eslint.config.mjs','.github/workflows/lint.yml']
patterns={'environment_reads':r'process\.env|import\.meta\.env|localStorage|sessionStorage|chrome\.storage','dynamic_execution':r'\beval\s*\(|new Function|innerHTML|outerHTML|document\.write','unfinished_markers':r'\bTODO\b|\bFIXME\b|\bHACK\b|\bstub\b|\bnot implemented\b','browser_events':r'addListener|addEventListener|new MutationObserver','network_or_persistence':r'\bfetch\(|chrome\.downloads|indexedDB|sendBeacon|WebSocket'}
for category,pat in patterns.items():
 print(category)
 for name in files:
  for n,line in enumerate(pathlib.Path(name).read_text().splitlines(),1):
   if re.search(pat,line): print(f'{name}:{n}: {line.strip()}')
lock=json.loads(pathlib.Path('package-lock.json').read_text())['packages']
for name in ['eslint','@eslint/js','prettier','globals','ajv','minimatch','cross-spawn']:
 lines=pathlib.Path('package-lock.json').read_text().splitlines()
 marker='"node_modules/'+name+'": {'
 for i,line in enumerate(lines,1):
  if marker in line: print('lock_location',name,i,'version',lock['node_modules/'+name]['version'])
PY
````

Output summary:

````text
environment_reads
dynamic_execution
content.js:19: // Fixed literal, safe for innerHTML: x.com serves no trusted-types CSP
content.js:53: btn.innerHTML = ICON_SVG;
unfinished_markers
browser_events
background.js:16: chrome.runtime.onInstalled.addListener(() => {
background.js:35: chrome.runtime.onMessage.addListener((msg, sender, reply) => {
background.js:57: chrome.action.onClicked.addListener((tab) => {
content.js:191: document.addEventListener(
content.js:236: const observer = new MutationObserver(collectMutations);
content.js:251: document.addEventListener('visibilitychange', () => setObserving(!document.hidden));
network_or_persistence
background.js:78: await chrome.downloads.download({
background.js:92: response = await fetch(
lock_location eslint 445 version 9.39.5
lock_location @eslint/js 140 version 9.39.5
lock_location prettier 985 version 3.9.5
lock_location globals 684 version 15.15.0
lock_location ajv 280 version 6.15.0
lock_location minimatch 865 version 3.1.5
lock_location cross-spawn 392 version 7.0.6
````

## C014 — Record audit-only tool versions and inspect exact lockfile ranges used in findings

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
import json,hashlib
root=Path('/tmp/xvid-audit-tools-30nna45s/tooling/dom-model/node_modules')
rows=[]
for p in sorted(root.rglob('package.json')):
 parts=p.relative_to(root).parts
 if parts[-1]!='package.json': continue
 try: data=json.loads(p.read_text())
 except (ValueError,UnicodeError):continue
 if 'name' in data and 'version' in data:
  rows.append({'path':str(p.relative_to(root)),'name':data['name'],'version':data['version']})
Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/dom-tool-installed-versions.json').write_text(json.dumps(rows,indent=2)+'\n')
lock=root/'.package-lock.json'
if lock.exists():Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/dom-tool-package-lock.json').write_bytes(lock.read_bytes())
print('Audit DOM package manifests recorded:',len(rows),'hidden lock available:',lock.exists())
print('resolved dependency source excerpts:')
lines=Path('package-lock.json').read_text().splitlines()
for start,end in [(140,152),(445,502),(684,696),(985,1005)]:
 for n in range(start,end+1):print(f'package-lock.json:{n}: {lines[n-1]}')
PY
````

Output summary:

````text
Recorded 38 audit-only DOM package manifests and npm hidden lock. Read exact direct lock ranges 140-152, 445-502, 684-696, 985-1005.
````

## D001 — Bootstrap npm solely in disposable copy and retrieve direct dependency public release metadata

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
timeout 90s python3 '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/prepare_tooling.py' '/tmp/xvid-audit-kyq46bbr/audit-tools'
````

Output summary:

````text
[
  {
    "package": "npm",
    "version": "12.0.2",
    "license": "Artistic-2.0",
    "engines": {
      "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
    },
    "source": "https://registry.npmjs.org/npm/latest",
    "retrieved_utc": "2026-09-07T23:16:44.127985+00:00",
    "verified_tarball_integrity": true
  },
  {
    "package": "eslint",
    "version": "10.10.0",
    "license": "MIT",
    "engines": {
      "node": "^20.19.0 || ^22.13.0 || >=24"
    },
    "source": "https://registry.npmjs.org/eslint/latest",
    "retrieved_utc": "2026-09-07T23:16:44.430813+00:00"
  },
  {
    "package": "@eslint/js",
    "version": "10.0.1",
    "license": "MIT",
    "engines": {
      "node": "^20.19.0 || ^22.13.0 || >=24"
    },
    "source": "https://registry.npmjs.org/%40eslint%2Fjs/latest",
    "retrieved_utc": "2026-09-07T23:16:44.683394+00:00"
  },
  {
    "package": "globals",
    "version": "17.12.0",
    "license": "MIT",
    "engines": {
      "node": ">=18"
    },
    "source": "https://registry.npmjs.org/globals/latest",
    "retrieved_utc": "2026-09-07T23:16:44.722066+00:00"
  },
  {
    "package": "prettier",
    "version": "3.9.6",
    "license": "MIT",
    "engines": {
      "node": ">=14"
    },
    "source": "https://registry.npmjs.org/prettier/latest",
    "retrieved_utc": "2026-09-07T23:16:44.956506+00:00"
  }
]
````

## D002 — Move tooling out of snapshot to keep baseline lint/format scope unchanged

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import pathlib,tempfile,os,json
base=pathlib.Path(tempfile.mkdtemp(prefix='xvid-audit-tools-'))
os.rename('audit-tools',base/'tooling')
print(json.dumps({'tools':str(base/'tooling'),'scratch':str(base)}))
PY
````

Output summary:

````text
{"tools": "/tmp/xvid-audit-tools-30nna45s/tooling", "scratch": "/tmp/xvid-audit-tools-30nna45s"}
````

## D003 — Install exact locked dev tools with scripts disabled and clean credential-free npm configuration

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 1.

Audit setup error: npm rejected duplicate user/global config paths; fixed once in D004-D005.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig=/dev/null npm_config_globalconfig=/dev/null npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false npm_config_fetch_retries=0 timeout 90s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' ci --ignore-scripts --no-audit --no-fund
````

Output summary:

````text
Exit prior to config file resolving
cause
double-loading config "/dev/null" as "global", previously loaded as "user"
````

## D004 — Create distinct empty npm config files after duplicate config path rejection

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
base=Path('/tmp/xvid-audit-tools-30nna45s/tooling')
for name in ['npm-user.conf','npm-global.conf']:
 (base/name).write_text('')
PY
````

Output summary:

````text
Public-source retrieval completed.
````

## D005 — Run exact-lock install with distinct isolated npm configs; retry of D003 setup failure

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false npm_config_fetch_retries=0 timeout 90s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' ci --ignore-scripts --no-audit --no-fund
````

Output summary:

````text
added 88 packages in 874ms
````

## D006 — Run documented ESLint baseline on unchanged snapshot

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' run lint
````

Output summary:

````text
npm notice run xhelper@3.6.0 lint
npm notice run eslint .
````

## D007 — Run documented Prettier baseline on unchanged snapshot

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' run format:check
````

Output summary:

````text
npm notice run xhelper@3.6.0 format:check
npm notice run prettier --check .
Checking formatting...
All matched files use Prettier code style!
````

## D008 — Check baseline JavaScript parseability with available Node (not Chrome compatibility)

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import subprocess
for name in ['background.js','content.js','eslint.config.mjs']:
 p=subprocess.run(['node','--check',name],capture_output=True,text=True,timeout=10)
 print(name,'exit',p.returncode,(p.stdout+p.stderr).strip())
 if p.returncode: raise SystemExit(p.returncode)
PY
````

Output summary:

````text
background.js exit 0
content.js exit 0
eslint.config.mjs exit 0
````

## D009 — Execute 11 bounded synthetic background assertions against unchanged source; network/download APIs stubbed

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
timeout 20s node '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/probes/background-probe.cjs' '/tmp/xvid-audit-kyq46bbr'
````

Output summary:

````text
{
  "method": "Node VM; all browser/network APIs stubbed; assertions are audit artifacts",
  "results": [
    {
      "name": "BG-01 malformed request ID is rejected before fetch; unknown action ignored",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-02 toolbar URL and post boundary parsing",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-03 variant ranking coerces bitrate and uses resolution tie break",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-04 defensive URL allowlist rejects non-HTTPS and other domains",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-05 own media wins, then quote before reply parent",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-06 malformed filename metadata falls back to safe fields",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-07 multi-video downloads start sequentially with unique suffixes",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-08 lookup error translations and response body cancellation",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-09 toolbar failure and ad canary badges retain originating tab",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-10 download rejection propagates; success acknowledges start only",
      "status": "passed",
      "details": null
    },
    {
      "name": "BG-11 mixed exposed/non-MP4 media currently reports aggregate success",
      "status": "passed",
      "details": "Characterization only: 1 of 2 video items has an allowed MP4; unsupported item skipped without warning."
    }
  ],
  "passed": 11,
  "failed": 0
}
````

## D010 — Run 11 native browser synthetic DOM assertions; four intended regression expectations test suspected defects

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **timed out**; exit code: 124.

Native browser verification unavailable: bounded timeout; root cause unresolved, not an extension defect.

````bash
timeout 30s python3 '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/probes/run_browser.py' '/tmp/xvid-audit-kyq46bbr' '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7' '/tmp/xvid-audit-tools-30nna45s'
````

Output summary:

````text
TIMED OUT after 25 seconds
````

## D011 — Inspect only audit-created browser processes after bounded timeout

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import subprocess,pathlib,json
p=subprocess.run(['ps','-eo','pid,ppid,args'],capture_output=True,text=True,timeout=5)
for line in p.stdout.splitlines():
 if '/tmp/xvid-audit-tools-30nna45s/chromium-profile-' in line and 'chrome' in line.split(None,2)[-1].split()[0]: print(line)
print('profile count:',len(list(pathlib.Path('/tmp/xvid-audit-tools-30nna45s').glob('chromium-profile-*'))))
PY
````

Output summary:

````text
profile count: 1
````

## D012 — One bounded browser startup diagnostic with blank page and process-group cleanup

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **timed out**; exit code: 124.

Native browser verification unavailable: bounded timeout; root cause unresolved, not an extension defect.

````bash
timeout 18s python3 - <<'PY'
import subprocess,tempfile,pathlib,os,signal,json
profile=tempfile.mkdtemp(prefix='chromium-smoke-',dir='/tmp/xvid-audit-tools-30nna45s')
args=['chromium','--headless','--no-sandbox','--no-zygote','--disable-dev-shm-usage','--disable-gpu','--disable-background-networking','--disable-component-update','--no-first-run','--disable-extensions','--host-resolver-rules=MAP * ~NOTFOUND','--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=<-loopback>','--user-data-dir='+profile,'--timeout=5000','--dump-dom','about:blank']
p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
try:
 out,err=p.communicate(timeout=12); status='completed';code=p.returncode
except subprocess.TimeoutExpired:
 os.killpg(p.pid,signal.SIGKILL);out,err=p.communicate(timeout=2);status='timed out';code=124
result={'argv':args,'status':status,'exit_code':code,'stdout':out[-1000:],'stderr':err[-3000:]}
pathlib.Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/browser-smoke.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(code)
PY
````

Output summary:

````text
{
  "argv": [
    "chromium",
    "--headless",
    "--no-sandbox",
    "--no-zygote",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--disable-extensions",
    "--host-resolver-rules=MAP * ~NOTFOUND",
    "--proxy-server=http://127.0.0.1:9",
    "--proxy-bypass-list=<-loopback>",
    "--user-data-dir=/tmp/xvid-audit-tools-30nna45s/chromium-smoke-vmda7nq4",
    "--timeout=5000",
    "--dump-dom",
    "about:blank"
  ],
  "status": "timed out",
  "exit_code": 124,
  "stdout": "",
  "stderr": "[402644:402644:0908/012247.969951:ERROR:components/dbus/xdg/request.cc:173] Request ended (non-user cancelled).\n[402644:402644:0908/012247.978525:ERROR:chrome/browser/component_updater/optimization_guide_on_device_model_installer.cc:597] Failed to update on-device model component with error 5\n"
}
````

## D013 — Inspect audit-only DOM model package metadata before isolated installation

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
timeout 15s python3 - <<'PY'
import urllib.request,json,pathlib,datetime
url='https://registry.npmjs.org/jsdom/latest'
with urllib.request.urlopen(url,timeout=10) as r: data=json.loads(r.read(3000000))
record={k:data.get(k) for k in ['name','version','license','engines','scripts']};record['source']=url;record['retrieved_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
pathlib.Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/dom-tool-metadata.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
PY
````

Output summary:

````text
{
  "name": "jsdom",
  "version": "30.0.1",
  "license": "MIT",
  "engines": {
    "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
  },
  "scripts": {
    "lint": "eslint --cache",
    "test": "npm-run-all --continue-on-error test:*",
    "prepare": "wireit",
    "pretest": "npm run prepare && npm run wpt:init",
    "test:api": "mocha test/api/",
    "test:wpt": "mocha test/web-platform-tests/run-wpts.js",
    "wpt:init": "git submodule update --init --recursive",
    "benchmark": "node ./benchmark/runner",
    "wpt:reset": "rm -rf ./test/web-platform-tests/tests && npm run wpt:init",
    "test:tuwpt": "mocha test/web-platform-tests/run-tuwpts.js",
    "wpt:update": "git submodule update --init --recursive --remote && cd test/web-platform-tests/tests && python wpt.py manifest --path ../wpt-manifest.json",
    "benchmark:compare": "node ./benchmark/compare",
    "test:tuwpt:browser": "node scripts/verify-tuwpts-in-browser.js",
    "prepare:convert-idl": "wireit",
    "test:to-port-to-wpts": "mocha test/to-port-to-wpts/ && mocha test/to-port-to-wpts/level1/ && mocha test/to-port-to-wpts/level2/ && mocha test/to-port-to-wpts/level3/",
    "prepare:generate-event-sets": "wireit",
    "prepare:generate-js-globals": "wireit",
    "prepare:generate-css-style-properties": "wireit"
  },
  "source": "https://registry.npmjs.org/jsdom/latest",
  "retrieved_utc": "2026-09-07T23:24:11.888081+00:00"
}
````

## D014 — Install a pinned DOM model only outside the repository snapshot, lifecycle disabled

Working directory: `/tmp/xvid-audit-tools-30nna45s`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false npm_config_fetch_retries=0 timeout 90s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' install --prefix '/tmp/xvid-audit-tools-30nna45s/tooling/dom-model' --ignore-scripts --no-save --package-lock=false --no-audit --no-fund jsdom@30.0.1
````

Output summary:

````text
added 38 packages in 1s
````

## D015 — Run 11 DOM model scenarios, with explicit visibility shim and synthetic controlled click-handler scheduling

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 1.

Four intended regression assertions fail; confirmed controlled cases F-001–F-004.

````bash
timeout 20s node '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/probes/run_dom_model.cjs' '/tmp/xvid-audit-kyq46bbr' '/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7' '/tmp/xvid-audit-tools-30nna45s/tooling/dom-model'
````

Output summary:

````text
{
  "method": "jsdom 30.0.1 DOM model; unchanged content.js/content.css; no resource loading; chrome messaging stubbed; offsetParent explicitly models display:none ancestry because there is no layout. Not Chrome validation. DOM-11 invokes the captured handler using a synthetic event record and controlled timers.",
  "results": [
    {
      "name": "DOM-01 DOM initial injection and duplicate prevention",
      "status": "passed",
      "details": null
    },
    {
      "name": "DOM-02 MutationObserver model sees batch inserts and removed buttons",
      "status": "passed",
      "details": null
    },
    {
      "name": "DOM-03 nested quotes with both action bars preserve independent buttons",
      "status": "passed",
      "details": null
    },
    {
      "name": "DOM-04 page-owned class does not suppress injection; synthetic DOM click ignored",
      "status": "passed",
      "details": null
    },
    {
      "name": "DOM-05 observing helper disconnects and rescan recovers on resume",
      "status": "passed",
      "details": "Calls visibility helper directly; actual hidden-tab transition was not exercised."
    },
    {
      "name": "DOM-06 CSS model hides marked timeline/sidebar ads and retains organic sibling",
      "status": "passed",
      "details": null
    },
    {
      "name": "DOM-07 English ad canary hides markerless cell and sends one diagnostic",
      "status": "passed",
      "details": null
    },
    {
      "name": "DOM-08 REGRESSION: retained button must follow changed post identity",
      "status": "failed",
      "error": "retained button binding: expected \"2222222222\", observed \"1111111111\""
    },
    {
      "name": "DOM-09 REGRESSION: organic content in a reused ad cell must become visible",
      "status": "failed",
      "error": "recycled organic cell visibility: expected \"block\", observed \"none\""
    },
    {
      "name": "DOM-10 REGRESSION: temporarily missing outer bar must not use nested quote bar",
      "status": "failed",
      "error": "inner bar bindings after three sweeps: expected \"[\\\"2222222222\\\"]\", observed \"[\\\"1111111111\\\",\\\"1111111111\\\",\\\"1111111111\\\"]\""
    },
    {
      "name": "DOM-11 REGRESSION: late response A must not settle newer request B",
      "status": "failed",
      "error": "current request feedback after late A reply: expected \"Synthetic current request B failed\", observed \"Download started\""
    }
  ],
  "passed": 7,
  "failed": 4
}
````

## E001 — Verify Chrome API/lifetime contract and Node support using primary documentation

Working directory: `not applicable (web tool)`. Environment: Public primary-source retrieval; no repository content submitted.

Status: **passed**; exit code: not applicable.

Completed within the stated inspection or synthetic execution scope.

````json
{"search_query":[{"q":"site.developer.chrome.com docs extensions reference api downloads download promise initiated saveAs"},{"q":"site.developer.chrome.com docs extensions develop concepts service-workers lifecycle Chrome 116 five minutes downloads"},{"q":"site.nodejs.org en about previous releases Node.js 20 end of life April 2026"}],"response_length":"long"}
````

Output summary:

````text
Primary Chrome download/lifecycle docs and Node support search. Only primary results used; search snippets about last-updated dates were not treated as EOL dates.
````

## E002 — Query npm advisory database using only public resolved dependency names and versions

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
timeout 30s python3 - <<'PY'
import json,pathlib,urllib.request,collections,datetime
packages=json.loads(pathlib.Path('package-lock.json').read_text())['packages']
public=collections.defaultdict(set)
for path,item in packages.items():
 if not path: continue
 assert item['resolved'].startswith('https://registry.npmjs.org/')
 public[path.rsplit('node_modules/',1)[-1]].add(item['version'])
payload={k:sorted(v) for k,v in public.items()}
url='https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'
request=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(request,timeout=20) as r: data=json.loads(r.read(5000000))
record={'source':url,'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'npm registry bulk advisory API; only public package names and versions, no root metadata or source','package_names':len(public),'installed_entries':len(packages)-1,'advisories':data}
pathlib.Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/dependency-advisories.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
PY
````

Output summary:

````text
{
  "source": "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
  "retrieved_utc": "2026-09-07T23:17:59.330528+00:00",
  "method": "npm registry bulk advisory API; only public package names and versions, no root metadata or source",
  "package_names": 86,
  "installed_entries": 88,
  "advisories": {}
}
````

## E003 — Read primary runtime support and browser API/match-pattern documentation

Working directory: `not applicable (web tool)`. Environment: Public primary-source retrieval; no repository content submitted.

Status: **passed**; exit code: not applicable.

Completed within the stated inspection or synthetic execution scope.

````json
{"open":[{"ref_id":"https://github.com/nodejs/Release"},{"ref_id":"https://developer.chrome.com/docs/extensions/reference/api/downloads"},{"ref_id":"https://eslint.org/version-support/"},{"ref_id":"https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns"}],"response_length":"long"}
````

Output summary:

````text
Read official Node schedule, Chrome downloads/match-pattern docs and ESLint support. Node 20 EOL 2026-04-30; Node 24 supported at retrieval.
````

## E004 — Read exact support statuses and restricted host pattern semantics

Working directory: `not applicable (web tool)`. Environment: Public primary-source retrieval; no repository content submitted.

Status: **passed**; exit code: not applicable.

Completed within the stated inspection or synthetic execution scope.

````json
{"find":[{"ref_id":"https://developer.chrome.com/docs/extensions/reference/api/downloads","pattern":"### download"},{"ref_id":"https://eslint.org/version-support/","pattern":"v9"}],"open":[{"ref_id":"https://eslint.org/version-support/","lineno":36},{"ref_id":"https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns","lineno":64}],"response_length":"medium"}
````

Output summary:

````text
Read exact download-start API semantics and ESLint 9 support table: v9 EOL 2026-08-06; v10 current.
````

## E005 — Verify exact direct dependency versions, engines, and declared license in primary registry metadata

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import json,pathlib,urllib.request,urllib.parse,datetime
lock=json.loads(pathlib.Path('package-lock.json').read_text())['packages'];rows=[]
for name in ['eslint','@eslint/js','globals','prettier']:
 resolved=lock['node_modules/'+name]['version'];url='https://registry.npmjs.org/'+urllib.parse.quote(name,safe='')+'/'+resolved
 with urllib.request.urlopen(url,timeout=10) as response: data=json.loads(response.read(3000000))
 rows.append({'name':name,'resolved_version':resolved,'registry_version':data['version'],'license':data.get('license'),'engines':data.get('engines'),'source':url,'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()})
pathlib.Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/resolved-dependency-metadata.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
PY
````

Output summary:

````text
[
  {
    "name": "eslint",
    "resolved_version": "9.39.5",
    "registry_version": "9.39.5",
    "license": "MIT",
    "engines": {
      "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
    },
    "source": "https://registry.npmjs.org/eslint/9.39.5",
    "retrieved_utc": "2026-09-07T23:23:17.452746+00:00"
  },
  {
    "name": "@eslint/js",
    "resolved_version": "9.39.5",
    "registry_version": "9.39.5",
    "license": "MIT",
    "engines": {
      "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
    },
    "source": "https://registry.npmjs.org/%40eslint%2Fjs/9.39.5",
    "retrieved_utc": "2026-09-07T23:23:17.686526+00:00"
  },
  {
    "name": "globals",
    "resolved_version": "15.15.0",
    "registry_version": "15.15.0",
    "license": "MIT",
    "engines": {
      "node": ">=18"
    },
    "source": "https://registry.npmjs.org/globals/15.15.0",
    "retrieved_utc": "2026-09-07T23:23:17.909046+00:00"
  },
  {
    "name": "prettier",
    "resolved_version": "3.9.5",
    "registry_version": "3.9.5",
    "license": "MIT",
    "engines": {
      "node": ">=14"
    },
    "source": "https://registry.npmjs.org/prettier/3.9.5",
    "retrieved_utc": "2026-09-07T23:23:18.182164+00:00"
  }
]
````

## E006 — Verify current official Actions majors and their JavaScript runtime before completing CI Node support fix

Working directory: `not applicable (web tool)`. Environment: Public primary-source retrieval; no repository content submitted.

Status: **passed**; exit code: not applicable.

Completed within the stated inspection or synthetic execution scope.

````json
{"open":[{"ref_id":"https://raw.githubusercontent.com/actions/checkout/v6/action.yml"},{"ref_id":"https://raw.githubusercontent.com/actions/setup-node/v6/action.yml"},{"ref_id":"https://github.com/actions/setup-node"}],"response_length":"short"}
````

Output summary:

````text
Official checkout v6 and setup-node v6 action definitions both specify Node 24 runtime. Only action/runtime metadata used.
````

## E007 — Re-query advisory database after authorized dependency upgrades using public names/versions only

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
timeout 30s python3 - <<'PY'
import json,pathlib,urllib.request,collections,datetime
lock=json.loads(pathlib.Path('package-lock.json').read_text());packages=lock['packages'];names=collections.defaultdict(set)
for path,item in packages.items():
 if not path:continue
 assert item.get('dev') and item.get('integrity') and item['resolved'].startswith('https://registry.npmjs.org/')
 names[path.rsplit('node_modules/',1)[-1]].add(item['version'])
url='https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'
request=urllib.request.Request(url,data=json.dumps({k:sorted(v) for k,v in names.items()}).encode(),headers={'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(request,timeout=20) as r:data=json.loads(r.read(5000000))
result={'source':url,'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'remediated lock; public package names and versions only','package_names':len(names),'resolved_entries':len(packages)-1,'runtime_dependencies':0,'advisories':data,'direct_versions':{k:packages['node_modules/'+k]['version'] for k in packages['']['devDependencies']},'has_install_script':[k for k,v in packages.items() if v.get('hasInstallScript')]}
pathlib.Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/remediation-dependency-advisories.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
PY
````

Output summary:

````text
{
  "source": "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
  "retrieved_utc": "2026-09-07T23:54:48.769516+00:00",
  "scope": "remediated lock; public package names and versions only",
  "package_names": 114,
  "resolved_entries": 117,
  "runtime_dependencies": 0,
  "advisories": {},
  "direct_versions": {
    "@eslint/js": "10.0.1",
    "eslint": "10.10.0",
    "globals": "15.15.0",
    "jsdom": "30.0.1",
    "prettier": "3.9.5"
  },
  "has_install_script": []
}
````

## I001 — Run proposed regression suite against unchanged runtime before fixes, using audit-only DOM dependency

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 1.

Pre-fix regressions plus two initial canary fixture-timing errors, corrected in I002.

````bash
env NODE_PATH='/tmp/xvid-audit-tools-30nna45s/tooling/dom-model/node_modules' timeout 30s node --test tests/content.test.cjs
````

Output summary:

````text
Pre-fix content suite: 12 tests, 4 pass / 8 fail. Two ad tests initially failed before their intended assertion because fixtures did not wait for the existing canary throttle; corrected in I002.
````

## I002 — Correct canary fixture timing to respect five-second scan throttle; establish pre-fix failures at intended assertions

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **failed**; exit code: 1.

Eight pre-fix assertions fail after fixture correction; manifestations of four existing findings.

````bash
env NODE_PATH='/tmp/xvid-audit-tools-30nna45s/tooling/dom-model/node_modules' timeout 30s node --test tests/content.test.cjs
````

Output summary:

````text
Corrected pre-fix suite: 12 tests, 4 pass / 8 fail at intended request/post/bar/visibility ownership assertions. Test source retained; format-only changes later.
````

## I003 — Run retained regression suite after request/post/bar/ad ownership fixes in disposable copy

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env NODE_PATH='/tmp/xvid-audit-tools-30nna45s/tooling/dom-model/node_modules' timeout 30s node --test tests/content.test.cjs
````

Output summary:

````text
✔ late responses cannot settle a newer attempt after a timeout (108.583156ms)
✔ a timed-out reply is ignored without a retry; Save As has no UI deadline (17.601039ms)
✔ retained post identity is reconciled on href changes and again at click time (21.692019ms)
✔ removing video removes its old actionable control and invalidates replies (14.181141ms)
✔ partial nested action bars retain correct ownership; inner first: false (21.436994ms)
✔ partial nested action bars retain correct ownership; inner first: true (19.355011ms)
✔ an outer post without its own permalink waits instead of borrowing its quote ID (14.721634ms)
✔ fallback-hidden ad cells reveal organic replacements while preserving host styles (56.841127ms)
✔ fallback hiding reconciles text-only reuse even before the next canary scan (21.006501ms)
✔ batch discovery, removed control recovery and visibility resume preserve one button (17.776129ms)
✔ page-owned classes and untrusted clicks are ignored; busy clicks do not duplicate requests (15.893854ms)
✔ CSS hides marked ads without hiding an organic sidebar sibling (11.773906ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 734.827787
````

## I004 — Retain background characterization scenarios as Node built-in tests without runtime exports

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
p=Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/probes/background-probe.cjs').read_text()
p=p.replace('// Audit-only assertions against unmodified source loaded in node:vm.','// Regression checks load the actual background script in node:vm.')
p=p.replace("const rows = [];", "const test = require('node:test');")
p=p.replace("path.join(process.argv[2], 'background.js')", "path.join(__dirname, '..', 'background.js')")
start=p.index('async function check(');end=p.index('(async()=>{',start)
p=p[:start]+p[end+len('(async()=>{'):]
p=p[:p.index('  console.log(JSON.stringify({method:')]
p=p.replace('await check(', 'test(')
Path('tests/background.test.cjs').write_text(p.rstrip()+'\n')
PY
````

Output summary:

````text
Public-source retrieval completed.
````

## I005 — Upgrade supported lint tooling, add dev-only DOM test model and regenerate npm lock in disposable copy

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false npm_config_fetch_retries=0 timeout 90s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' install --save-dev --ignore-scripts --no-audit --no-fund 'eslint@^10.10.0' '@eslint/js@^10.0.1' 'jsdom@^30.0.1'
````

Output summary:

````text
added 47 packages, removed 18 packages, and changed 19 packages in 3s
````

## I006 — Run complete retained test suite on changed snapshot

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' test
````

Output summary:

````text
npm notice run xhelper@3.6.1 test
npm notice run node --test tests/*.test.cjs
✔ BG-01 malformed request ID is rejected before fetch; unknown action ignored (5.55057ms)
✔ BG-02 toolbar URL and post boundary parsing (1.252533ms)
✔ BG-03 variant ranking coerces bitrate and uses resolution tie break (1.311989ms)
✔ BG-04 defensive URL allowlist rejects non-HTTPS and other domains (4.70011ms)
✔ BG-05 own media wins, then quote before reply parent (1.949663ms)
✔ BG-06 malformed filename metadata falls back to safe fields (0.99487ms)
✔ BG-07 multi-video downloads start sequentially with unique suffixes (3.856919ms)
✔ BG-08 lookup error translations and response body cancellation (4.18689ms)
✔ BG-09 toolbar failure and ad canary badges retain originating tab (1.805081ms)
✔ BG-10 download rejection propagates; success acknowledges start only (1.428739ms)
✔ BG-11 mixed exposed/non-MP4 media currently reports aggregate success (1.027451ms)
✔ late responses cannot settle a newer attempt after a timeout (107.795197ms)
✔ a timed-out reply is ignored without a retry; Save As has no UI deadline (18.240936ms)
✔ retained post identity is reconciled on href changes and again at click time (19.723464ms)
✔ removing video removes its old actionable control and invalidates replies (16.486343ms)
✔ partial nested action bars retain correct ownership; inner first: false (21.252517ms)
✔ partial nested action bars retain correct ownership; inner first: true (18.832128ms)
✔ an outer post without its own permalink waits instead of borrowing its quote ID (16.268071ms)
✔ fallback-hidden ad cells reveal organic replacements while preserving host styles (58.808967ms)
✔ fallback hiding reconciles text-only reuse even before the next canary scan (21.945655ms)
✔ batch discovery, removed control recovery and visibility resume preserve one button (22.0129ms)
✔ page-owned classes and untrusted clicks are ignored; busy clicks do not duplicate requests (11.577916ms)
✔ CSS hides marked ads without hiding an organic sidebar sibling (11.841664ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 790.58585
````

## I007 — Run upgraded ESLint on runtime, tests and configuration

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' run lint
````

Output summary:

````text
npm notice run xhelper@3.6.1 lint
npm notice run eslint .
````

## I008 — Review complete changed runtime, test registrations and developer setup before final gates

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
for name in ['content.js','tests/background.test.cjs','package.json','CLAUDE.md','.github/workflows/lint.yml']:
 print('FILE',name)
 for i,line in enumerate(Path(name).read_text().splitlines(),1):
  if name!='CLAUDE.md' or 55<=i<=75:print(f'{i}: {line}')
PY
````

Output summary:

````text
Reviewed complete changed content.js, background test registrations, package engines/dependencies, updated contributor setup and CI. Corrected two comment/grammar issues before final formatting.
````

## I009 — Apply documented formatter only in the disposable implementation copy

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' run format
````

Output summary:

````text
npm notice run xhelper@3.6.1 format
npm notice run prettier --write .
.github/workflows/lint.yml 10ms (unchanged)
.prettierrc 12ms (unchanged)
AGENTS.md 31ms (unchanged)
background.js 42ms (unchanged)
CHANGELOG.md 27ms (unchanged)
CLAUDE.md 12ms (unchanged)
content.css 19ms (unchanged)
content.js 17ms
CONTRIBUTING.md 4ms (unchanged)
eslint.config.mjs 3ms (unchanged)
manifest.json 1ms (unchanged)
package.json 1ms (unchanged)
README.md 7ms (unchanged)
tests/background.test.cjs 18ms
tests/content-fixture.cjs 8ms
tests/content.test.cjs 15ms
````

## I010 — Verify fresh exact-lock installation of supported development toolchain after final source changes

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 60s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' ci --ignore-scripts --no-audit --no-fund
````

Output summary:

````text
added 117 packages in 1s
````

## I011 — Final test suite after clean install and formatting

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' test
````

Output summary:

````text
npm notice run xhelper@3.6.1 test
npm notice run node --test tests/*.test.cjs
✔ BG-01 malformed request ID is rejected before fetch; unknown action ignored (6.738612ms)
✔ BG-02 toolbar URL and post boundary parsing (1.688902ms)
✔ BG-03 variant ranking coerces bitrate and uses resolution tie break (1.429798ms)
✔ BG-04 defensive URL allowlist rejects non-HTTPS and other domains (1.514678ms)
✔ BG-05 own media wins, then quote before reply parent (2.065275ms)
✔ BG-06 malformed filename metadata falls back to safe fields (1.213236ms)
✔ BG-07 multi-video downloads start sequentially with unique suffixes (7.325206ms)
✔ BG-08 lookup error translations and response body cancellation (5.606381ms)
✔ BG-09 toolbar failure and ad canary badges retain originating tab (2.656011ms)
✔ BG-10 download rejection propagates; success acknowledges start only (1.821555ms)
✔ BG-11 mixed exposed/non-MP4 media currently reports aggregate success (1.335018ms)
✔ late responses cannot settle a newer attempt after a timeout (107.456632ms)
✔ a timed-out reply is ignored without a retry; Save As has no UI deadline (16.266756ms)
✔ retained post identity is reconciled on href changes and again at click time (21.529302ms)
✔ removing video removes its old actionable control and invalidates replies (15.290747ms)
✔ partial nested action bars retain correct ownership; inner first: false (21.713858ms)
✔ partial nested action bars retain correct ownership; inner first: true (18.870313ms)
✔ an outer post without its own permalink waits instead of borrowing its quote ID (15.070235ms)
✔ fallback-hidden ad cells reveal organic replacements while preserving host styles (57.581382ms)
✔ fallback hiding reconciles text-only reuse even before the next canary scan (21.633728ms)
✔ batch discovery, removed control recovery and visibility resume preserve one button (18.92691ms)
✔ page-owned classes and untrusted clicks are ignored; busy clicks do not duplicate requests (15.871366ms)
✔ CSS hides marked ads without hiding an organic sidebar sibling (10.685581ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 887.049184
````

## I012 — Final lint on supported toolchain

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' run lint
````

Output summary:

````text
npm notice run xhelper@3.6.1 lint
npm notice run eslint .
````

## I013 — Final formatting gate

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
env -i PATH=/home/adam/.local/bin:/usr/bin:/bin npm_config_userconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-user.conf' npm_config_globalconfig='/tmp/xvid-audit-tools-30nna45s/tooling/npm-global.conf' npm_config_cache='/tmp/xvid-audit-tools-30nna45s/tooling/cache' npm_config_update_notifier=false timeout 30s node '/tmp/xvid-audit-tools-30nna45s/tooling/npm-tool/package/bin/npm-cli.js' run format:check
````

Output summary:

````text
npm notice run xhelper@3.6.1 format:check
npm notice run prettier --check .
Checking formatting...
All matched files use Prettier code style!
````

## I014 — Copy only authorized, reviewed and tested changes into checkout after verifying no concurrent tracked/user edits; preserve implementation patch and hashes

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
from pathlib import Path
import json,hashlib,difflib,shutil,subprocess
root=Path('/home/adam/projects/xvid');source=Path('/tmp/xvid-audit-kyq46bbr');output=Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7')
manifest=json.loads((output/'baseline-manifest.json').read_text())
allowed={'content.js','content.css','manifest.json','package.json','package-lock.json','eslint.config.mjs','.prettierignore','.github/workflows/lint.yml','README.md','CONTRIBUTING.md','CLAUDE.md','CHANGELOG.md'}
changed=[]
for item in manifest:
 name=item['path']
 if hashlib.sha256((root/name).read_bytes()).hexdigest()!=item['sha256']:raise RuntimeError('Original file changed during remediation: '+name)
 if hashlib.sha256((source/name).read_bytes()).hexdigest()!=item['sha256']:
  if name not in allowed:raise RuntimeError('Unexpected implementation change: '+name)
  changed.append(name)
added=['tests/background.test.cjs','tests/content-fixture.cjs','tests/content.test.cjs']
for name in added:
 if (root/name).exists():raise RuntimeError('Refusing to overwrite existing user file: '+name)
patch=[]
for name in changed+added:
 old=(root/name).read_text().splitlines(keepends=True) if (root/name).exists() else []
 new=(source/name).read_text().splitlines(keepends=True)
 patch.extend(difflib.unified_diff(old,new,fromfile='a/'+name if old else '/dev/null',tofile='b/'+name))
(output/'implementation.patch').write_text(''.join(patch))
for name in changed+added:
 (root/name).parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(source/name,root/name)
records=[{'path':name,'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest(),'bytes':(root/name).stat().st_size} for name in changed+added]
(output/'remediation-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps({'changed':changed,'added':added,'all_copied_files_match_tested_snapshot':all((root/x).read_bytes()==(source/x).read_bytes() for x in changed+added)},indent=2))
print(subprocess.check_output(['git','diff','--stat'],cwd=root,text=True))
PY
````

Output summary:

````text
{
  "changed": [
    ".github/workflows/lint.yml",
    ".prettierignore",
    "CHANGELOG.md",
    "CLAUDE.md",
    "CONTRIBUTING.md",
    "README.md",
    "content.css",
    "content.js",
    "eslint.config.mjs",
    "manifest.json",
    "package-lock.json",
    "package.json"
  ],
  "added": [
    "tests/background.test.cjs",
    "tests/content-fixture.cjs",
    "tests/content.test.cjs"
  ],
  "all_copied_files_match_tested_snapshot": true
}
 .github/workflows/lint.yml |   9 +-
 .prettierignore            |   1 +
 CHANGELOG.md               |  13 +
 CLAUDE.md                  |   9 +-
 CONTRIBUTING.md            |   9 +-
 README.md                  |  20 +-
 content.css                |   1 +
 content.js                 | 181 ++++++---
 eslint.config.mjs          |   9 +-
 manifest.json              |   2 +-
 package-lock.json          | 992 ++++++++++++++++++++++++++++++++-------------
 package.json               |  10 +-
 12 files changed, 894 insertions(+), 362 deletions(-)
````

## I015 — Locate final remediation source lines for the finding-resolution record

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
rg -n '^function (getTweetId|findActionBar|resetButton|reconcileButton|adCanary|finishRequest|setObserving)|requests\.|reconcileButton\(|attributeFilter|hiddenAdCells|xvd-hidden-ad|node-version|uses:|npm test|"node"|"test"|"jsdom"|"eslint"' content.js content.css package.json .github/workflows/lint.yml
````

Output summary:

````text
.github/workflows/lint.yml:13:      - uses: actions/checkout@v6
.github/workflows/lint.yml:14:      - uses: actions/setup-node@v6
.github/workflows/lint.yml:16:          node-version: 24
.github/workflows/lint.yml:19:      - run: npm test
content.css:54:div[data-testid='cellInnerDiv'].xvd-hidden-ad,
content.js:25:function getTweetId(block) {
content.js:36:function findActionBar(block) {
content.js:85:function resetButton(btn) {
content.js:86:  clearTimeout(requests.get(btn)?.timeout);
content.js:87:  requests.delete(btn);
content.js:94:function reconcileButton(block) {
content.js:119:    if (block.isConnected) reconcileButton(block);
content.js:134:const HIDDEN_AD_CLASS = 'xvd-hidden-ad';
content.js:135:const hiddenAdCells = new Set();
content.js:149:function adCanary() {
content.js:152:  for (const cell of hiddenAdCells) {
content.js:155:      hiddenAdCells.delete(cell);
content.js:167:      hiddenAdCells.add(cell);
content.js:202:  if (pendingTweets.size || hiddenAdCells.size || Date.now() >= nextCanaryAt) scheduleSweep();
content.js:238:function finishRequest(btn, request, ok, title) {
content.js:239:  if (requests.get(btn) !== request) return;
content.js:241:  requests.delete(btn);
content.js:260:    reconcileButton(block);
content.js:262:    if (!id || !btn.isConnected || requests.has(btn)) return;
content.js:267:    requests.set(btn, request);
content.js:301:function setObserving(active) {
content.js:307:      attributeFilter: ['href'],
package.json:7:    "node": "^24.15.0"
package.json:10:    "test": "node --test tests/*.test.cjs",
package.json:18:    "eslint": "^10.10.0",
package.json:20:    "jsdom": "^30.0.1",
````

## V001 — Record unchanged audit-phase baseline before newly authorized remediation

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001; explicit overrides, if any, are in the command.

Status: **passed**; exit code: 0.

Completed within the stated inspection or synthetic execution scope.

````bash
python3 - <<'PY'
import pathlib,json,hashlib,subprocess
root=pathlib.Path('/home/adam/projects/xvid'); manifest=json.loads(pathlib.Path('/home/adam/projects/xvid/audit-output/2026-09-08-8569aa4-gdx8bvb7/baseline-manifest.json').read_text())
for location in [root,pathlib.Path('/tmp/xvid-audit-kyq46bbr')]:
 changed=[x['path'] for x in manifest if hashlib.sha256((location/x['path']).read_bytes()).hexdigest()!=x['sha256']]
 print(str(location),'tracked baseline mismatches:',changed)
 if changed:raise SystemExit(1)
print('Original tracked diff:')
p=subprocess.run(['git','diff','--exit-code','HEAD','--'],cwd=root,capture_output=True,text=True,timeout=10)
print('exit',p.returncode,'output',p.stdout)
print('status:',subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=normal'],cwd=root,text=True).strip())
PY
````

Output summary:

````text
/home/adam/projects/xvid tracked baseline mismatches: []
/tmp/xvid-audit-kyq46bbr tracked baseline mismatches: []
Original tracked diff:
exit 0 output
status: ?? audit-output/
````

## N001 — Build gate

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001.

Status: **not run**; exit code: not applicable.

Not applicable: no build script or build step in this extension.

````bash
npm run build
````

Output summary:

````text
No execution.
````

## N002 — Type-check gate

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001.

Status: **not run**; exit code: not applicable.

Not applicable: no typed-language/type-check configuration.

````bash
npm run typecheck
````

Output summary:

````text
No execution.
````

## N003 — Native browser/live endpoint end-to-end checks

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001.

Status: **not run**; exit code: not applicable.

Live application endpoints excluded; native fixture attempts D010/D012 timed out.

````bash
No live application command authorized or executed.
````

Output summary:

````text
No real downloads, profiles, credentials or endpoint calls.
````

## N004 — Coverage measurement

Working directory: `/tmp/xvid-audit-kyq46bbr`. Environment: ENV-001.

Status: **not run**; exit code: not applicable.

No baseline coverage setup; targeted behavior scenarios used without a percentage claim.

````bash
No coverage command configured or executed.
````

Output summary:

````text
No line/branch coverage measurement.
````

## N005 — Repository remote/session mutations

Working directory: `/home/adam/projects/xvid`. Environment: ENV-001.

Status: **not run**; exit code: not applicable.

Explicit audit no-remote boundary remains in force after local fix authorization; no commit, sync, push or cleanup performed.

````bash
git pull --rebase
bd dolt push
git push
````

Output summary:

````text
No execution.
````
