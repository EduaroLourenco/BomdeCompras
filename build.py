#!/usr/bin/env python3
"""
Gera o index.html do Bom de Compras Marketplace OS.

O sistema é um único arquivo HTML autocontido (sem CDN, sem build de JS),
montado a partir das partes em src/ mais os dados em data/full_data.json.

    python3 build.py

Edite sempre os arquivos de src/ — nunca o index.html gerado.
"""
import json
import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'src')
OUT = os.path.join(BASE, 'index.html')

PARTS_JS = ['03_core.js', '04_charts.js', '05_views_a.js',
            '06_views_b.js', '07_deck_init.js', '08_shell.js']


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def main():
    with open(os.path.join(BASE, 'data', 'full_data.json'), encoding='utf-8') as f:
        data = json.load(f)
    data_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))

    js = '\n'.join(read(p) for p in PARTS_JS)
    if '__DATA_JSON__' not in js:
        raise SystemExit('erro: o marcador __DATA_JSON__ sumiu de src/03_core.js')
    js = js.replace('__DATA_JSON__', data_json)

    # nada no JS pode fechar a tag <script> por acidente
    if '</script' in js.lower():
        raise SystemExit('erro: uma string do JS contém </script')

    html = (
        '<!doctype html>\n<html lang="pt-BR">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="robots" content="noindex, nofollow">\n'
        + read('01_head.html')
        + '\n</head>\n<body>\n'
        + read('02_body.html')
        + '\n<script>\n' + js + '\n</script>\n</body>\n</html>\n'
    )

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)

    # conferência: todo token de cor precisa existir no :root base,
    # senão a página quebra em um dos temas
    css = read('01_head.html')
    root = css.split(':root {', 1)[1].split('}', 1)[0]
    declared = set(re.findall(r'(--[a-z0-9-]+):', root))
    used = set(re.findall(r'var\((--[a-z0-9-]+)\)', css))
    missing = sorted(t for t in used if t not in declared)

    print(f'gerado: {OUT} ({len(html):,} bytes)')
    print('tokens sem definição no :root base:', missing or 'nenhum')
    if missing:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
