/* KCBM — ajustes SÓ deste site (o JJR Controle não carrega este arquivo com este conteúdo).
   1) sempre no modo escuro; 2) nunca semeia dados do JJR (empresas, checklists, grupos, usuários); 3) esconde módulos; 4) marca KCBM. */
(function () {
  // ── 1) modo escuro fixo ──
  try { localStorage.setItem('jjrDarkMode', '1'); } catch (e) {}
  document.documentElement.classList.add('dark-mode');
  window.aplicarDarkMode = function () { document.documentElement.classList.add('dark-mode'); };
  window.toggleDarkMode = function () { document.documentElement.classList.add('dark-mode'); };

  // ── 2) NADA do JJR entra aqui: o cadastro de empresas começa VAZIO ──
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

  // ── 3) módulos escondidos no KCBM (só visual: nenhum dado é apagado). Para esconder outro, acrescente o id do menu aqui. ──
  var ESCONDER = ['n-nbc']; // Normas Brasileiras de Contabilidade
  function esconder() { ESCONDER.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }); var b = document.getElementById('darkModeBtn'); if (b) b.style.display = 'none'; }

  // ── 4) marca KCBM ──
  function marca() {
    var l = document.querySelector('.logo'); if (l && !/KCBM/.test(l.textContent)) l.innerHTML = 'KCBM<em>/ CONTROLE CONTÁBIL</em>';
    var ls = document.getElementById('loginScreen');
    if (ls) { var t = [].slice.call(ls.querySelectorAll('div')).find(function (d) { return d.children.length === 0 && /^\s*JJR\s*$/.test(d.textContent); }); if (t) { t.textContent = 'KCBM'; t.style.color = '#D4AF37'; } }
  }

  function aplicar() { esconder(); marca(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar); else aplicar();
  setInterval(aplicar, 1500); // o menu é redesenhado em alguns momentos; reaplica
})();
