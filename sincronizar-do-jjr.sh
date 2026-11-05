#!/bin/bash
# Copia o código do JJR Controle (C:/jjr-controle) para o site KCBM, SEM dados, SEM arquivos de clientes e SEM
# as rotinas de backup do JJR. Os arquivos próprios do KCBM (supabase-config.js, tema.css, tema.js, manifest, ícones) NUNCA são sobrescritos.
set -e
ORIG="${1:-/c/jjr-controle}"; DEST="$(cd "$(dirname "$0")" && pwd)"
ARQ="index.html analises.js calc-motor.js calc-ui.js contabil-import.js contabil-parsers.js extrato-generico.js fopag-lote.js itau-extrato-parsers.js pride-fluxo-parser.js razao-parser.js busca-empresa.js composicao.html valor-residual.html refresh.html nbc-conteudo-1.js nbc-conteudo-2.js nbc-conteudo-3.js nbc-conteudo-4.js nbc-conteudo-5.js nbc-conteudo-6.js nbc-conteudo-7.js nbc-conteudo-8.js nbc-conteudo-9.js nbc-mapas.js nbc-mapas-2.js nbc-mapas-3.js nbc-mapas-4.js nbc-mapas-5.js nbc-ui.js"
for f in $ARQ; do [ -f "$ORIG/$f" ] && cp "$ORIG/$f" "$DEST/$f"; done
cd "$DEST"
# identidade do KCBM no index.html + ganchos do tema
python - <<'PY'
import re
p='index.html'; s=open(p,encoding='utf-8').read()
s=s.replace('<title>JJR Controle Contábil</title>','<title>KCBM</title>')
s=s.replace('https://kleydsoncontador-svg.github.io/jjr-controle/assets/logo-jjr.png','https://kleydsoncontador-svg.github.io/kcbm/assets/logo-kcbm.png')
if 'tema.css' not in s:
    s=s.replace('</head>','<link rel="stylesheet" href="tema.css">\n</head>',1)
    i=s.rfind('</body>')  # o ÚLTIMO: dentro de textos de script também aparece '</body>'
    s=s[:i]+'<script src="tema.js"></script>\n'+s[i:]
# a lista inicial de clientes/checklists do JJR NUNCA vai para o KCBM (nem no código): ficam vazias
s=re.sub(r'^const EMP_SEED\s*=\s*\[.*?\];\s*$','const EMP_SEED = [];',s,flags=re.M)
s=re.sub(r'^const CH_SEED\s*=\s*\{.*?\};\s*$','const CH_SEED = {};',s,flags=re.M)
s=re.sub(r'^const LST_SEED\s*=\s*\[.*?\];\s*$','const LST_SEED = [];',s,flags=re.M)
open(p,'w',encoding='utf-8').write(s)
PY
echo "KCBM sincronizado a partir de $ORIG"
