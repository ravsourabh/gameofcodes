"""Make small portraits of the actual source models for the studio chooser."""
from pathlib import Path
from PIL import Image
root=Path('.sovereign/asset-build/rocketbox')
for source in root.glob('*.png'):
    im=Image.open(source).convert('RGBA')
    bounds=im.getbbox()
    if bounds: im=im.crop(bounds)
    width,height=im.size
    # Source reference images are full-body T-poses; show head and shoulders.
    crop_height=int(height*.4); crop_width=min(width,int(crop_height*.8))
    left=(width-crop_width)//2
    im=im.crop((left,0,left+crop_width,crop_height));im.thumbnail((128,160))
    im.save(Path('public/avatars/rocketbox')/(source.stem+'.webp'),'WEBP',quality=84)
