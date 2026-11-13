"""Descarga texturas públicas CC0 de Poly Haven; se sirven localmente en el juego."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request

root=Path(__file__).resolve().parents[1]/'public/textures'
root.mkdir(parents=True,exist_ok=True)
def download(task):
    asset,channel=task
    filename=f'{asset}_{channel}_2k.jpg'
    url=f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{asset}/{filename}'
    req=urllib.request.Request(url,headers={'User-Agent':'RoadRush3D local asset downloader'})
    with urllib.request.urlopen(req,timeout=90) as response:
        data=response.read()
    (root/filename).write_bytes(data)
    return f'{filename}: {len(data)} bytes'

if __name__=='__main__':
    tasks=[(asset,ch) for asset in ['asphalt_02','rock_boulder_dry','rock_ground'] for ch in ['diff','nor_gl','rough']]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(download,tasks):print(result,flush=True)
