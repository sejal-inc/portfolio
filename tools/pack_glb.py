"""Pack a Poly Haven glTF (gltf + bin + jpg textures) into one small .glb.

- Colour textures are resized to --diff, normal and roughness maps to --maps,
  and re-encoded as JPEG.
- Geometry is quantized (KHR_mesh_quantization): int16 positions, int8 normals,
  uint16 indices. Vertex colours and spare UV sets are dropped.
Usage: python3 pack_glb.py in.gltf out.glb [--diff 512] [--maps 256]
"""
import io, json, os, struct, sys
import numpy as np
from PIL import Image

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read(g, bins, ai):
    a = g['accessors'][ai]; v = g['bufferViews'][a['bufferView']]
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
    stride = v.get('byteStride', n * dt.itemsize)
    buf = bins[v.get('buffer', 0)]
    start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    raw = np.frombuffer(buf, np.uint8, count=stride * (a['count'] - 1) + n * dt.itemsize, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, (a['count'], n * dt.itemsize), (stride, 1))
    return np.ascontiguousarray(rows).view(dt).reshape(a['count'], n)


def main(src, dst, diff=512, maps=256):
    base = os.path.dirname(src)
    g = json.load(open(src))
    bins = [open(os.path.join(base, b['uri']), 'rb').read() for b in g['buffers']]
    out = bytearray(); views = []; accs = []

    def add(data, target=None, stride=None):
        while len(out) % 4: out.append(0)
        v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
        if target: v['target'] = target
        if stride: v['byteStride'] = stride
        out.extend(data); views.append(v); return len(views) - 1

    def acc(arr, ctype, typ, normalized=False, target=34962, stride=None, mm=False):
        a = {'bufferView': add(arr.tobytes(), target, stride), 'componentType': ctype, 'count': len(arr), 'type': typ}
        if normalized: a['normalized'] = True
        if mm:
            k = NC[typ]; d = arr[:, :k].astype(np.float64)   # raw stored values, as the spec asks
            a['min'] = d.min(0).tolist(); a['max'] = d.max(0).tolist()
        accs.append(a); return len(accs) - 1

    quant = {}
    for mi, m in enumerate(g['meshes']):
        P = [read(g, bins, p['attributes']['POSITION']).astype(np.float64) for p in m['primitives']]
        allp = np.concatenate(P); lo, hi = allp.min(0), allp.max(0)
        c = (lo + hi) / 2; h = np.maximum((hi - lo) / 2, 1e-6)
        quant[mi] = (c, h)
        for p, pos in zip(m['primitives'], P):
            at = p['attributes']; new = {}
            q = np.zeros((len(pos), 4), np.int16)
            q[:, :3] = np.round((pos - c) / h * 32767).clip(-32767, 32767)
            new['POSITION'] = acc(q, 5122, 'VEC3', True, stride=8, mm=True)
            if 'NORMAL' in at:
                N = read(g, bins, at['NORMAL']).astype(np.float64)
                N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
                n4 = np.zeros((len(N), 4), np.int8); n4[:, :3] = np.round(N * 127)
                new['NORMAL'] = acc(n4, 5120, 'VEC3', True, stride=4)
            if 'TEXCOORD_0' in at:
                T = read(g, bins, at['TEXCOORD_0']).astype(np.float64)
                if T.min() >= 0 and T.max() <= 1:   # fits: 16-bit normalized UVs
                    new['TEXCOORD_0'] = acc(np.round(T * 65535).astype(np.uint16), 5123, 'VEC2', True)
                else:
                    new['TEXCOORD_0'] = acc(T.astype(np.float32), 5126, 'VEC2')
            p['attributes'] = new
            if 'indices' in p:
                I = read(g, bins, p['indices']).ravel()
                p['indices'] = acc(I.astype(np.uint16 if I.max() < 65535 else np.uint32), 5123 if I.max() < 65535 else 5125, 'SCALAR', target=34963)
            p.pop('targets', None)

    # each mesh moves to a child node whose transform undoes the quantization
    for node in list(g['nodes']):
        if 'mesh' in node:
            mi = node.pop('mesh'); c, h = quant[mi]
            g['nodes'].append({'mesh': mi, 'translation': c.tolist(), 'scale': h.tolist()})
            node.setdefault('children', []).append(len(g['nodes']) - 1)

    colour = set()
    for mat in g.get('materials', []):
        for t in (mat.get('pbrMetallicRoughness', {}).get('baseColorTexture'), mat.get('emissiveTexture')):
            if t: colour.add(g['textures'][t['index']]['source'])
    cache = {}
    for i, im in enumerate(g.get('images', [])):
        uri = im.pop('uri'); size = diff if i in colour else maps
        if (uri, size) not in cache:
            img = Image.open(os.path.join(base, uri)).convert('RGB')
            if img.width > size: img = img.resize((size, size), Image.LANCZOS)
            b = io.BytesIO(); img.save(b, 'JPEG', quality=82, optimize=True)
            cache[(uri, size)] = add(b.getvalue())
        im['bufferView'] = cache[(uri, size)]; im['mimeType'] = 'image/jpeg'

    while len(out) % 4: out.append(0)
    g['buffers'] = [{'byteLength': len(out)}]; g['bufferViews'] = views; g['accessors'] = accs
    for k in ('extensionsUsed', 'extensionsRequired'):
        g[k] = sorted(set(g.get(k, [])) | {'KHR_mesh_quantization'})
    js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
    total = 28 + len(js) + len(out)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
    return total


if __name__ == '__main__':
    a = sys.argv[1:]; opt = {}
    for k in ('diff', 'maps'):
        if '--' + k in a: i = a.index('--' + k); opt[k] = int(a[i + 1]); del a[i:i + 2]
    print(os.path.basename(a[1]), '%.0f KB' % (main(a[0], a[1], **opt) / 1024))
