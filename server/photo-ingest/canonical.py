"""Local canonical ingest core. No network/storage calls or capture-time claims."""
from io import BytesIO
import hashlib
from PIL import Image, ImageOps, UnidentifiedImageError
MAX_INPUT=12*1024*1024
MAX_OUTPUT=290000
Image.MAX_IMAGE_PIXELS=24000000

def canonical_image(raw:bytes):
    if not raw or len(raw)>MAX_INPUT: raise ValueError('invalid input size')
    try:
        with Image.open(BytesIO(raw)) as probe:
            if probe.format not in ('JPEG','PNG','WEBP'): raise ValueError('unsupported image')
            probe.verify()
        with Image.open(BytesIO(raw)) as image:
            if image.width*image.height>24000000: raise ValueError('too many pixels')
            image=ImageOps.exif_transpose(image).convert('RGB')
            for size,quality in [(1600,72),(1600,60),(1280,60),(1280,50),(1024,50),(1024,42)]:
                candidate=image.copy();candidate.thumbnail((size,size));out=BytesIO()
                candidate.save(out,format='JPEG',quality=quality,optimize=True)
                body=out.getvalue()
                if len(body)<=MAX_OUTPUT:
                    with Image.open(BytesIO(body)) as decoded: decoded.load()
                    return {'bytes':body,'sha256':hashlib.sha256(body).hexdigest(),'byte_size':len(body),'mime_type':'image/jpeg','width':candidate.width,'height':candidate.height,'limits':'Decoded/re-encoded image bytes; not proof of capture time, repair or storage ownership'}
    except (UnidentifiedImageError,OSError,Image.DecompressionBombError) as e: raise ValueError('image decode failed') from e
    raise ValueError('output too large')
