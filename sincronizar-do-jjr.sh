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
s=s.replace('JJR Consultoria Contábil S/S','Kleydson')  # login e cabeçalhos de relatórios
s=s.replace('<meta name="theme-color" content="#0F7B6C">','<meta name="theme-color" content="#2563EB">')
# paleta: verde do JJR -> azul; azul do JJR -> lilás (cores escritas direto no código; as demais vêm das variáveis do tema.css)
for a,b in [('#0F7B6C','#2563EB'),('#0F9C8C','#2563EB'),('#14A899','#3B82F6'),('#14B8A6','#3B82F6'),('#14b8a6','#3B82F6'),('#2DD4BF','#60A5FA'),('#E6F4F2','#E3EBFD'),
            ('rgba(15,123,108','rgba(37,99,235'),('rgba(20,184,166','rgba(59,130,246'),('#1D4ED8','#7C5CC9'),('#DBEAFE','#EDE7FB')]:
    s=s.replace(a,b)
s=re.sub(r'<link rel="icon"[^>]*>','<link rel="icon" type="image/png" href="assets/icon-192.png">',s,count=1)  # ícone da aba: preto com calculadora dourada
# ISOLAMENTO DE MEMÓRIA LOCAL: JJR e KCBM ficam no mesmo endereço-base (kleydsoncontador-svg.github.io), então o navegador
# daria a MESMA localStorage/IndexedDB aos dois. Este script (o PRIMEIRO do <head>) prefixa tudo com "kcbm::" só no KCBM.
ISOL = """<script>/*kcbm-isolamento*/(function(){try{var P='kcbm::',real=window.localStorage;
function mine(){var r=[];for(var i=0;i<real.length;i++){var k=real.key(i);if(k&&k.indexOf(P)===0)r.push(k);}return r;}
var px=new Proxy(real,{
 get:function(t,k){
  if(k==='getItem')return function(x){return real.getItem(P+x);};
  if(k==='setItem')return function(x,v){real.setItem(P+x,v);};
  if(k==='removeItem')return function(x){real.removeItem(P+x);};
  if(k==='key')return function(i){var a=mine();return i<a.length?a[i].slice(P.length):null;};
  if(k==='length')return mine().length;
  if(k==='clear')return function(){mine().forEach(function(x){real.removeItem(x);});};
  return typeof k==='string'?(real.getItem(P+k)===null?undefined:real.getItem(P+k)):undefined;},
 set:function(t,k,v){real.setItem(P+k,v);return true;},
 deleteProperty:function(t,k){real.removeItem(P+k);return true;},
 has:function(t,k){return real.getItem(P+k)!==null;},
 ownKeys:function(){return mine().map(function(x){return x.slice(P.length);});},
 getOwnPropertyDescriptor:function(t,k){var v=real.getItem(P+k);return v===null?undefined:{value:v,enumerable:true,configurable:true,writable:true};}
});
Object.defineProperty(window,'localStorage',{value:px,configurable:true});
var io=window.indexedDB&&window.indexedDB.open;if(io){window.indexedDB.open=function(n,v){return v===undefined?io.call(window.indexedDB,P+n):io.call(window.indexedDB,P+n,v);};}
}catch(e){console.warn('KCBM isolamento:',e);}})();</script>
"""
if 'kcbm-isolamento' not in s:
    s=s.replace('<head>','<head>\n'+ISOL,1)
if 'tema.css' not in s:
    s=s.replace('</head>','<link rel="stylesheet" href="tema.css?v=__BUILD_ID__">\n</head>',1)
    i=s.rfind('</body>')  # o ÚLTIMO: dentro de textos de script também aparece '</body>'
    s=s[:i]+'<script src="tema.js?v=__BUILD_ID__"></script>\n'+s[i:]
# a lista inicial de clientes/checklists do JJR NUNCA vai para o KCBM (nem no código): ficam vazias
s=re.sub(r'^const EMP_SEED\s*=\s*\[.*?\];\s*$','const EMP_SEED = [];',s,flags=re.M)
s=re.sub(r'^const CH_SEED\s*=\s*\{.*?\};\s*$','const CH_SEED = {};',s,flags=re.M)
s=re.sub(r'^const LST_SEED\s*=\s*\[.*?\];\s*$','const LST_SEED = [];',s,flags=re.M)
open(p,'w',encoding='utf-8').write(s)
PY
echo "KCBM sincronizado a partir de $ORIG"
