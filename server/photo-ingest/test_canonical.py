import unittest,hashlib
from io import BytesIO
from PIL import Image
from canonical import canonical_image
class TestCanonical(unittest.TestCase):
 def test_invalid(self):
  for b in [b'not an image',b'\xff\xd8garbage',b'\x89PNG\r\n\x1a\ninvalid',b'',b'x'*(12*1024*1024+1)]:
   with self.assertRaises(ValueError):canonical_image(b)
 def test_real_image_and_exif_removed(self):
  image=Image.new('RGB',(1600,1200),(50,50,55));exif=Image.Exif();exif[270]='private synthetic metadata';out=BytesIO();image.save(out,'JPEG',exif=exif)
  r=canonical_image(out.getvalue());self.assertLessEqual(r['byte_size'],290000);self.assertEqual(r['sha256'],hashlib.sha256(r['bytes']).hexdigest());decoded=Image.open(BytesIO(r['bytes']));decoded.load();self.assertEqual(len(decoded.getexif()),0);self.assertEqual(decoded.format,'JPEG')
if __name__=='__main__':unittest.main()
