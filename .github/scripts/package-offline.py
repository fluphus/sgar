"""Build only the offline runtime, verifying all original file hashes."""
import hashlib
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parents[2]
entries = json.loads((root / '.github/offline/manifest.json').read_text(encoding='utf-8'))
archive = root / 'sgar-offline.zip'
assert not archive.exists(), 'Refuse to replace an unverified existing local ZIP.'
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for entry in entries:
        source = root / entry['source']
        data = source.read_bytes()
        assert len(data) == entry['bytes'], entry['file']
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['file']
        # Fixed timestamps keep releases reproducible across machines.
        info = zipfile.ZipInfo('sgar-offline/' + entry['file'], (2026, 10, 30, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.infolist()) == len(entries)
    for entry in entries:
        assert hashlib.sha256(z.read('sgar-offline/' + entry['file'])).hexdigest() == entry['sha256']
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
notes = (root / '.github/offline/release-notes.md').read_text(encoding='utf-8')
(root / 'release-notes.md').write_text(notes.rstrip() + '\n\nSHA-256 (sgar-offline.zip):\n\n' + digest + '\n', encoding='utf-8')
print(json.dumps({'files':len(entries), 'bytes':archive.stat().st_size, 'sha256':digest, 'verified':True}), flush=True)
