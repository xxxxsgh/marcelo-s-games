# Transformacao unica aplicada as fontes: chamadas quentes deixam de passar doubles como argumentos
# (o V8 encaixota doubles em HeapNumber em chamadas nao embutidas) e passam a usar registradores pre-alocados.
import re, sys
def split_args(s, i):
    # s[i] == '(' ; devolve (lista de args, indice apos ')')
    depth = 0; args = []; cur = ''; j = i
    while j < len(s):
        ch = s[j]
        if ch in '([{': depth += 1; cur += ch if depth > 1 else ''
        elif ch in ')]}':
            depth -= 1
            if depth == 0:
                if cur.strip() or args: args.append(cur.strip())
                return args, j + 1
            cur += ch
        elif ch == ',' and depth == 1: args.append(cur.strip()); cur = ''
        elif ch in '\'"`':
            k = j + 1
            while s[k] != ch: k += 2 if s[k] == '\\' else 1
            cur += s[j:k + 1]; j = k
        else: cur += ch
        j += 1
    raise ValueError('parenteses')
def transform(s, pattern, fn, skipdef=True):
    out = ''; pos = 0; rx = re.compile(pattern)
    while True:
        m = rx.search(s, pos)
        if not m: out += s[pos:]; break
        args, end = split_args(s, m.end() - 1)
        rep = fn(m, args)
        if rep is None: out += s[pos:m.end()]; pos = m.end(); continue
        out += s[pos:m.start()] + rep; pos = end
    return out
def fix(s, name):
    # repete ate estabilizar (argumentos aninhados)
    for _ in range(6):
        t = s
        t = transform(t, r'(?<![\w.])hyp\(', lambda m, a: 'Math.sqrt(' + ' + '.join(f'({x}) * ({x})' for x in a) + ')')
        t = transform(t, r'(?<![\w.])clamp\(', lambda m, a: f'Math.min(Math.max({a[0]}, {a[1]}), {a[2]})')
        t = transform(t, r'(?<![\w.])lerp\(', lambda m, a: f'(({a[0]}) + (({a[1]}) - ({a[0]})) * ({a[2]}))')
        if t == s: break
        s = t
    def reg(pat, newname, arr, base, idx, tail=''):
        nonlocal s
        def f(m, a):
            sets = ', '.join(f'{arr}[{base + k}] = {a[i]}' for k, i in enumerate(idx) if i < len(a))
            rest = ', '.join(x for i, x in enumerate(a) if i not in idx)
            return f'({sets}, {m.group(1)}.{newname}({rest}){tail})'
        for _ in range(4):
            t = transform(s, pat, f)
            if t == s: break
            s = t
    R = r'((?:this|S|SIM|BG))\.'
    reg(R + r'env\(', 'envR', '_c', 32, [0, 1, 2, 3], ', _c[0]')
    reg(R + r'force\(', 'forceR', '_c', 36, [1, 2, 3, 4, 5, 6])
    reg(R + r'impulse\(', 'impulseR', '_c', 36, [1, 2, 3, 4, 5, 6])
    reg(R + r'toLocal\(', 'toLocalR', '_c', 42, [1, 2, 3])
    reg(R + r'closest\(', 'closestR', '_c', 42, [1, 2, 3], ', _c[14]')
    reg(R + r'wpt\(', 'wptR', '_c', 45, [1, 2, 3])
    reg(R + r'emit\(', 'emitR', '_c', 48, [1, 2, 3, 4, 5, 6, 7])
    reg(R + r'damage\(', 'damageR', '_c', 55, [1, 2, 3, 4])
    reg(R + r'hurt\(', 'hurtR', '_c', 59, [2])
    reg(R + r'addDent\(', 'addDentR', '_c', 60, [2, 3, 4, 5])
    reg(r'(FX)\.sparks\(', 'sparksR', '_f', 0, list(range(9)))
    reg(r'(FX)\.smoke\(', 'smokeR', '_f', 0, [0, 1, 2, 3, 4, 6])
    reg(r'(FX)\.fire\(', 'fireR', '_f', 0, list(range(6)))
    reg(r'(FX)\.light\(', 'lightR', '_f', 0, list(range(8)))
    reg(r'(FX)\.flight\(', 'flightR', '_f', 0, list(range(7)))
    reg(r'(FX)\.mark\(', 'markR', '_f', 0, list(range(7)))
    reg(r'(DRAW|this)\.put\(', 'putR', '_d', 0, list(range(3, 12)))
    reg(r'(M4)\.mulTR\(', 'mulTRr', '_t', 0, [4, 5, 6, 8])
    reg(r'(M4)\.fromQT\(', 'fromQTr', '_q', 0, list(range(2, 9)))
    reg(r'(DRAW)\.bot\(', 'botR', '_q', 0, list(range(2, 9)))
    reg(r'(this)\.setCam\(', 'setCamR', '_k', 0, list(range(8)))
    reg(r'(IN)\.rumble\(', 'rumbleR', '_k', 8, [0, 1, 2])
    # gerador aleatorio: resultado via registrador
    if name in ('60_sim.js', '70_fx.js', '80_game.js'):
        s = transform(s, r'((?:this\.rng|FX\.rng|B\.arng|\br))\.r\(', lambda m, a: f'({m.group(1)}.uR(), ({a[0]}) + (({a[1]}) - ({a[0]})) * _u[0])')
        s = re.sub(r'((?:this\.rng|FX\.rng|B\.arng|\br))\.s1\(\)', r'(\1.uR(), _u[0] * 2 - 1)', s)
        s = re.sub(r'((?:this\.rng|FX\.rng|B\.arng|\br))\.u\(\)', r'(\1.uR(), _u[0])', s)
    return s
if __name__ == '__main__':
    for f in sys.argv[1:]:
        src = open(f).read(); out = fix(src, f.split('/')[-1]); open(f, 'w').write(out); print(f, len(src), '->', len(out))
