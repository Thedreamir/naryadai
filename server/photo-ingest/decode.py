"""Isolated bounded decoder process: input stdin, canonical JPEG stdout."""
import sys
from canonical import canonical_image, MAX_INPUT
try:
    raw=sys.stdin.buffer.read(MAX_INPUT+1)
    sys.stdout.buffer.write(canonical_image(raw)['bytes'])
except Exception:
    sys.stderr.write('image decode rejected')
    sys.exit(1)
