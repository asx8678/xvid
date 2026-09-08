#!/usr/bin/env python3
"""Audit-only tooling bootstrap: public npm metadata, isolated install, no lifecycle."""
import pathlib, json, urllib.request, hashlib, base64, tarfile, io, sys, datetime
base = pathlib.Path(sys.argv[1]).resolve()
base.mkdir(exist_ok=True)
rows = []
for name in ['npm', 'eslint', '@eslint/js', 'globals', 'prettier']:
    url = 'https://registry.npmjs.org/' + urllib.parse.quote(name, safe='') + '/latest'
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.loads(r.read(3_000_000))
    row = {'package': name, 'version': data['version'], 'license': data.get('license'),
           'engines': data.get('engines'), 'source': url,
           'retrieved_utc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    rows.append(row)
    if name == 'npm':
        dist = data['dist']
        assert dist['tarball'].startswith('https://registry.npmjs.org/npm/')
        with urllib.request.urlopen(dist['tarball'], timeout=20) as r:
            archive = r.read(15_000_001)
        assert len(archive) <= 15_000_000
        algorithm, expected = dist['integrity'].split('-', 1)
        assert algorithm == 'sha512'
        assert base64.b64encode(hashlib.sha512(archive).digest()).decode() == expected
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
            assert sum(m.size for m in tar.getmembers()) < 80_000_000
            tar.extractall(base / 'npm-tool', filter='data')
        row['verified_tarball_integrity'] = True
(base / 'registry-metadata.json').write_text(json.dumps(rows, indent=2) + '\n')
print(json.dumps(rows, indent=2))
