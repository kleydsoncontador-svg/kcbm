/* KCBM — ajustes SÓ deste site.
   1) nunca semeia dados do JJR (empresas, checklists, grupos, usuários); 2) esconde módulos; 3) marca KCBM. */
(function () {
  // uma única vez: volta ao modo CLARO (antes o KCBM ficou forçado no escuro); depois o botão do topo manda
  try { if (localStorage.getItem('kcbm_tema_resetado') !== '1') { localStorage.setItem('jjrDarkMode', '0'); localStorage.setItem('kcbm_tema_resetado', '1'); } } catch (e) {}
  // ── 1) NADA do JJR entra aqui: o cadastro de empresas começa VAZIO ──
  // O JJR Controle traz uma lista inicial de clientes (EMP_SEED), checklists e grupos. No KCBM isso nunca é gravado.
  window.seedData = function () {
    try {
      if (typeof S !== 'undefined') {
        if (!S.meses().length && typeof MESES_SEED !== 'undefined') S.saveMeses(MESES_SEED);
        if (!S.fechAtual()) { var d = new Date(); S.saveFechAtual(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
      }
    } catch (e) { console.warn('KCBM seedData:', e); }
  };
  window._gruposEconPadrao = function () { return []; };

  // ── 2) módulos escondidos no KCBM (só visual: nenhum dado é apagado). Para esconder outro, acrescente o id do menu aqui. ──
  var ESCONDER = ['n-nbc']; // Normas Brasileiras de Contabilidade
  function esconder() {
    ESCONDER.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    // o mesmo módulo também aparece como cartão na tela inicial: esconde o cartão que abre a página dele
    ESCONDER.forEach(function (id) { var pg = id.replace(/^n-/, ''); [].slice.call(document.querySelectorAll('#homeCardsGrid > div')).forEach(function (c) { var oc = c.getAttribute('onclick') || ''; if (oc.indexOf("'" + pg + "'") >= 0) c.style.display = 'none'; }); });
  }

  // ── 3) marca KCBM ──
  function marca() {
    var l = document.querySelector('.logo'); if (l && !/KCBM/.test(l.textContent)) l.innerHTML = 'KCBM<em>/ CONTROLE CONTÁBIL</em>';
    var ls = document.getElementById('loginScreen');
    if (ls) { var t = [].slice.call(ls.querySelectorAll('div')).find(function (d) { return d.children.length === 0 && /^\s*JJR\s*$/.test(d.textContent); }); if (t) t.textContent = 'KCBM'; }
  }

  function aplicar() { esconder(); marca(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar); else aplicar();
  setInterval(aplicar, 1500); // o menu é redesenhado em alguns momentos; reaplica
})();
