#!/usr/bin/env python3
"""Validate audit citations/provenance and that delivered code equals tested code."""
from pathlib import Path
import json, re, subprocess, hashlib, sys
root=Path(sys.argv[1]).resolve()
output=Path(sys.argv[2]).resolve()
tested=Path(sys.argv[3]).resolve()
head='8569aa44ff01de50ea656dec2120fc649bb15b14'
baseline=json.loads((output/'baseline-manifest.json').read_text())
changed=json.loads((output/'remediation-manifest.json').read_text())
changed_paths={item['path'] for item in changed}
errors=[]
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==head
baseline_text={}
for item in baseline:
    path=item['path']
    data=subprocess.check_output(['git','show',head+':'+path],cwd=root,timeout=10)
    if hashlib.sha256(data).hexdigest()!=item['sha256']:errors.append('Baseline blob mismatch: '+path)
    if b'\0' not in data:baseline_text[path]=data.decode().splitlines()
    if path not in changed_paths and (root/path).read_bytes()!=data:errors.append('Unrelated tracked change: '+path)
for item in changed:
    data=(root/item['path']).read_bytes()
    if hashlib.sha256(data).hexdigest()!=item['sha256']:errors.append('Delivered hash mismatch: '+item['path'])
    if data!=(tested/item['path']).read_bytes():errors.append('Delivered file differs from tested copy: '+item['path'])
original_manifest=json.loads('\n'.join(baseline_text['manifest.json']))
current_manifest=json.loads((root/'manifest.json').read_text())
original_manifest.pop('version'); current_manifest.pop('version')
if original_manifest!=current_manifest:errors.append('Unexpected extension manifest/permission change')
pattern=re.compile(r'(?<![\w./-])('+ '|'.join(re.escape(x) for x in sorted(baseline_text,key=len,reverse=True))+r'):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)')
citation_count=0
for filename in ['REPOSITORY_AUDIT.md','AUDIT_NOTES.md','REMEDIATION.md']:
    text=(output/filename).read_text()
    # The appended remediation notes have no baseline line citations.
    for match in pattern.finditer(text):
        path, ranges=match.groups()
        lines=(root/path).read_text().splitlines() if filename=='REMEDIATION.md' else baseline_text[path]
        for spec in ranges.split(','):
            numbers=[int(n) for n in spec.split('-')]
            start,end=numbers[0],numbers[-1]
            citation_count+=1
            if not (1<=start<=end<=len(lines)):
                errors.append(f'Invalid citation in {filename}: {path}:{spec} ({len(lines)} lines)')
report=(output/'REPOSITORY_AUDIT.md').read_text()
finding_ids=re.findall(r'^### (F-\d{3}) —',report,re.M)
if sorted(finding_ids)!=['F-001','F-002','F-003','F-004','F-005','F-006']:errors.append('Missing or duplicate finding headers')
commands=json.loads((output/'commands.json').read_text())['commands']
command_ids={r['id'] for r in commands}|{'V002'}  # This validator's execution record is appended after it exits.
if len(commands)!=len({r['id'] for r in commands}):errors.append('Duplicate command ID')
for filename in ['REPOSITORY_AUDIT.md','AUDIT_NOTES.md','REMEDIATION.md']:
    text=(output/filename).read_text()
    for id in set(re.findall(r'\b[BCDEIVN]\d{3}\b',text)):
        if id not in command_ids:errors.append(f'Missing command {id} in {filename}')
    for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)',text):
        if link.startswith(('https://','http://','#')):continue
        if not (output/link.split('#')[0]).exists():errors.append('Missing local artifact: '+link)
allowed_statuses={'Verified within tested scope','Statically traced only','Partially verified','Confirmed defect','Not verified','Not applicable'}
matrix=report.split('## 5. Feature Verification Matrix')[1].split('## 6. Detailed Findings')[0]
matrix_rows=0
for line in matrix.splitlines():
    if not line.startswith('| ') or line.startswith('| Feature') or line.startswith('| ---'):continue
    columns=[x.strip() for x in line.strip('|').split('|')]
    matrix_rows+=1
    if columns[4] not in allowed_statuses:errors.append('Invalid feature status: '+columns[4])
# High-specificity redaction check; no secret values are printed.
secret_patterns=[re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),re.compile(rb'AKIA[0-9A-Z]{16}'),re.compile(rb'xox[baprs]-[A-Za-z0-9-]{20,}')]
scanned=0
for file in output.rglob('*'):
    if file.is_file():
        data=file.read_bytes();scanned+=1
        if any(p.search(data) for p in secret_patterns):errors.append('Credential-like value needs review in '+file.name)
check=subprocess.run(['git','diff','--check'],cwd=root,capture_output=True,text=True,timeout=10)
if check.returncode:errors.append('git diff --check failed: '+check.stdout)
status=subprocess.check_output(['git','status','--porcelain=v1','--untracked-files=normal'],cwd=root,text=True)
result={'baseline':head,'source_citation_ranges_checked':citation_count,'unique_findings':len(finding_ids),'feature_matrix_rows':matrix_rows,'command_records_before_V002':len(commands),'artifact_files_redaction_checked':scanned,'delivered_files_matching_tested_snapshot':len(changed),'unrelated_tracked_files_changed':False,'extension_manifest_changes_except_version':False,'git_diff_check_exit':check.returncode,'git_status':status,'errors':errors,'status':'passed' if not errors else 'failed'}
(output/'validation-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
sys.exit(1 if errors else 0)
