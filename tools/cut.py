from rembg import remove, new_session
from PIL import Image
im=Image.open('tools/src.jpg').convert('RGB')
s=new_session('isnet-anime')
out=remove(im,session=s,alpha_matting=False)
out.save('tools/cut_raw.png')
