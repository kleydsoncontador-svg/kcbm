/* KCBM — módulo PESSOA FÍSICA (só existe no KCBM; o JJR Controle não tem nem recebe este arquivo).
   Lista de pessoas físicas; ao abrir uma, as abas: Contas a pagar · Contas a receber · Extrato bancário · Entradas · Gastos · Cartões de crédito · Saldo a pagar/receber.
   Cadastros UNIVERSAIS (valem para todas as pessoas): Tipos de gasto/receita, Fornecedores e clientes, bandeiras de cartão.
   Dados guardados no banco do KCBM (S.g/S.s): kcbm_pf_lista, kcbm_pf_<id> (por pessoa), kcbm_pf_tipos, kcbm_pf_terceiros, kcbm_pf_bandeiras. Nada é apagado sem confirmar. */
(function (root) {
  'use strict';
  // ───────────── utilidades ─────────────
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = n => String(n).padStart(2, '0');
  const cents = v => Math.round((Number(v) || 0) * 100);
  const R$ = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = t => { let s = String(t == null ? '' : t).trim(); if (!s) return 0; const neg = /^-/.test(s); s = s.replace(/[^\d.,]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); const x = parseFloat(s); return isNaN(x) ? 0 : (neg ? -x : x); };
  const br = d => d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '';
  const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const rotMes = m => MESES[+m.slice(5, 7) - 1].replace(/^./, c => c.toUpperCase()) + ' de ' + m.slice(0, 4);
  const somaMes = (m, n) => { const y = +m.slice(0, 4), mm = +m.slice(5, 7) - 1 + n; const d = new Date(y, mm, 1); return d.getFullYear() + '-' + p2(d.getMonth() + 1); };
  const fimMes = m => { const y = +m.slice(0, 4), mm = +m.slice(5, 7); return m + '-' + p2(new Date(y, mm, 0).getDate()); };
  const diaNoMes = (m, dia) => { const ult = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); return m + '-' + p2(Math.min(dia, ult)); };
  const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dig = s => String(s || '').replace(/\D/g, '');
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function cpfValido(c) {
    c = dig(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +c[t]) return false; }
    return true;
  }
  const fmtCpf = c => { c = dig(c); return c.length === 11 ? c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9) : c; };
  const S_ = () => { if (typeof S === 'undefined') throw new Error('S indisponível'); return S; }; // S é const global do site (não fica em window.S)
  const lerChave = (k, padrao) => { try { const v = S_().g(k); return (v == null) ? padrao : v; } catch (e) { return padrao; } };
  const gravarChave = (k, v) => { try { S_().s(k, v); } catch (e) { console.warn('PF: não salvou', k, e); if (root.toast) root.toast('Não consegui salvar — tente de novo.', 'err'); } };
  const lerLista = () => { const v = lerChave('kcbm_pf_lista', []); return Array.isArray(v) ? v : []; };
  const gravarLista = l => gravarChave('kcbm_pf_lista', l);
  const lerTipos = () => { const v = lerChave('kcbm_pf_tipos', []); return Array.isArray(v) ? v : []; };
  const lerTerceiros = () => { const v = lerChave('kcbm_pf_terceiros', []); return Array.isArray(v) ? v : []; };
  const BANDEIRAS = ['Mastercard', 'Visa', 'Elo', 'American Express', 'Hipercard', 'Diners Club', 'Discover', 'Cabal', 'Sorocred', 'JCB', 'Aura'];
  const lerBandeirasProprias = () => { const v = lerChave('kcbm_pf_bandeiras', []); return Array.isArray(v) ? v : []; };
  const fechMes = () => { try { const f = S_().fechAtual(); if (/^\d{4}-\d{2}$/.test(f || '')) return f; } catch (e) {} return hoje().slice(0, 7); };
  const novoDados = () => ({ saldoIni: { mes: '', pagar: 0, receber: 0, definido: false }, cartoes: [], pagar: [], receber: [], entradas: [], gastos: [], extrato: [] });
  const lerDados = id => { const v = lerChave('kcbm_pf_' + id, null); return (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) ? Object.assign(novoDados(), v) : novoDados(); };
  const gravarDados = (id, d) => gravarChave('kcbm_pf_' + id, d);
  // mês em que o saldo começa: o definido nos "Saldos iniciais" ou, se não definiu, o Fechamento Atual do site
  const mesInicio = d => (d.saldoIni && d.saldoIni.definido && /^\d{4}-\d{2}$/.test(d.saldoIni.mes || '')) ? d.saldoIni.mes : fechMes();
  const LIMITE_MESES = 60; // recorrências são projetadas 5 anos à frente do Fechamento Atual

  // ───────────── regras de negócio (puras, testáveis) ─────────────
  function dividir(valor, n) { // n parcelas em centavos exatos; a sobra vai na última
    n = Math.max(1, Math.floor(n) || 1); const t = cents(valor), base = Math.trunc(t / n), out = [];
    for (let i = 0; i < n; i++) out.push((i === n - 1 ? t - base * (n - 1) : base) / 100);
    return out;
  }
  // Compra até o dia de fechamento entra na fatura que fecha no mesmo mês; depois, na do mês seguinte.
  // Vence no mês do fechamento se o dia de vencimento é maior que o de fechamento; senão, no mês seguinte.
  function faturaDaCompra(dataCompra, cartao) {
    const m = dataCompra.slice(0, 7), dia = +dataCompra.slice(8, 10), fech = +cartao.fechamento || 31, venc = +cartao.vencimento || 10;
    const mesFecha = dia <= fech ? m : somaMes(m, 1);
    const mesVenc = venc > fech ? mesFecha : somaMes(mesFecha, 1);
    return { fatura: mesFecha, venc: diaNoMes(mesVenc, venc) };
  }
  function gerarParcelas(item, cartao) { // compra (única ou parcelada)
    const n = item.parcelado ? Math.max(1, Math.floor(item.n) || 1) : 1, vals = dividir(item.valor, n), out = [];
    if (item.forma === 'cartao' && cartao) {
      const f0 = faturaDaCompra(item.data, cartao);
      for (let i = 0; i < n; i++) out.push({ n: i + 1, fatura: somaMes(f0.fatura, i), venc: diaNoMes(somaMes(f0.venc.slice(0, 7), i), +f0.venc.slice(8, 10)), valor: vals[i], pago: false, dataPago: null });
    } else {
      const v0 = item.venc1 || somaDias(item.data, 30);
      for (let i = 0; i < n; i++) out.push({ n: i + 1, venc: diaNoMes(somaMes(v0.slice(0, 7), i), +v0.slice(8, 10)), valor: vals[i], pago: false, dataPago: null });
    }
    return out;
  }
  // Recorrência: uma ocorrência por mês, do mês inicial até `ateMes` (ou até o fim, se encerrada). Só ACRESCENTA o que falta.
  function estenderRecorrencia(item, cartao, ateMes) {
    if (!item.rec || !item.inicio) return false;
    item.parcelas = item.parcelas || [];
    const ultimo = item.parcelas.length ? item.parcelas.reduce((a, p) => p.mes > a ? p.mes : a, '0000-00') : null;
    let m = ultimo ? somaMes(ultimo, 1) : item.inicio, mudou = false;
    const limite = item.fim ? somaMes(item.fim, -1) : ateMes;
    for (; m <= limite && m <= ateMes; m = somaMes(m, 1)) {
      const p = { n: item.parcelas.length + 1, mes: m, rec: true, valor: Number(item.valor) || 0, pago: false, dataPago: null };
      if (item.forma === 'cartao' && cartao) { const f = faturaDaCompra(diaNoMes(m, +item.diaVenc || 1), cartao); p.fatura = f.fatura; p.venc = f.venc; }
      else p.venc = diaNoMes(m, +item.diaVenc || 1);
      item.parcelas.push(p); mudou = true;
    }
    return mudou;
  }
  function garantirRecorrencias(d, ateMes) {
    let mudou = false;
    ['pagar', 'receber'].forEach(tp => (d[tp] || []).forEach(it => { if (it.rec) { const c = it.cartaoId ? (d.cartoes || []).find(x => x.id === it.cartaoId) : null; if (estenderRecorrencia(it, c, ateMes)) mudou = true; } }));
    return mudou;
  }
  // Alterar o valor de uma ocorrência: só ela, ou ela e as próximas ainda em aberto (e o valor padrão da recorrência).
  function alterarValorParcela(item, n, novo, paraFrente) {
    let k = 0;
    (item.parcelas || []).forEach(p => { if (p.n === n && !p.pago) { p.valor = novo; k++; } else if (paraFrente && p.n > n && !p.pago) { p.valor = novo; k++; } });
    if (paraFrente && item.rec) item.valor = novo;
    return k;
  }
  function encerrarRecorrencia(item, mes) { // tira as ocorrências em aberto a partir de `mes` e não gera mais
    item.fim = mes; const antes = (item.parcelas || []).length;
    item.parcelas = (item.parcelas || []).filter(p => p.pago || !(p.mes >= mes)); return antes - item.parcelas.length;
  }
  // Saldo acumulado no fim de um mês: saldo inicial + vencimentos até o mês − pagamentos até o mês (o que não foi baixado acumula).
  // opc.semCartao: só contas fora do cartão (o cartão aparece pela fatura).
  function saldoMes(dados, tipo, mes, opc) {
    const itens = (dados[tipo] || []).filter(it => !(opc && opc.semCartao && it.forma === 'cartao')), fim = fimMes(mes), ini = Number((dados.saldoIni || {})[tipo]) || 0, ant = fimMes(somaMes(mes, -1));
    let venceAntes = 0, pagoAntes = 0, novos = 0, pagos = 0, aVencer = 0; const abertas = [];
    itens.forEach(it => (it.parcelas || []).forEach(p => {
      const v = cents(p.valor);
      if (p.venc <= ant) venceAntes += v; else if (p.venc <= fim) novos += v; else aVencer += v;
      if (p.pago && p.dataPago) { if (p.dataPago <= ant) pagoAntes += v; else if (p.dataPago <= fim) pagos += v; }
      const pagaAteFim = p.pago && p.dataPago && p.dataPago <= fim;
      if (p.venc <= fim && !pagaAteFim) abertas.push({ item: it, p });
    }));
    const a2 = cents(ini) + venceAntes - pagoAntes;
    return { anterior: a2 / 100, novos: novos / 100, pagos: pagos / 100, final: (a2 + novos - pagos) / 100, aVencer: aVencer / 100, abertas, saldoIni: ini };
  }
  function faturasDoCartao(dados, cartaoId) {
    const mapa = {};
    (dados.pagar || []).forEach(it => { if (it.forma !== 'cartao' || it.cartaoId !== cartaoId) return; (it.parcelas || []).forEach(p => { const k = p.fatura; if (!k) return; (mapa[k] = mapa[k] || { fatura: k, venc: p.venc, total: 0, pago: 0, linhas: [] }); mapa[k].total += cents(p.valor); if (p.pago) mapa[k].pago += cents(p.valor); mapa[k].linhas.push({ item: it, p }); }); });
    return Object.keys(mapa).sort().map(k => { const f = mapa[k]; return { fatura: f.fatura, venc: f.venc, total: f.total / 100, pago: f.pago / 100, aberto: (f.total - f.pago) / 100, linhas: f.linhas }; });
  }
  // Limite em uso NO MÊS de referência: soma o que está em aberto nas faturas que vencem até esse mês (o mês inteiro já conta como comprometido; o que não foi pago acumula). Faturas de meses depois ainda não pesam. Sem mês = tudo em aberto.
  const limiteUsado = (dados, cartaoId, mes) => faturasDoCartao(dados, cartaoId).reduce((a, f) => (!mes || f.venc.slice(0, 7) <= mes) ? a + f.aberto : a, 0);
  // Limite UNIFICADO: cartões com `limiteCom` = id de outro cartão dividem o limite dele (conta uma vez só). Vencimentos podem ser diferentes.
  const mestreDe = (dados, c) => { const m = c && c.limiteCom && (dados.cartoes || []).find(x => x.id === c.limiteCom && !x.limiteCom); return m || c; };
  const gruposCartoes = dados => { const g = {}; (dados.cartoes || []).forEach(c => { const m = mestreDe(dados, c); (g[m.id] = g[m.id] || { mestre: m, membros: [] }).membros.push(c); }); return Object.keys(g).map(k => g[k]); };
  const grupoUso = (dados, g, mes) => g.membros.reduce((a, c) => a + limiteUsado(dados, c.id, mes), 0);
  // Faturas que VENCEM no mês, de todos os cartões (para a aba Saldo).
  function faturasQueVencemNoMes(dados, mes) {
    const out = []; (dados.cartoes || []).forEach(c => faturasDoCartao(dados, c.id).forEach(f => { if (f.venc.slice(0, 7) === mes) out.push({ cartao: c, ...f }); })); return out;
  }
  // Ajuste de fatura: o valor correto informado vira uma linha de ajuste (positiva ou negativa) na própria fatura.
  function ajusteDeFatura(dados, cartaoId, fatura, valorCorreto, hojeIso) {
    const f = faturasDoCartao(dados, cartaoId).find(x => x.fatura === fatura); if (!f) return null;
    const dif = (cents(valorCorreto) - cents(f.total)) / 100; if (!dif) return null;
    return { id: uid(), data: hojeIso || hoje(), fornecedor: 'Ajuste de fatura', tipo: 'Ajuste', valor: dif, parcelado: false, n: 1, forma: 'cartao', cartaoId, ajuste: true, parcelas: [{ n: 1, fatura, venc: f.venc, valor: dif, pago: false, dataPago: null }] };
  }
  function lancamentoTexto(l, banco) {
    banco = banco || 'Banco';
    if (l.baixa && l.baixa.length) return l.valor < 0 ? 'D Fornecedores (contas a pagar) · C ' + banco : 'D ' + banco + ' · C Clientes (contas a receber)';
    if (l.classe) return l.valor < 0 ? 'D Despesa — ' + (l.classe.categoria || 'Gastos') + ' · C ' + banco : 'D ' + banco + ' · C Receita — ' + (l.classe.categoria || 'Entradas');
    return '';
  }
  root.__kcbmPfTeste = { mestreDe, gruposCartoes, grupoUso, temaCartao, get CORES_CARTAO() { return CORES_CARTAO; }, bandeiraSvg, lerLista, gravarLista, lerDados, gravarDados, dividir, faturaDaCompra, gerarParcelas, estenderRecorrencia, garantirRecorrencias, alterarValorParcela, encerrarRecorrencia, saldoMes, faturasDoCartao, faturasQueVencemNoMes, ajusteDeFatura, limiteUsado, lancamentoTexto, cpfValido, somaMes, num, mesInicio };

  // Símbolo de cada bandeira (desenho simples em SVG, sem imagem externa). Bandeira própria/desconhecida: cartão genérico com as iniciais.
  function bandeiraSvg(nome, h) {
    h = h || 22; const w = Math.round(h * 1.6), n = norm(nome), cab = c => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 30" width="' + w + '" height="' + h + '" style="vertical-align:middle;flex:none" role="img" aria-label="' + E(nome || 'cartão') + '">' + c + '</svg>';
    const txt = (t, x, y, sz, cor2, extra) => '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="' + sz + '" fill="' + cor2 + '" ' + (extra || '') + '>' + t + '</text>';
    if (n === 'mastercard') return cab('<rect width="48" height="30" rx="4" fill="#fff" stroke="#d6d6d6"/><circle cx="19" cy="15" r="9.5" fill="#EB001B"/><circle cx="29" cy="15" r="9.5" fill="#F79E1B"/><path d="M24 7.2a9.5 9.5 0 0 1 0 15.6a9.5 9.5 0 0 1 0-15.6z" fill="#FF5F00"/>');
    if (n === 'visa') return cab('<defs><clipPath id="kpfVisaClip"><rect width="48" height="30" rx="4"/></clipPath></defs><g clip-path="url(#kpfVisaClip)"><rect width="48" height="30" fill="#fff"/><rect width="48" height="5.6" fill="#1A1F71"/><rect y="24.4" width="48" height="5.6" fill="#F7B600"/></g><rect width="48" height="30" rx="4" fill="none" stroke="#d6d6d6" stroke-width=".8"/>' + txt('VISA', 24, 21.4, 14.5, '#1A1F71', 'font-style="italic" letter-spacing="-.4"'));
    if (n === 'elo') return cab('<rect width="48" height="30" rx="4" fill="#111"/>' + txt('elo', 19, 21, 15, '#fff') + '<circle cx="33" cy="11" r="2.6" fill="#FFCB05"/><circle cx="38" cy="16" r="2.6" fill="#00A4E0"/><circle cx="33" cy="21" r="2.6" fill="#EF4123"/>');
    if (n === 'american express') return cab('<rect width="48" height="30" rx="4" fill="#2E77BB"/>' + txt('AMEX', 24, 19, 11.5, '#fff'));
    if (n === 'hipercard') return cab('<rect width="48" height="30" rx="4" fill="#B3131B"/>' + txt('Hipercard', 24, 18.5, 8.3, '#fff'));
    if (n === 'diners club') return cab('<rect width="48" height="30" rx="4" fill="#fff" stroke="#d6d6d6"/><circle cx="24" cy="15" r="9.5" fill="none" stroke="#0079BE" stroke-width="2.4"/><rect x="23" y="5.5" width="2" height="19" fill="#0079BE"/><path d="M17 15a7 7 0 0 1 4.2-6.4v12.8A7 7 0 0 1 17 15zM31 15a7 7 0 0 0-4.2-6.4v12.8A7 7 0 0 0 31 15z" fill="#0079BE" opacity=".25"/>');
    if (n === 'discover') return cab('<rect width="48" height="30" rx="4" fill="#fff" stroke="#d6d6d6"/><circle cx="34" cy="15" r="6.2" fill="#F76F20"/>' + txt('DISCOVER', 19, 18.5, 6.4, '#222'));
    if (n === 'cabal') return cab('<rect width="48" height="30" rx="4" fill="#0B4EA2"/>' + txt('CABAL', 24, 19, 10.5, '#fff'));
    if (n === 'jcb') return cab('<rect width="48" height="30" rx="4" fill="#fff" stroke="#d6d6d6"/><rect x="7" y="5" width="10" height="20" rx="3" fill="#0E4C96"/><rect x="19" y="5" width="10" height="20" rx="3" fill="#D6001C"/><rect x="31" y="5" width="10" height="20" rx="3" fill="#00A35C"/>' + txt('J', 12, 19, 10, '#fff') + txt('C', 24, 19, 10, '#fff') + txt('B', 36, 19, 10, '#fff'));
    if (n === 'sorocred') return cab('<rect width="48" height="30" rx="4" fill="#E2231A"/>' + txt('Soro', 24, 14, 9, '#fff') + txt('cred', 24, 24, 9, '#fff'));
    if (n === 'aura') return cab('<rect width="48" height="30" rx="4" fill="#00A859"/>' + txt('AURA', 24, 19, 11, '#fff'));
    const ini = (nome || '?').trim().split(/\s+/).map(x => x[0]).join('').slice(0, 3).toUpperCase();
    return cab('<rect width="48" height="30" rx="4" fill="#64748B"/><rect y="6" width="48" height="5" fill="#334155"/>' + txt(E(ini), 24, 23, 10, '#fff'));
  }
  // Cores do cartão (30 opções). O texto do cartão vira branco nas cores escuras e escuro nas claras.
  const CORES_CARTAO = [
    ['Vermelho', '#DC2626'], ['Vermelho-tijolo', '#B91C1C'], ['Avermelhado suave', '#C2554D'], ['Rosa antigo', '#B8636E'], ['Pink', '#E11D74'], ['Rosa claro', '#F4A6B8'],
    ['Laranja', '#EA580C'], ['Laranja suave', '#F2994A'], ['Âmbar', '#F59E0B'], ['Amarelo', '#FACC15'], ['Mostarda', '#C9A227'], ['Lima', '#84CC16'],
    ['Verde', '#16A34A'], ['Verde escuro', '#166534'], ['Verde-água', '#0D9488'], ['Menta', '#6EE7B7'], ['Ciano', '#06B6D4'], ['Azul-céu', '#38BDF8'],
    ['Azul', '#2563EB'], ['Azul-marinho', '#1E3A8A'], ['Índigo', '#4338CA'], ['Roxo', '#7E22CE'], ['Lilás', '#A78BFA'], ['Berinjela', '#581C87'],
    ['Marrom', '#92400E'], ['Café', '#5B3A29'], ['Cinza', '#6B7280'], ['Grafite', '#1F2937'], ['Preto', '#111827'], ['Prata', '#CBD5E1']
  ];
  function temaCartao(cor) {
    if (!/^#[0-9a-f]{6}$/i.test(cor || '')) return { bg: 'var(--white)', fg: 'var(--ink)', mut: 'var(--slate)', neg: '#dc2626', pos: 'var(--teal)', borda: 'var(--border)', sel: 'var(--teal)' };
    const r = parseInt(cor.slice(1, 3), 16), g = parseInt(cor.slice(3, 5), 16), b = parseInt(cor.slice(5, 7), 16), escuro = (0.299 * r + 0.587 * g + 0.114 * b) < 150;
    return escuro ? { bg: cor, fg: '#fff', mut: 'rgba(255,255,255,.78)', neg: '#FECACA', pos: '#fff', borda: 'rgba(0,0,0,.25)', sel: '#fff' } : { bg: cor, fg: '#111827', mut: 'rgba(17,24,39,.72)', neg: '#991B1B', pos: '#14532D', borda: 'rgba(0,0,0,.18)', sel: '#111827' };
  }
  // ───────────── estado e telas ─────────────
  const ST = { pf: null, aba: 'pagar', mesSaldo: null, mesLista: hoje().slice(0, 7), cartaoSel: null, mesFatura: null, tela: 'lista' };
  const el = () => document.getElementById('page-kcbm-pf');
  const ABAS = [['pagar', '🧾 Contas a pagar'], ['receber', '💰 Contas a receber'], ['extrato', '🏦 Extrato bancário'], ['cartoes', '💳 Cartões de crédito'], ['saldo', '⚖ Saldo a pagar / a receber']];
  const B = (txt, on, cls, ttl) => '<button class="btn ' + (cls || 'bo') + ' bsm" ' + (ttl ? 'title="' + E(ttl) + '" ' : '') + 'onclick="' + on + '">' + txt + '</button>';
  const IN = 'width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--white);color:var(--ink);font:inherit;font-size:13px';
  const TH = 'padding:7px 9px;text-align:left;font-size:11.5px;white-space:nowrap;background:var(--ink2);color:#fff';
  const TD = 'padding:6px 9px;border-bottom:1px solid var(--border);font-size:12.5px;vertical-align:top';
  const dadosAtual = () => { const d = lerDados(ST.pf); if (garantirRecorrencias(d, somaMes(fechMes(), LIMITE_MESES))) gravarDados(ST.pf, d); return d; };
  const pfAtual = () => lerLista().find(x => x.id === ST.pf);
  function tabela(cols, linhas, vazio) {
    return '<div style="overflow:auto;border:1px solid var(--border);border-radius:8px"><table style="width:100%;border-collapse:collapse"><thead><tr>' + cols.map(c => '<th style="' + TH + (c.r ? ';text-align:right' : '') + '">' + c.t + '</th>').join('') + '</tr></thead><tbody>'
      + (linhas.length ? linhas.join('') : '<tr><td colspan="' + cols.length + '" style="padding:22px;text-align:center;color:var(--slate)">' + (vazio || 'Nada por aqui ainda.') + '</td></tr>') + '</tbody></table></div>';
  }
  const td = (v, r) => '<td style="' + TD + (r ? ';text-align:right;white-space:nowrap' : '') + '">' + v + '</td>';
  const cor = v => v < 0 ? '#dc2626' : 'var(--teal)';
  function modal(titulo, corpoHtml, aoSalvar, rotSalvar, larg) {
    let m = document.getElementById('kpfModal'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'kpfModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:5vh 12px;overflow:auto';
    m.innerHTML = '<div style="background:var(--white);color:var(--ink);border:1px solid var(--border);border-radius:12px;width:100%;max-width:' + (larg || 560) + 'px;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.5)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:15px">' + titulo + '</b><button id="kpfX" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--slate)">✕</button></div><div id="kpfCorpo">' + corpoHtml + '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn bo" id="kpfCancel">' + (aoSalvar ? 'Cancelar' : 'Fechar') + '</button>' + (aoSalvar ? '<button class="btn bp" id="kpfOk">' + (rotSalvar || 'Salvar') + '</button>' : '') + '</div></div>';
    document.body.appendChild(m);
    const fechar = () => { m.remove(); };
    m.querySelector('#kpfX').onclick = m.querySelector('#kpfCancel').onclick = fechar;
    if (aoSalvar) m.querySelector('#kpfOk').onclick = async () => { const r = await aoSalvar(m); if (r !== false) fechar(); };
    return m;
  }
  const campo = (rot, html, dica) => '<div style="margin-bottom:9px"><label style="font-size:11.5px;font-weight:600;color:var(--slate);display:block;margin-bottom:3px">' + rot + '</label>' + html + (dica ? '<div style="font-size:11px;color:var(--slate);margin-top:2px">' + dica + '</div>' : '') + '</div>';
  const inp = (id, v, tipo, extra) => '<input id="' + id + '" type="' + (tipo || 'text') + '" value="' + E(v == null ? '' : v) + '" style="' + IN + '" ' + (extra || '') + '>';
  const sel = (id, opts, v, extra) => '<select id="' + id + '" style="' + IN + '" ' + (extra || '') + '>' + opts.map(o => '<option value="' + E(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + E(o[1]) + '</option>').join('') + '</select>';
  const val = (m, id) => (m.querySelector('#' + id) || {}).value;
  const chk = (m, id) => !!(m.querySelector('#' + id) || {}).checked;
  // seleção de tipo de gasto/receita (cadastro universal)
  const tiposDe = nat => lerTipos().filter(t => t.natureza === nat).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const selTipo = (id, nat, atual) => { const ts = tiposDe(nat); return ts.length ? sel(id, [['', '— escolha —']].concat(ts.map(t => [t.nome, t.nome])), atual || '') + (atual && !ts.some(t => t.nome === atual) ? '<div style="font-size:11px;color:#b45309">"' + E(atual) + '" não está mais na lista de tipos.</div>' : '') : '<div style="font-size:12px;color:#b45309">Nenhum tipo de ' + nat + ' cadastrado — cadastre em “Tipos de gasto / receita” (na lista de pessoas físicas).</div><input type="hidden" id="' + id + '" value="">'; };
  const navMes = (mes, pref) => '<div style="display:flex;align-items:center;gap:6px">' + B('‹', pref + '(-1)') + '<b style="min-width:150px;text-align:center">' + rotMes(mes) + '</b>' + B('›', pref + '(1)') + '</div>';
  // campo de pessoa (fornecedor/cliente) com sugestões do cadastro universal
  const datalistTerc = (id, tipo) => '<datalist id="' + id + '">' + lerTerceiros().filter(t => t.tipo === tipo || t.tipo === 'ambos').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(t => '<option value="' + E(t.nome) + '">').join('') + '</datalist>';
  function registrarTerceiro(nome, tipo) { // todo fornecedor/cliente digitado entra no cadastro universal
    nome = (nome || '').trim(); if (!nome) return; const l = lerTerceiros(), x = l.find(t => norm(t.nome) === norm(nome));
    if (!x) l.push({ id: uid(), nome, tipo }); else if (x.tipo !== tipo && x.tipo !== 'ambos') x.tipo = 'ambos'; else return;
    gravarChave('kcbm_pf_terceiros', l);
  }

  // ───────────── lista de pessoas ─────────────
  function telaLista() {
    const lista = lerLista();
    const linhas = lista.map(p => {
      const d = lerDados(p.id), m = fechMes() < mesInicio(d) ? mesInicio(d) : fechMes();
      const sp = saldoMes(d, 'pagar', m, { semCartao: true }), sr = saldoMes(d, 'receber', m), fat = faturasQueVencemNoMes(d, m).reduce((a, f) => a + f.aberto, 0);
      return '<tr style="cursor:pointer" onclick="kcbmPf.abrir(\'' + p.id + '\')"><td style="' + TD + ';font-weight:600">' + E(p.nome) + '</td>' + td(E(fmtCpf(p.cpf)) || '—') + td(R$(sp.final + fat), 1) + td(R$(sr.final), 1)
        + '<td style="' + TD + ';text-align:right;white-space:nowrap" onclick="event.stopPropagation()">' + B('Abrir', "kcbmPf.abrir('" + p.id + "')", 'bp') + ' ' + B('✏️', "kcbmPf.editarPessoa('" + p.id + "')", 'bo', 'Editar nome/CPF') + ' ' + B('🗑', "kcbmPf.excluirPessoa('" + p.id + "')", 'bo', 'Excluir esta pessoa e todos os dados dela (pede confirmação)') + '</td></tr>';
    });
    el().innerHTML = '<div style="padding:18px 22px 40px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><img src="assets/pessoa-fisica.svg" alt="" style="height:28px;width:28px"><div style="font-size:1.3rem;font-weight:700">Pessoa Física</div>'
      + '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">' + B('🏷 Tipos de gasto / receita', "kcbmPf.tela('tipos')") + B('👥 Fornecedores e clientes', "kcbmPf.tela('terceiros')") + B('⬇ Exportar dados', 'kcbmPf.exportar()', 'bo', 'Baixa um arquivo com tudo deste módulo (para levar ao Fluxo PF ou guardar como backup)') + B('+ Nova pessoa física', 'kcbmPf.novaPessoa()', 'bp') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Cadastre a pessoa e abra para lançar contas a pagar/receber, extrato, cartões e ver o saldo. Os valores da lista são do Fechamento Atual (' + rotMes(fechMes()) + '): contas a pagar + faturas que vencem no mês, e contas a receber.</div>'
      + tabela([{ t: 'Pessoa' }, { t: 'CPF' }, { t: 'A pagar (mês)', r: 1 }, { t: 'A receber (saldo)', r: 1 }, { t: '' }], linhas, 'Nenhuma pessoa física cadastrada. Clique em "+ Nova pessoa física".') + '</div>';
  }
  function formPessoa(p) { return campo('Nome *', inp('kpfNome', p ? p.nome : '', 'text', 'maxlength="120"')) + campo('CPF', inp('kpfCpf', p ? fmtCpf(p.cpf) : '', 'text', 'inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')) + campo('Observação', inp('kpfObs', p ? p.obs : '', 'text', 'maxlength="200"')); }
  function lerFormPessoa(m) {
    const nome = (val(m, 'kpfNome') || '').trim(); if (!nome) { root.toast('Informe o nome.', 'err'); return null; }
    const cpf = dig(val(m, 'kpfCpf')); if (cpf && !cpfValido(cpf) && !confirm('Esse CPF não parece válido. Salvar mesmo assim?')) return null;
    return { nome, cpf, obs: (val(m, 'kpfObs') || '').trim() };
  }
  // ── cadastros universais ──
  function telaTipos() {
    const ts = lerTipos().sort((a, b) => a.natureza.localeCompare(b.natureza) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const linhas = ts.map(t => '<tr>' + td('<b>' + E(t.nome) + '</b>') + td(t.natureza === 'gasto' ? '<span style="color:#dc2626">Gasto</span>' : '<span style="color:var(--teal)">Receita</span>') + '<td style="' + TD + ';text-align:right">' + B('✏️', "kcbmPf.tipoForm('" + t.id + "')") + ' ' + B('🗑', "kcbmPf.tipoExcluir('" + t.id + "')") + '</td></tr>');
    el().innerHTML = '<div style="padding:18px 22px 40px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + B('← Pessoas físicas', "kcbmPf.tela('lista')") + '<div style="font-size:1.25rem;font-weight:700">🏷 Tipos de gasto / receita</div><div style="margin-left:auto">' + B('+ Novo tipo', 'kcbmPf.tipoForm()', 'bp') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Cadastro único: vale para <b>todas as pessoas físicas</b>. Os tipos de gasto aparecem nas contas a pagar e nos gastos; os de receita, nas contas a receber e nas entradas.</div>'
      + tabela([{ t: 'Nome' }, { t: 'É' }, { t: '' }], linhas, 'Nenhum tipo cadastrado. Clique em "+ Novo tipo".') + '</div>';
  }
  function telaTerceiros() {
    const ts = lerTerceiros().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const linhas = ts.map(t => '<tr>' + td('<b>' + E(t.nome) + '</b>') + td({ fornecedor: 'Fornecedor', cliente: 'Cliente', ambos: 'Fornecedor e cliente' }[t.tipo] || '') + td(E(t.doc || '')) + '<td style="' + TD + ';text-align:right">' + B('✏️', "kcbmPf.tercForm('" + t.id + "')") + ' ' + B('🗑', "kcbmPf.tercExcluir('" + t.id + "')") + '</td></tr>');
    el().innerHTML = '<div style="padding:18px 22px 40px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + B('← Pessoas físicas', "kcbmPf.tela('lista')") + '<div style="font-size:1.25rem;font-weight:700">👥 Fornecedores e clientes</div><div style="margin-left:auto">' + B('+ Novo', 'kcbmPf.tercForm()', 'bp') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Cadastro único para todas as pessoas. Todo fornecedor ou cliente que você digitar numa conta a pagar/receber entra aqui sozinho, e depois aparece como sugestão ao cadastrar de novo.</div>'
      + tabela([{ t: 'Nome' }, { t: 'Tipo' }, { t: 'CPF/CNPJ' }, { t: '' }], linhas, 'Ninguém cadastrado ainda.') + '</div>';
  }

  // ───────────── dentro da pessoa ─────────────
  function telaPessoa() {
    const p = pfAtual(); if (!p) { ST.pf = null; return telaLista(); }
    const abas = ABAS.map(a => '<button onclick="kcbmPf.aba(\'' + a[0] + '\')" style="padding:8px 14px;border:1px solid var(--border);border-bottom:' + (ST.aba === a[0] ? '3px solid var(--teal)' : '1px solid var(--border)') + ';background:' + (ST.aba === a[0] ? 'var(--white)' : 'transparent') + ';color:var(--ink);font-weight:' + (ST.aba === a[0] ? '700' : '500') + ';border-radius:8px 8px 0 0;cursor:pointer;font-size:12.5px;white-space:nowrap">' + a[1] + '</button>').join('');
    el().innerHTML = '<div style="padding:16px 22px 40px"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + B('← Pessoas físicas', 'kcbmPf.voltar()') + '<div style="font-size:1.25rem;font-weight:700">' + E(p.nome) + '</div><div style="font-size:12px;color:var(--slate)">' + E(fmtCpf(p.cpf)) + '</div></div>'
      + '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;border-bottom:1px solid var(--border)">' + abas + '</div><div id="kpfAba">' + telaAba() + '</div></div>';
  }
  function telaAba() {
    const d = dadosAtual();
    return ({ entradas: () => abaMov(d, 'entradas'), gastos: () => abaMov(d, 'gastos'), extrato: () => abaExtrato(d), pagar: () => abaTitulos(d, 'pagar'), receber: () => abaTitulos(d, 'receber'), saldo: () => abaSaldo(d), cartoes: () => abaCartoes(d) }[ST.aba] || (() => ''))();
  }
  // ── Entradas / Gastos ──
  function abaMov(d, tipo) {
    const ent = tipo === 'entradas', mes = ST.mesLista, itens = (d[tipo] || []).filter(x => x.data.slice(0, 7) === mes).sort((a, b) => a.data.localeCompare(b.data));
    const total = itens.reduce((a, x) => a + cents(x.valor), 0) / 100;
    const linhas = itens.map(x => '<tr>' + td(br(x.data)) + td(E(x.descricao)) + td(E(x.categoria || '')) + td(E(x.banco || '')) + td(R$(x.valor), 1) + td(x.extratoId ? '<span title="Veio do extrato">🏦</span>' : '') + '<td style="' + TD + ';text-align:right">' + B('✏️', "kcbmPf.movForm('" + tipo + "','" + x.id + "')") + ' ' + B('🗑', "kcbmPf.movExcluir('" + tipo + "','" + x.id + "')") + '</td></tr>');
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes, 'kcbmPf.mesLista') + '<div style="margin-left:auto">' + B(ent ? '+ Nova entrada' : '+ Novo gasto', "kcbmPf.movForm('" + tipo + "')", 'bp') + '</div></div>'
      + tabela([{ t: 'Data' }, { t: 'Descrição' }, { t: ent ? 'Tipo de receita' : 'Tipo de gasto' }, { t: 'Banco' }, { t: 'Valor', r: 1 }, { t: '' }, { t: '' }], linhas, ent ? 'Nenhuma entrada neste mês.' : 'Nenhum gasto neste mês.')
      + '<div style="text-align:right;font-weight:700;margin-top:8px">Total do mês: <span style="color:' + (ent ? 'var(--teal)' : '#dc2626') + '">' + R$(total) + '</span></div>';
  }
  // ── Extrato bancário ──
  function abaExtrato(d) {
    const mes = ST.mesLista, itens = (d.extrato || []).filter(x => x.data.slice(0, 7) === mes).sort((a, b) => a.data.localeCompare(b.data) || (a.criado || 0) - (b.criado || 0));
    const ent = itens.filter(x => x.valor > 0).reduce((a, x) => a + cents(x.valor), 0) / 100, sai = itens.filter(x => x.valor < 0).reduce((a, x) => a + cents(x.valor), 0) / 100;
    const linhas = itens.map(x => {
      const lanc = lancamentoTexto(x, x.banco), pend = !lanc;
      return '<tr>' + '<td style="' + TD + '">' + (pend ? '<input type="checkbox" class="kpfSelL" data-id="' + x.id + '">' : '') + '</td>' + td(br(x.data)) + td(E(x.banco || '')) + td(E(x.hist)) + '<td style="' + TD + ';text-align:right;white-space:nowrap;color:' + cor(x.valor) + '">' + R$(x.valor) + '</td>'
        + td(pend ? '<span style="color:#b45309">— pendente —</span>' : '<span style="font-size:11.5px">' + E(lanc) + '</span>') + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + (pend ? B('Baixar / classificar', "kcbmPf.extratoBaixar('" + x.id + "')", 'bp') : B('↩ Desfazer', "kcbmPf.extratoDesfazer('" + x.id + "')")) + ' ' + B('🗑', "kcbmPf.extratoExcluir('" + x.id + "')") + '</td></tr>';
    });
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes, 'kcbmPf.mesLista') + '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">' + B('📄 Importar extrato (PDF)', 'kcbmPf.importarPdf()', 'bp', 'Sobe o PDF do extrato; o site lê e você classifica') + B('+ Lançar à mão', 'kcbmPf.extratoForm()') + B('✔ Classificar selecionadas', 'kcbmPf.extratoLote()', 'bo', 'Classifica várias linhas pendentes de uma vez') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:8px">Cada linha do extrato forma um <b>lançamento contábil</b>: dar baixa numa conta a pagar/receber, ou classificar como gasto/entrada (com o tipo cadastrado). Valor positivo = entrada; negativo = saída.</div>'
      + tabela([{ t: '<input type="checkbox" onchange="document.querySelectorAll(\'.kpfSelL\').forEach(c=>c.checked=this.checked)" title="Marcar todas as pendentes">' }, { t: 'Data' }, { t: 'Banco' }, { t: 'Histórico' }, { t: 'Valor', r: 1 }, { t: 'Lançamento contábil' }, { t: '' }], linhas, 'Nenhuma linha de extrato neste mês.')
      + '<div style="text-align:right;margin-top:8px;font-size:13px">Entradas <b style="color:var(--teal)">' + R$(ent) + '</b> · Saídas <b style="color:#dc2626">' + R$(sai) + '</b> · Resultado <b>' + R$(ent + sai) + '</b></div>';
  }
  // ── Contas a pagar / receber ──
  function abaTitulos(d, tipo) {
    const pag = tipo === 'pagar', itens = (d[tipo] || []).slice().sort((a, b) => b.data.localeCompare(a.data));
    const linhas = itens.map(it => {
      const ps = it.parcelas || [], feitas = ps.filter(p => p.pago).length, forma = it.forma === 'cartao' ? (() => { const cc = d.cartoes.find(c => c.id === it.cartaoId) || {}; return '<span style="display:inline-flex;align-items:center;gap:6px">' + bandeiraSvg(cc.bandeira, 16) + E(cc.nome || 'cartão') + '</span>'; })() : E({ avista: 'À vista / boleto', carne: 'Carnê', outro: 'Outro' }[it.forma] || '');
      const parc = it.rec ? '↻ todo mês, dia ' + it.diaVenc + (it.fim ? ' (até ' + rotMes(somaMes(it.fim, -1)) + ')' : '') : (it.parcelado ? it.n + 'x' : 'à vista');
      return '<tr>' + td(br(it.data)) + td(E(it[pag ? 'fornecedor' : 'cliente'])) + td(E(it.tipo || '')) + td(R$(it.valor), 1) + td(parc) + td(forma) + td(it.rec ? feitas + ' feitas · ' + (ps.length - feitas) + ' projetadas' : feitas + ' de ' + ps.length + ' ' + (pag ? 'pagas' : 'recebidas'))
        + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + B('Parcelas', "kcbmPf.tituloVer('" + tipo + "','" + it.id + "')") + ' ' + B('🗑', "kcbmPf.tituloExcluir('" + tipo + "','" + it.id + "')") + '</td></tr>';
    });
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><div style="font-weight:700">' + (pag ? 'Compras a prazo e contas a pagar' : 'Receitas a prazo e contas a receber') + '</div><div style="margin-left:auto">' + B(pag ? '+ Registrar compra / conta' : '+ Registrar receita', "kcbmPf.tituloForm('" + tipo + "')", 'bp') + '</div></div>'
      + tabela([{ t: 'Data' }, { t: pag ? 'Fornecedor' : 'Cliente' }, { t: pag ? 'Tipo de gasto' : 'Tipo de receita' }, { t: 'Valor', r: 1 }, { t: 'Parcelas / recorrência' }, { t: 'Forma' }, { t: 'Situação' }, { t: '' }], linhas, pag ? 'Nenhuma conta registrada.' : 'Nenhuma receita a receber registrada.');
  }
  // ── Cartões ──
  function abaCartoes(d) {
    const cards = d.cartoes.map(c => {
      const gr = gruposCartoes(d).find(g => g.membros.some(x => x.id === c.id)), unif = gr && gr.membros.length > 1, limG = Number(gr.mestre.limite) || 0, usado = unif ? grupoUso(d, gr, fechMes()) : limiteUsado(d, c.id, fechMes()), disp = limG - usado, sel2 = ST.cartaoSel === c.id, tm = temaCartao(c.cor);
      return '<div onclick="kcbmPf.cartaoSel(\'' + c.id + '\')" style="cursor:pointer;min-width:230px;flex:0 1 270px;border:' + (sel2 ? '3px' : '2px') + ' solid ' + (sel2 ? tm.sel : tm.borda) + ';border-radius:12px;padding:12px 14px;background:' + tm.bg + ';color:' + tm.fg + '"><div style="display:flex;justify-content:space-between;align-items:center"><b style="display:flex;align-items:center;gap:8px">' + bandeiraSvg(c.bandeira, 24) + E(c.nome) + '</b><span onclick="event.stopPropagation()">' + B('✏️', "kcbmPf.cartaoForm('" + c.id + "')") + '</span></div>'
        + '<div style="font-size:12px;color:' + tm.mut + ';margin:4px 0">' + E(c.bandeira || 'Bandeira não informada') + ' · fecha dia ' + c.fechamento + ' · vence dia ' + c.vencimento + '</div><div style="font-size:12.5px;line-height:1.6">' + (unif ? '<span style="font-size:11px;color:' + tm.mut + '">Limite unificado: ' + gr.membros.map(x => E(x.nome)).join(' + ') + '</span><br>' : '') + 'Limite <b>' + R$(limG) + '</b><br>Em uso' + (unif ? ' (grupo)' : '') + ' em ' + fechMes().slice(5, 7) + '/' + fechMes().slice(0, 4) + ' <b style="color:' + tm.neg + '">' + R$(usado) + '</b><br>Disponível <b style="color:' + (disp < 0 ? tm.neg : tm.pos) + '">' + R$(disp) + '</b></div></div>';
    }).join('');
    let det = ''; const c = d.cartoes.find(x => x.id === ST.cartaoSel);
    if (c) {
      const fats = faturasDoCartao(d, c.id), prox = fats.filter(f => f.aberto > 0.004)[0];
      const linhas = fats.map(f => '<tr style="' + (ST.mesFatura === f.fatura ? 'background:rgba(20,184,166,.12)' : '') + ';cursor:pointer" onclick="kcbmPf.faturaSel(\'' + f.fatura + '\')">' + td('<b>' + rotMes(f.fatura) + '</b>') + td(br(f.venc)) + td(R$(f.total), 1) + td(R$(f.pago), 1) + td('<b style="color:' + (f.aberto > 0.004 ? '#dc2626' : 'var(--teal)') + '">' + R$(f.aberto) + '</b>', 1) + '</tr>');
      const fs = fats.find(f => f.fatura === ST.mesFatura);
      const compras = fs ? tabela([{ t: 'Compra' }, { t: 'Fornecedor' }, { t: 'Parcela' }, { t: 'Valor', r: 1 }, { t: 'Situação' }, { t: '' }], fs.linhas.map(x => '<tr>' + td(br(x.item.data)) + td(E(x.item.fornecedor)) + td(x.item.rec ? '↻ mensal' : (x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista')) + td('<span style="color:' + cor(x.p.valor) + '">' + R$(x.p.valor) + '</span>', 1) + td(x.p.pago ? '<span style="color:var(--teal)">paga em ' + br(x.p.dataPago) + '</span>' : 'em aberto') + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + (x.p.pago ? '' : B('✏️', x.item.manual ? "kcbmPf.saldoCartaoEditar('" + x.item.id + "')" : "kcbmPf.parcelaValor('pagar','" + x.item.id + "'," + x.p.n + ")", 'bo', 'Editar')) + ' ' + B('🗑', "kcbmPf.tituloExcluir('pagar','" + x.item.id + "')", 'bo', 'Excluir') + '</td></tr>'), '') : '';
      det = '<div style="margin-top:16px"><div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">' + bandeiraSvg(c.bandeira, 20) + 'Faturas — ' + E(c.nome) + ' ' + B('+ Saldo inicial', "kcbmPf.faturaManual('" + c.id + "')", 'bo', 'Informe quanto você já deve numa fatura que existe (ex.: a de novembro), sem detalhar as compras') + (prox ? ' <span style="font-weight:400;color:var(--slate)">· próxima a pagar: ' + rotMes(prox.fatura) + ', vence ' + br(prox.venc) + ', <b style="color:#dc2626">' + R$(prox.aberto) + '</b></span>' : '') + '</div>'
        + tabela([{ t: 'Fatura (fechamento)' }, { t: 'Vencimento' }, { t: 'Total', r: 1 }, { t: 'Pago', r: 1 }, { t: 'Em aberto', r: 1 }], linhas, 'Nenhuma compra neste cartão ainda.')
        + (fs ? '<div style="margin-top:12px;display:flex;align-items:center;gap:10px"><b>Compras da fatura de ' + rotMes(fs.fatura) + '</b>' + B('⚖ Ajustar fatura', "kcbmPf.faturaAjuste('" + c.id + "','" + fs.fatura + "')", 'bo', 'Informe o valor correto da fatura e o site lança a diferença como ajuste') + (fs.aberto > 0.004 ? B('✔ Dar baixa', "kcbmPf.faturaBaixa('" + c.id + "','" + fs.fatura + "')", 'bp', 'Marca a fatura inteira como paga na data que você informar') : '') + (fs.pago > 0.004 ? B('↩ Desfazer baixa', "kcbmPf.faturaDesfazBaixa('" + c.id + "','" + fs.fatura + "')", 'bo', 'Volta a fatura para em aberto (só as baixas feitas por aqui)') : '') + '</div>' + compras : '<div style="font-size:12px;color:var(--slate);margin-top:6px">Clique numa fatura para ver as compras dela e ajustar o valor.</div>') + '</div>';
    }
    const refM = fechMes(), gs = gruposCartoes(d), limTot = gs.reduce((a, g) => a + (Number(g.mestre.limite) || 0), 0), usoTot = gs.reduce((a, g) => a + grupoUso(d, g, refM), 0), fv = faturasQueVencemNoMes(d, refM), aPagar = fv.reduce((a, f) => a + f.aberto, 0), jaPago = fv.reduce((a, f) => a + f.pago, 0);
    const mini = (t, v, sub, cor) => '<div style="flex:1 1 170px;min-width:150px;border:1px solid var(--border);border-radius:10px;padding:9px 12px;background:var(--white)"><div style="font-size:11px;color:var(--slate);font-weight:600">' + t + '</div><div style="font-size:18px;font-weight:800;color:' + (cor || 'var(--ink)') + ';margin:2px 0">' + R$(v) + '</div><div style="font-size:11px;color:var(--slate)">' + sub + '</div></div>';
    const resumo = d.cartoes.length ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + mini('A pagar em ' + refM.slice(5, 7) + '/' + refM.slice(0, 4), aPagar, fv.length + ' fatura(s) vencendo' + (jaPago > 0.004 ? ' · já pago ' + R$(jaPago) : ''), aPagar > 0.004 ? '#dc2626' : '') + mini('Limite total', limTot, gs.length + ' limite(s)' + (gs.length < d.cartoes.length ? ' · unificados contam 1 vez' : '')) + mini('Em uso até ' + refM.slice(5, 7) + '/' + refM.slice(0, 4), usoTot, limTot ? Math.round(usoTot / limTot * 100) + '% do limite' : '') + mini('Disponível', limTot - usoTot, 'limite total − em uso', limTot - usoTot < 0 ? '#dc2626' : 'var(--teal)') + '</div>' : '';
    return resumo + '<div style="display:flex;align-items:center;margin-bottom:10px"><div style="font-weight:700">Cartões de crédito</div><div style="margin-left:auto">' + B('+ Novo cartão', 'kcbmPf.cartaoForm()', 'bp') + '</div></div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap">' + (cards || '<div style="color:var(--slate);padding:16px">Nenhum cartão cadastrado. Cadastre para escolher na compra parcelada ou recorrente.</div>') + '</div>' + det;
  }
  // ── Saldo a pagar / a receber (depois dos cartões): faturas que vencem no mês + contas fora do cartão ──
  function abaSaldo(d) {
    const mesIni = mesInicio(d), mesMax = somaMes(fechMes(), LIMITE_MESES); let m = (ST.mesSaldo && ST.mesSaldo >= mesIni) ? ST.mesSaldo : mesIni; if (m > mesMax) m = mesMax; ST.mesSaldo = m;
    const fats = faturasQueVencemNoMes(d, m), totFat = fats.reduce((a, f) => a + f.aberto, 0), sp = saldoMes(d, 'pagar', m, { semCartao: true }), sr = saldoMes(d, 'receber', m);
    const blocoContas = (tipo, tit, s) => {
      const pag = tipo === 'pagar';
      const abertas = s.abertas.sort((a, b) => a.p.venc.localeCompare(b.p.venc)).map(x => '<tr>' + td(br(x.p.venc)) + td(E(x.item[pag ? 'fornecedor' : 'cliente']) + (x.item.rec ? ' <span title="recorrente">↻</span>' : '')) + td(x.item.rec ? 'mensal' : (x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista')) + td(x.p.venc < m + '-01' ? '<span style="color:#dc2626">acumulada de meses anteriores</span>' : 'do mês') + td(R$(x.p.valor), 1) + '</tr>');
      return '<div style="flex:1 1 440px;min-width:300px"><div style="font-weight:700;margin-bottom:6px">' + tit + '</div>'
        + '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px;line-height:1.7"><div style="display:flex;justify-content:space-between"><span>Saldo anterior</span><b>' + R$(s.anterior) + '</b></div><div style="display:flex;justify-content:space-between"><span>(+) Vencimentos do mês</span><b>' + R$(s.novos) + '</b></div><div style="display:flex;justify-content:space-between"><span>(−) ' + (pag ? 'Pagos' : 'Recebidos') + ' no mês</span><b>' + R$(s.pagos) + '</b></div><div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span><b>Saldo no fim do mês</b></span><b style="font-size:15px;color:' + (pag ? '#dc2626' : 'var(--teal)') + '">' + R$(s.final) + '</b></div><div style="display:flex;justify-content:space-between;color:var(--slate);font-size:12px"><span>A vencer depois deste mês</span><span>' + R$(s.aVencer) + '</span></div></div>'
        + tabela([{ t: 'Vencimento' }, { t: pag ? 'Fornecedor' : 'Cliente' }, { t: 'Parcela' }, { t: 'Situação' }, { t: 'Valor', r: 1 }], abertas, 'Nada em aberto até o fim deste mês.') + '</div>';
    };
    const fatTab = tabela([{ t: 'Cartão' }, { t: 'Fatura' }, { t: 'Vencimento' }, { t: 'Total', r: 1 }, { t: 'Em aberto', r: 1 }], fats.map(f => '<tr>' + td('<span style="display:inline-flex;align-items:center;gap:6px">' + bandeiraSvg(f.cartao.bandeira, 16) + E(f.cartao.nome) + '</span>') + td(rotMes(f.fatura)) + td(br(f.venc)) + td(R$(f.total), 1) + td('<b style="color:' + (f.aberto > 0.004 ? '#dc2626' : 'var(--teal)') + '">' + R$(f.aberto) + '</b>', 1) + '</tr>'), 'Nenhuma fatura vence neste mês.');
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><div style="display:flex;align-items:center;gap:6px">' + (m > mesIni ? B('‹', 'kcbmPf.mesSaldo(-1)') : '<button class="btn bo bsm" disabled style="opacity:.35">‹</button>') + '<b style="min-width:150px;text-align:center">' + rotMes(m) + '</b>' + (m < mesMax ? B('›', 'kcbmPf.mesSaldo(1)') : '<button class="btn bo bsm" disabled style="opacity:.35">›</button>') + '</div><div style="margin-left:auto">' + B('⚙ Saldos iniciais', 'kcbmPf.saldoIniForm()') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:10px">Projeção mês a mês por até 5 anos, a partir do Fechamento Atual. Inclui as recorrências. O que não foi baixado no extrato continua acumulando nos meses seguintes. Começa em ' + rotMes(mesIni) + '.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + [['💳 Faturas que vencem no mês', totFat, '#dc2626'], ['🧾 Contas a pagar (saldo no fim do mês)', sp.final, '#dc2626'], ['💰 Contas a receber (saldo no fim do mês)', sr.final, 'var(--teal)']].map(x => '<div style="flex:1 1 220px;border:1px solid var(--border);border-radius:10px;padding:10px 14px"><div style="font-size:11.5px;color:var(--slate)">' + x[0] + '</div><div style="font-size:1.15rem;font-weight:700;color:' + x[2] + '">' + R$(x[1]) + '</div></div>').join('') + '</div>'
      + '<div style="font-weight:700;margin-bottom:6px">💳 Cartões de crédito — faturas que vencem neste mês</div>' + fatTab
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-top:16px">' + blocoContas('pagar', '🧾 Contas a pagar (fora do cartão)', sp) + blocoContas('receber', '💰 Contas a receber', sr) + '</div>';
  }

  // ───────────── ações ─────────────
  const K = {
    tela(t) { ST.tela = t; ST.pf = null; render(); },
    exportar() { // backup de tudo do módulo (lista, cadastros universais e os dados de cada pessoa)
      const dados = {}; ['kcbm_pf_lista', 'kcbm_pf_tipos', 'kcbm_pf_terceiros', 'kcbm_pf_bandeiras'].forEach(k => { const v = lerChave(k, null); if (v != null) dados[k] = v; });
      lerLista().forEach(p => { const v = lerChave('kcbm_pf_' + p.id, null); if (v != null) dados['kcbm_pf_' + p.id] = v; });
      const blob = new Blob([JSON.stringify({ app: 'kcbm-pf', em: new Date().toISOString(), dados }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pessoa-fisica-backup-' + hoje() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      root.toast('Arquivo baixado (' + Object.keys(dados).length + ' itens).', 'ok');
    },
    novaPessoa() { modal('Nova pessoa física', formPessoa(null), m => { const f = lerFormPessoa(m); if (!f) return false; const l = lerLista(); const p = { id: uid(), criado: Date.now(), ...f }; l.push(p); gravarLista(l); gravarDados(p.id, novoDados()); K.abrir(p.id); root.toast('Pessoa cadastrada.', 'ok'); }); },
    editarPessoa(id) { const p = lerLista().find(x => x.id === id); if (!p) return; modal('Editar pessoa física', formPessoa(p), m => { const f = lerFormPessoa(m); if (!f) return false; gravarLista(lerLista().map(x => x.id === id ? Object.assign({}, x, f) : x)); render(); }); },
    excluirPessoa(id) { const p = lerLista().find(x => x.id === id); if (!p) return; if (!confirm('Excluir "' + p.nome + '" e TODOS os dados dela (contas, extrato, cartões)?\n\nNão dá para desfazer.')) return; if (prompt('Para confirmar, digite o nome da pessoa:') !== p.nome) { root.toast('Nome não confere — nada foi excluído.', 'err'); return; } gravarLista(lerLista().filter(x => x.id !== id)); render(); },
    abrir(id) { ST.pf = id; ST.tela = 'lista'; ST.aba = 'pagar'; ST.mesSaldo = null; ST.cartaoSel = null; ST.mesFatura = null; render(); },
    voltar() { ST.pf = null; ST.tela = 'lista'; render(); },
    aba(a) { ST.aba = a; ST.mesFatura = null; render(); },
    mesLista(n) { ST.mesLista = somaMes(ST.mesLista, n); render(); },
    mesSaldo(n) { ST.mesSaldo = somaMes(ST.mesSaldo || mesInicio(dadosAtual()), n); render(); },
    cartaoSel(id) { ST.cartaoSel = ST.cartaoSel === id ? null : id; ST.mesFatura = null; render(); },
    faturaSel(f) { ST.mesFatura = ST.mesFatura === f ? null : f; render(); },
    // ── tipos e terceiros (universais) ──
    tipoForm(id) {
      const t = id ? lerTipos().find(x => x.id === id) : null;
      modal(t ? 'Editar tipo' : 'Novo tipo de gasto / receita', campo('Nome', inp('kpfNomeT', t ? t.nome : '', 'text', 'maxlength="60"')) + campo('É um tipo de…', sel('kpfNatT', [['gasto', 'Gasto'], ['receita', 'Receita']], t ? t.natureza : 'gasto')), m => {
        const nome = (val(m, 'kpfNomeT') || '').trim(), nat = val(m, 'kpfNatT'); if (!nome) { root.toast('Informe o nome.', 'err'); return false; }
        const l = lerTipos(); if (l.some(x => x.id !== (t && t.id) && x.natureza === nat && norm(x.nome) === norm(nome))) { root.toast('Já existe esse tipo.', 'err'); return false; }
        if (t) { const x = l.find(y => y.id === t.id); if (x.nome !== nome) { lerLista().forEach(p => { const d = lerDados(p.id); let mu = false; ['pagar', 'receber'].forEach(k => d[k].forEach(it => { if (it.tipo === x.nome) { it.tipo = nome; mu = true; } })); ['entradas', 'gastos'].forEach(k => d[k].forEach(it => { if (it.categoria === x.nome) { it.categoria = nome; mu = true; } })); if (mu) gravarDados(p.id, d); }); } x.nome = nome; x.natureza = nat; } else l.push({ id: uid(), nome, natureza: nat });
        gravarChave('kcbm_pf_tipos', l); render();
      });
    },
    tipoExcluir(id) { const t = lerTipos().find(x => x.id === id); if (!t) return; if (!confirm('Excluir o tipo "' + t.nome + '"? Os lançamentos que já usam esse nome continuam com o texto.')) return; gravarChave('kcbm_pf_tipos', lerTipos().filter(x => x.id !== id)); render(); },
    tercForm(id) {
      const t = id ? lerTerceiros().find(x => x.id === id) : null;
      modal(t ? 'Editar cadastro' : 'Novo fornecedor / cliente', campo('Nome', inp('kpfNomeF', t ? t.nome : '', 'text', 'maxlength="120"')) + campo('Tipo', sel('kpfTipoF', [['fornecedor', 'Fornecedor'], ['cliente', 'Cliente'], ['ambos', 'Fornecedor e cliente']], t ? t.tipo : 'fornecedor')) + campo('CPF/CNPJ (opcional)', inp('kpfDocF', t ? t.doc : '', 'text', 'maxlength="20"')), m => {
        const nome = (val(m, 'kpfNomeF') || '').trim(); if (!nome) { root.toast('Informe o nome.', 'err'); return false; }
        const l = lerTerceiros(); if (l.some(x => x.id !== (t && t.id) && norm(x.nome) === norm(nome))) { root.toast('Já existe alguém com esse nome.', 'err'); return false; }
        const novo = { id: t ? t.id : uid(), nome, tipo: val(m, 'kpfTipoF'), doc: (val(m, 'kpfDocF') || '').trim() }; gravarChave('kcbm_pf_terceiros', t ? l.map(x => x.id === t.id ? novo : x) : l.concat([novo])); render();
      });
    },
    tercExcluir(id) { const t = lerTerceiros().find(x => x.id === id); if (!t) return; if (!confirm('Excluir "' + t.nome + '" do cadastro? Os lançamentos que já usam esse nome continuam com o texto.')) return; gravarChave('kcbm_pf_terceiros', lerTerceiros().filter(x => x.id !== id)); render(); },
    // ── saldos iniciais ──
    saldoIniForm() {
      const d = dadosAtual(); modal('Saldos iniciais', campo('Mês inicial', inp('kpfMesIni', mesInicio(d), 'month'), 'O saldo e o calendário começam neste mês. Sem definir, vale o Fechamento Atual (' + rotMes(fechMes()) + ').') + campo('Saldo inicial de contas a pagar (R$)', inp('kpfSIP', String(d.saldoIni.pagar || 0).replace('.', ','), 'text', 'inputmode="decimal"')) + campo('Saldo inicial de contas a receber (R$)', inp('kpfSIR', String(d.saldoIni.receber || 0).replace('.', ','), 'text', 'inputmode="decimal"')),
        m => { const mes = val(m, 'kpfMesIni'); if (!/^\d{4}-\d{2}$/.test(mes)) { root.toast('Escolha o mês inicial.', 'err'); return false; } const dd = dadosAtual(); dd.saldoIni = { mes, pagar: num(val(m, 'kpfSIP')), receber: num(val(m, 'kpfSIR')), definido: true }; gravarDados(ST.pf, dd); ST.mesSaldo = mes; render(); root.toast('Saldos iniciais salvos.', 'ok'); });
    },
    // ── entradas / gastos ──
    movForm(tipo, id) {
      const d = dadosAtual(), x = id ? d[tipo].find(y => y.id === id) : null, ent = tipo === 'entradas';
      modal((x ? 'Editar ' : 'Nova ') + (ent ? 'entrada' : 'gasto'), campo('Data', inp('kpfData', x ? x.data : hoje(), 'date')) + campo('Descrição', inp('kpfDesc', x ? x.descricao : '', 'text', 'maxlength="120"')) + campo(ent ? 'Tipo de receita' : 'Tipo de gasto', selTipo('kpfCat', ent ? 'receita' : 'gasto', x ? x.categoria : '')) + campo('Banco / conta', inp('kpfBanco', x ? x.banco : '', 'text', 'maxlength="60"')) + campo('Valor (R$)', inp('kpfValor', x ? String(x.valor).replace('.', ',') : '', 'text', 'inputmode="decimal"')),
        m => { const v = num(val(m, 'kpfValor')); if (!val(m, 'kpfData') || !(v > 0)) { root.toast('Informe a data e um valor maior que zero.', 'err'); return false; } const dd = dadosAtual(); const novo = { id: x ? x.id : uid(), data: val(m, 'kpfData'), descricao: (val(m, 'kpfDesc') || '').trim(), categoria: (val(m, 'kpfCat') || '').trim(), banco: (val(m, 'kpfBanco') || '').trim(), valor: v, extratoId: x ? x.extratoId : undefined }; dd[tipo] = x ? dd[tipo].map(y => y.id === x.id ? novo : y) : dd[tipo].concat([novo]); gravarDados(ST.pf, dd); ST.mesLista = novo.data.slice(0, 7); render(); });
    },
    movExcluir(tipo, id) { if (!confirm('Excluir este lançamento?')) return; const dd = dadosAtual(); const x = dd[tipo].find(y => y.id === id); dd[tipo] = dd[tipo].filter(y => y.id !== id); if (x && x.extratoId) dd.extrato = dd.extrato.map(l => l.id === x.extratoId ? Object.assign({}, l, { classe: null }) : l); gravarDados(ST.pf, dd); render(); },
    // ── extrato ──
    extratoForm() {
      modal('Lançar no extrato bancário', campo('Data', inp('kpfData', hoje(), 'date')) + campo('Banco / conta', inp('kpfBanco', '', 'text', 'maxlength="60" placeholder="Ex.: Caixa, Bradesco, Nubank..."')) + campo('Histórico', inp('kpfHist', '', 'text', 'maxlength="140"')) + campo('Tipo', sel('kpfTipo', [['sai', 'Saída (pagamento)'], ['ent', 'Entrada (recebimento)']], 'sai')) + campo('Valor (R$)', inp('kpfValor', '', 'text', 'inputmode="decimal"')),
        m => { const v = num(val(m, 'kpfValor')); if (!val(m, 'kpfData') || !(v > 0)) { root.toast('Informe a data e um valor maior que zero.', 'err'); return false; } const dd = dadosAtual(); dd.extrato.push({ id: uid(), criado: Date.now(), data: val(m, 'kpfData'), banco: (val(m, 'kpfBanco') || '').trim(), hist: (val(m, 'kpfHist') || '').trim(), valor: val(m, 'kpfTipo') === 'sai' ? -v : v, baixa: null, classe: null }); gravarDados(ST.pf, dd); ST.mesLista = val(m, 'kpfData').slice(0, 7); render(); });
    },
    async importarPdf() {
      const inpf = document.createElement('input'); inpf.type = 'file'; inpf.accept = 'application/pdf,.pdf';
      inpf.onchange = async () => {
        const f = inpf.files && inpf.files[0]; if (!f) return;
        if (typeof pdfjsLib === 'undefined' || typeof _lancctbParsearExtratoGenerico !== 'function') { root.toast('Leitor de PDF indisponível nesta página — recarregue (Ctrl+F5).', 'err'); return; }
        root.toast('Lendo o extrato…', 'info');
        let r = null; try { const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise; r = await _lancctbParsearExtratoGenerico(pdf); } catch (e) { console.warn('PF: leitura do PDF', e); }
        if (!r || !r.lancamentos || !r.lancamentos.length) { modal('Não consegui ler este extrato', '<div style="font-size:13px;line-height:1.6">O leitor só aceita o extrato quando o <b>saldo confere</b> linha a linha — e neste PDF não conferiu (ou o formato ainda não é reconhecido).<br><br>Nada foi importado. <b>Me envie o modelo desse banco (Caixa, Bradesco…)</b> que eu ajusto o leitor. Enquanto isso dá para lançar à mão.</div>', null); return; }
        const dd = dadosAtual(), ja = new Set(dd.extrato.map(l => l.data + '|' + cents(l.valor) + '|' + norm(l.hist)));
        const novas = r.lancamentos.map(x => ({ data: x.data, hist: String(x.historico || '').trim(), valor: x.valor_entrada > 0 ? x.valor_entrada : -(x.valor_saida || 0) })).filter(x => x.valor);
        const repetidas = novas.filter(x => ja.has(x.data + '|' + cents(x.valor) + '|' + norm(x.hist))).length;
        const bancos = ['Caixa Econômica', 'Bradesco', 'Itaú', 'Banco do Brasil', 'Santander', 'Nubank', 'Inter', 'C6 Bank', 'Outro'];
        const ent = novas.filter(x => x.valor > 0).reduce((a, x) => a + cents(x.valor), 0) / 100, sai = novas.filter(x => x.valor < 0).reduce((a, x) => a + cents(x.valor), 0) / 100;
        const corpo = '<div style="font-size:12.5px;margin-bottom:8px"><b>' + novas.length + '</b> lançamento(s) lidos · Entradas <b style="color:var(--teal)">' + R$(ent) + '</b> · Saídas <b style="color:#dc2626">' + R$(sai) + '</b>' + (r.observacao ? '<br><span style="color:var(--teal)">' + E(r.observacao) + '</span>' : '') + (repetidas ? '<br><span style="color:#b45309">' + repetidas + ' já existem neste extrato (mesma data, valor e histórico) e não serão repetidos.</span>' : '') + '</div>'
          + campo('Banco deste extrato', sel('kpfBancoI', bancos.map(b => [b, b]), 'Caixa Econômica')) + campo('Se for “Outro”, digite o nome', inp('kpfBancoO', '', 'text', 'maxlength="60"'))
          + '<div style="max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:8px">' + tabela([{ t: 'Data' }, { t: 'Histórico' }, { t: 'Valor', r: 1 }], novas.slice(0, 300).map(x => '<tr>' + td(br(x.data)) + td(E(x.hist)) + '<td style="' + TD + ';text-align:right;color:' + cor(x.valor) + '">' + R$(x.valor) + '</td></tr>'), '') + '</div>' + (novas.length > 300 ? '<div style="font-size:11px;color:var(--slate)">Mostrando as 300 primeiras; todas serão importadas.</div>' : '');
        modal('Importar extrato — conferir', corpo, m => {
          let banco = val(m, 'kpfBancoI'); if (banco === 'Outro') banco = (val(m, 'kpfBancoO') || '').trim() || 'Outro';
          const d2 = dadosAtual(), ja2 = new Set(d2.extrato.map(l => l.data + '|' + cents(l.valor) + '|' + norm(l.hist))); let n = 0;
          novas.forEach(x => { const k = x.data + '|' + cents(x.valor) + '|' + norm(x.hist); if (ja2.has(k)) return; ja2.add(k); d2.extrato.push({ id: uid(), criado: Date.now() + n, data: x.data, banco, hist: x.hist, valor: x.valor, baixa: null, classe: null }); n++; });
          gravarDados(ST.pf, d2); if (novas.length) ST.mesLista = novas[0].data.slice(0, 7); render(); root.toast(n + ' lançamento(s) importado(s). Agora é só classificar.', 'ok');
        }, 'Importar', 720);
      };
      inpf.click();
    },
    extratoLote() {
      const ids = [...document.querySelectorAll('.kpfSelL:checked')].map(c => c.dataset.id); if (!ids.length) { root.toast('Marque as linhas pendentes que quer classificar.', 'err'); return; }
      const d = dadosAtual(), ls = d.extrato.filter(l => ids.indexOf(l.id) >= 0), temSai = ls.some(l => l.valor < 0), temEnt = ls.some(l => l.valor > 0);
      modal('Classificar ' + ls.length + ' linha(s)', '<div style="font-size:12.5px;margin-bottom:8px">Cada linha vira um gasto ou uma entrada, com o tipo escolhido, e forma o lançamento contábil.</div>' + (temSai ? campo('Saídas → tipo de gasto', selTipo('kpfTG', 'gasto', '')) : '') + (temEnt ? campo('Entradas → tipo de receita', selTipo('kpfTR', 'receita', '')) : ''), m => {
        const tg = (val(m, 'kpfTG') || '').trim(), tr = (val(m, 'kpfTR') || '').trim(); if ((temSai && !tg) || (temEnt && !tr)) { root.toast('Escolha o tipo.', 'err'); return false; }
        const d2 = dadosAtual(); let n = 0;
        ls.forEach(l0 => { const l = d2.extrato.find(x => x.id === l0.id); if (!l || l.baixa || l.classe) return; const cat = l.valor < 0 ? tg : tr; l.classe = { categoria: cat }; d2[l.valor < 0 ? 'gastos' : 'entradas'].push({ id: uid(), data: l.data, descricao: l.hist, categoria: cat, banco: l.banco, valor: Math.abs(l.valor), extratoId: l.id }); n++; });
        gravarDados(ST.pf, d2); render(); root.toast(n + ' linha(s) classificada(s).', 'ok');
      }, 'Classificar');
    },
    extratoExcluir(id) { if (!confirm('Excluir esta linha do extrato? (A baixa feita nela é desfeita.)')) return; K.extratoDesfazer(id, true); const dd = dadosAtual(); dd.extrato = dd.extrato.filter(l => l.id !== id); gravarDados(ST.pf, dd); render(); },
    extratoDesfazer(id, silencioso) {
      const dd = dadosAtual(), l = dd.extrato.find(x => x.id === id); if (!l) return;
      (l.baixa || []).forEach(b => { const it = (dd[b.tipo] || []).find(x => x.id === b.itemId); if (it) (it.parcelas || []).forEach(p => { if (p.n === b.n && p.extratoId === id) { p.pago = false; p.dataPago = null; delete p.extratoId; } }); });
      if (l.classe) { const lista = l.valor < 0 ? 'gastos' : 'entradas'; dd[lista] = dd[lista].filter(x => x.extratoId !== id); }
      l.baixa = null; l.classe = null; gravarDados(ST.pf, dd); if (!silencioso) render();
    },
    extratoBaixar(id) {
      const dd = dadosAtual(), l = dd.extrato.find(x => x.id === id); if (!l) return;
      const sai = l.valor < 0, tipo = sai ? 'pagar' : 'receber', abs = Math.abs(l.valor);
      const pend = []; (dd[tipo] || []).forEach(it => (it.parcelas || []).forEach(p => { if (!p.pago) pend.push({ it, p }); })); pend.sort((a, b) => a.p.venc.localeCompare(b.p.venc));
      const linhas = pend.slice(0, 300).map((x, i) => '<label style="display:flex;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid var(--border);font-size:12.5px;cursor:pointer"><input type="checkbox" class="kpfSelP" data-i="' + i + '" data-v="' + cents(x.p.valor) + '"> <span style="flex:1">' + br(x.p.venc) + ' · ' + E(x.it[sai ? 'fornecedor' : 'cliente']) + ' · ' + (x.it.rec ? 'mensal' : (x.it.parcelado ? x.p.n + '/' + x.it.n : 'à vista')) + (x.it.forma === 'cartao' ? ' · 💳 fatura ' + x.p.fatura : '') + '</span><b>' + R$(x.p.valor) + '</b></label>').join('');
      const corpo = '<div style="font-size:12.5px;margin-bottom:8px"><b>' + br(l.data) + '</b> · ' + E(l.hist) + ' · <b style="color:' + cor(l.valor) + '">' + R$(l.valor) + '</b></div>'
        + '<div style="font-weight:600;font-size:12.5px;margin-bottom:4px">' + (sai ? 'Dar baixa em contas a pagar' : 'Dar baixa em contas a receber') + ' <span id="kpfSoma" style="font-weight:400;color:var(--slate)"></span></div><div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px">' + (linhas || '<div style="padding:14px;color:var(--slate);font-size:12.5px">Nada em aberto.</div>') + '</div>'
        + '<div style="margin:12px 0 4px;font-weight:600;font-size:12.5px">…ou classificar direto como ' + (sai ? 'gasto' : 'entrada') + '</div>' + campo(sai ? 'Tipo de gasto' : 'Tipo de receita', selTipo('kpfCatC', sai ? 'gasto' : 'receita', ''), 'Escolha só se NÃO for dar baixa em uma conta acima.');
      const m = modal('Baixar / classificar — extrato', corpo, mm => {
        const sel2 = [...mm.querySelectorAll('.kpfSelP:checked')].map(c => pend[+c.dataset.i]), cat = (val(mm, 'kpfCatC') || '').trim();
        const d2 = dadosAtual(), l2 = d2.extrato.find(x => x.id === id);
        if (sel2.length) {
          const soma = sel2.reduce((a, x) => a + cents(x.p.valor), 0);
          if (soma !== cents(abs) && !confirm('A soma marcada (' + R$(soma / 100) + ') é diferente do valor do extrato (' + R$(abs) + '). Dar baixa mesmo assim?')) return false;
          l2.baixa = []; sel2.forEach(x => { const it = d2[tipo].find(y => y.id === x.it.id); const p = it.parcelas.find(q => q.n === x.p.n); p.pago = true; p.dataPago = l2.data; p.extratoId = id; l2.baixa.push({ tipo, itemId: it.id, n: p.n }); });
        } else if (cat) { l2.classe = { categoria: cat }; d2[sai ? 'gastos' : 'entradas'].push({ id: uid(), data: l2.data, descricao: l2.hist, categoria: cat, banco: l2.banco, valor: abs, extratoId: id }); }
        else { root.toast('Marque o que está sendo pago/recebido ou escolha o tipo.', 'err'); return false; }
        gravarDados(ST.pf, d2); render(); root.toast('Lançamento contábil gerado.', 'ok');
      }, 'Gerar lançamento');
      const atual = () => { const s = [...m.querySelectorAll('.kpfSelP:checked')].reduce((a, c) => a + (+c.dataset.v), 0); m.querySelector('#kpfSoma').textContent = s ? '— marcado ' + R$(s / 100) + ' de ' + R$(abs) : ''; };
      m.querySelectorAll('.kpfSelP').forEach(c => c.onchange = atual);
    },
    // ── contas a pagar / receber ──
    tituloForm(tipo) {
      const d = dadosAtual(), pag = tipo === 'pagar';
      const corpo = campo('Data', inp('kpfData', hoje(), 'date')) + campo(pag ? 'Fornecedor' : 'Cliente', inp('kpfQuem', '', 'text', 'maxlength="100" list="kpfDL" autocomplete="off"') + datalistTerc('kpfDL', pag ? 'fornecedor' : 'cliente'), 'Comece a digitar para puxar do cadastro; se for novo, ele entra no cadastro sozinho.') + campo(pag ? 'Tipo de gasto' : 'Tipo de receita', selTipo('kpfTipoG', pag ? 'gasto' : 'receita', '')) + campo('Valor (R$)', inp('kpfValor', '', 'text', 'inputmode="decimal"'))
        + campo('Forma de ' + (pag ? 'pagamento' : 'recebimento'), sel('kpfForma', (pag ? [['avista', 'À vista / boleto'], ['cartao', 'Cartão de crédito'], ['carne', 'Carnê'], ['outro', 'Outro']] : [['avista', 'À vista / boleto'], ['carne', 'Carnê'], ['outro', 'Outro']]), 'avista'))
        + (pag ? '<div id="kpfCartaoBox" style="display:none">' + campo('Cartão', d.cartoes.length ? sel('kpfCartao', d.cartoes.map(c => [c.id, c.nome + (c.bandeira ? ' — ' + c.bandeira : '')]), d.cartoes[0].id) : '<div style="font-size:12px;color:#b45309">Nenhum cartão cadastrado — cadastre na aba Cartões de crédito.</div>') + '</div>' : '')
        + campo('Recorrente (todo mês)?', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfRec"> Sim — repete todo mês, projetado 5 anos à frente</label>')
        + '<div id="kpfRecBox" style="display:none">' + campo('Dia do mês do vencimento' + (pag ? ' (no cartão: dia da cobrança)' : ''), inp('kpfDia', '20', 'number', 'min="1" max="31"'), 'No mês em que o dia não existir (ex.: 31 em fevereiro) vale o último dia.') + '</div>'
        + '<div id="kpfNaoRecBox">' + campo('Foi parcelado?', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfParc"> Sim</label>') + '<div id="kpfParcBox" style="display:none">' + campo('Em quantas vezes?', inp('kpfN', '2', 'number', 'min="2" max="60"')) + '</div><div id="kpfVencBox">' + campo('1º vencimento', inp('kpfVenc1', '', 'date'), 'Se deixar vazio, usa 30 dias depois da data. As demais parcelas vencem de mês em mês.') + '</div></div>';
      const m = modal(pag ? 'Registrar compra / conta a pagar' : 'Registrar receita a receber', corpo, mm => {
        const v = num(val(mm, 'kpfValor')), quem = (val(mm, 'kpfQuem') || '').trim(), data = val(mm, 'kpfData'), rec = chk(mm, 'kpfRec'), parc = !rec && chk(mm, 'kpfParc'), n = parc ? Math.floor(num(val(mm, 'kpfN'))) : 1, forma = val(mm, 'kpfForma');
        if (!data || !quem || !(v > 0)) { root.toast('Informe a data, ' + (pag ? 'o fornecedor' : 'o cliente') + ' e o valor.', 'err'); return false; }
        if (parc && !(n >= 2)) { root.toast('Informe em quantas vezes (2 ou mais).', 'err'); return false; }
        const dia = Math.floor(num(val(mm, 'kpfDia'))); if (rec && !(dia >= 1 && dia <= 31)) { root.toast('Informe o dia do mês (1 a 31).', 'err'); return false; }
        const dd = dadosAtual(), cartaoId = (pag && forma === 'cartao') ? val(mm, 'kpfCartao') : null, cartao = cartaoId ? dd.cartoes.find(c => c.id === cartaoId) : null;
        if (pag && forma === 'cartao' && !cartao) { root.toast('Escolha o cartão de crédito.', 'err'); return false; }
        const it = { id: uid(), data, [pag ? 'fornecedor' : 'cliente']: quem, tipo: (val(mm, 'kpfTipoG') || '').trim(), valor: v, parcelado: parc, n, forma, cartaoId, venc1: rec ? '' : (val(mm, 'kpfVenc1') || '') };
        if (rec) { it.rec = true; it.diaVenc = dia; const m0 = data.slice(0, 7); it.inicio = (cartao ? true : +data.slice(8, 10) <= dia) ? m0 : somaMes(m0, 1); it.parcelas = []; estenderRecorrencia(it, cartao, somaMes(fechMes(), LIMITE_MESES)); } else it.parcelas = gerarParcelas(it, cartao);
        dd[tipo].push(it); registrarTerceiro(quem, pag ? 'fornecedor' : 'cliente'); gravarDados(ST.pf, dd); render(); root.toast(rec ? 'Recorrência criada: ' + it.parcelas.length + ' mês(es) projetado(s).' : 'Registrado: ' + it.parcelas.length + ' parcela(s) gerada(s).', 'ok');
      }, 'Salvar', 620);
      const atualizar = () => { const rec = chk(m, 'kpfRec'); m.querySelector('#kpfRecBox').style.display = rec ? '' : 'none'; m.querySelector('#kpfNaoRecBox').style.display = rec ? 'none' : ''; m.querySelector('#kpfParcBox').style.display = chk(m, 'kpfParc') ? '' : 'none'; const cart = pag && val(m, 'kpfForma') === 'cartao'; const cb = m.querySelector('#kpfCartaoBox'); if (cb) cb.style.display = cart ? '' : 'none'; m.querySelector('#kpfVencBox').style.display = cart ? 'none' : ''; };
      ['kpfRec', 'kpfParc', 'kpfForma'].forEach(i => { m.querySelector('#' + i).onchange = atualizar; }); atualizar();
    },
    tituloVer(tipo, id) {
      const d = dadosAtual(), it = d[tipo].find(x => x.id === id); if (!it) return; const pag = tipo === 'pagar';
      const linhas = (it.parcelas || []).map(p => '<tr>' + td(it.rec ? rotMes(p.mes) : p.n + '/' + (it.parcelado ? it.n : 1)) + td(br(p.venc) + (p.fatura ? ' <span style="color:var(--slate);font-size:11px">(fatura ' + p.fatura + ')</span>' : '')) + td(R$(p.valor), 1) + td(p.pago ? '<span style="color:var(--teal)">' + (pag ? 'paga' : 'recebida') + ' em ' + br(p.dataPago) + '</span>' : 'em aberto') + '<td style="' + TD + ';text-align:right">' + (p.pago ? '' : B('✏️ valor', "kcbmPf.parcelaValor('" + tipo + "','" + it.id + "'," + p.n + ")")) + '</td></tr>').join('');
      modal((pag ? 'Conta — ' : 'Receita — ') + E(it[pag ? 'fornecedor' : 'cliente']), '<div style="font-size:12.5px;margin-bottom:8px">' + br(it.data) + ' · ' + R$(it.valor) + (it.rec ? ' por mês' : '') + ' · ' + E(it.tipo || '') + (it.rec ? ' · <b>recorrente</b> (' + (it.parcelas || []).length + ' mês(es) projetado(s))' : '') + '</div>' + (it.rec ? '<div style="margin-bottom:8px">' + B('⏹ Encerrar recorrência…', "kcbmPf.recEncerrar('" + tipo + "','" + it.id + "')") + '</div>' : '') + '<div style="max-height:360px;overflow:auto">' + tabela([{ t: it.rec ? 'Mês' : 'Parcela' }, { t: 'Vencimento' }, { t: 'Valor', r: 1 }, { t: 'Situação' }, { t: '' }], [linhas], '') + '</div><div style="font-size:11.5px;color:var(--slate);margin-top:8px">A baixa é feita na aba Extrato bancário (Baixar / classificar).</div>', null, null, 700);
    },
    parcelaValor(tipo, itemId, n) {
      const d = dadosAtual(), it = d[tipo].find(x => x.id === itemId); if (!it) return; const p = it.parcelas.find(q => q.n === n); if (!p) return;
      modal('Alterar valor — ' + (it.rec ? rotMes(p.mes) : 'parcela ' + n), campo('Novo valor (R$)', inp('kpfNovoV', String(p.valor).replace('.', ','), 'text', 'inputmode="decimal"')) + (it.rec || it.parcelas.length > 1 ? campo('Vale para…', sel('kpfEsc', [['frente', 'Este e os próximos (ainda em aberto)'], ['um', 'Só este']], it.rec ? 'frente' : 'um')) : ''), m => {
        const v = num(val(m, 'kpfNovoV')); if (!(v > 0)) { root.toast('Informe um valor maior que zero.', 'err'); return false; }
        const dd = dadosAtual(), it2 = dd[tipo].find(x => x.id === itemId); const k = alterarValorParcela(it2, n, v, val(m, 'kpfEsc') === 'frente'); gravarDados(ST.pf, dd); render(); root.toast(k + ' parcela(s) alterada(s).', 'ok'); K.tituloVer(tipo, itemId);
      });
    },
    recEncerrar(tipo, itemId) {
      const d = dadosAtual(), it = d[tipo].find(x => x.id === itemId); if (!it) return;
      modal('Encerrar recorrência', campo('Parar a partir de qual mês?', inp('kpfFimM', fechMes(), 'month'), 'As ocorrências em aberto desse mês em diante são retiradas. As já pagas/recebidas ficam.'), m => {
        const mes = val(m, 'kpfFimM'); if (!/^\d{4}-\d{2}$/.test(mes)) { root.toast('Escolha o mês.', 'err'); return false; }
        if (!confirm('Encerrar a recorrência a partir de ' + rotMes(mes) + '?')) return false;
        const dd = dadosAtual(), it2 = dd[tipo].find(x => x.id === itemId); const k = encerrarRecorrencia(it2, mes); gravarDados(ST.pf, dd); render(); root.toast('Recorrência encerrada (' + k + ' ocorrência(s) retirada(s)).', 'ok');
      });
    },
    tituloExcluir(tipo, id) { const dd = dadosAtual(), it = dd[tipo].find(x => x.id === id); if (!it) return; if ((it.parcelas || []).some(p => p.pago) && !confirm('Há parcelas já baixadas no extrato. Excluir mesmo assim? (A baixa ficará sem a conta.)')) return; if (!confirm('Excluir este registro e todas as suas parcelas' + (it.rec ? ' (e a recorrência)' : '') + '?')) return; dd[tipo] = dd[tipo].filter(x => x.id !== id); dd.extrato.forEach(l => { l.baixa = (l.baixa || []).filter(b => b.itemId !== id); if (l.baixa && !l.baixa.length && !l.classe) l.baixa = null; }); gravarDados(ST.pf, dd); render(); },
    // ── cartões ──
    cartaoForm(id) {
      const d = dadosAtual(), c = id ? d.cartoes.find(x => x.id === id) : null, todas = BANDEIRAS.concat(lerBandeirasProprias().filter(b => BANDEIRAS.indexOf(b) < 0)), atualB = c ? c.bandeira : 'Mastercard';
      const m = modal(c ? 'Editar cartão' : 'Novo cartão de crédito', campo('Nome do cartão', inp('kpfNomeC', c ? c.nome : '', 'text', 'maxlength="60" placeholder="Ex.: Nubank, Itaú Platinum"')) + campo('Bandeira', sel('kpfBand', todas.map(b => [b, b]).concat([['__outra', '➕ Outra bandeira (criar)…']]), todas.indexOf(atualB) >= 0 ? atualB : 'Mastercard')) + '<div id="kpfBandBox" style="display:none">' + campo('Nome da nova bandeira', inp('kpfBandN', '', 'text', 'maxlength="40"'), 'Fica salva na lista e aparece nos próximos cartões.') + '</div>' + campo('Cor do cartão', '<input type="hidden" id="kpfCor" value="' + E(c && c.cor || '') + '"><div id="kpfCores" style="display:grid;grid-template-columns:repeat(10,1fr);gap:6px">' + '<button type="button" data-cor="" title="Sem cor (branco)" style="height:26px;border-radius:6px;border:2px solid var(--border);background:var(--white);cursor:pointer;font-size:10px;color:var(--slate)">sem</button>' + CORES_CARTAO.map(x => '<button type="button" data-cor="' + x[1] + '" title="' + x[0] + '" style="height:26px;border-radius:6px;border:2px solid transparent;background:' + x[1] + ';cursor:pointer;color:' + (temaCartao(x[1]).fg) + ';font-size:13px;font-weight:700"></button>').join('') + '</div><div id="kpfCorNome" style="font-size:11px;color:var(--slate);margin-top:4px"></div>', 'Escolha uma das 30 cores. Em cores escuras a letra do cartão fica branca sozinha.') + campo('Limite (R$)', inp('kpfLim', c ? String(c.limite).replace('.', ',') : '', 'text', 'inputmode="decimal"')) + campo('Limite unificado com', sel('kpfLimCom', [['', 'Não — limite só deste cartão']].concat(d.cartoes.filter(x => (!c || x.id !== c.id) && !x.limiteCom).map(x => [x.id, x.nome])), c && c.limiteCom || ''), 'Se este cartão divide o limite com outro, escolha o cartão. O limite passa a valer uma vez só (o valor digitado acima é ignorado). Os vencimentos podem ser diferentes.') + campo('Dia de fechamento da fatura', inp('kpfFech', c ? c.fechamento : '25', 'number', 'min="1" max="31"')) + campo('Dia de vencimento da fatura', inp('kpfVencC', c ? c.vencimento : '5', 'number', 'min="1" max="31"'), 'Compra feita até o dia do fechamento entra na fatura que fecha no mês; depois, na seguinte.'),
        m2 => { const nome = (val(m2, 'kpfNomeC') || '').trim(), f = Math.floor(num(val(m2, 'kpfFech'))), v = Math.floor(num(val(m2, 'kpfVencC'))); let band = val(m2, 'kpfBand'); if (band === '__outra') { band = (val(m2, 'kpfBandN') || '').trim(); if (!band) { root.toast('Digite o nome da nova bandeira.', 'err'); return false; } const bp = lerBandeirasProprias(); if (BANDEIRAS.indexOf(band) < 0 && bp.indexOf(band) < 0) gravarChave('kcbm_pf_bandeiras', bp.concat([band])); }
          if (!nome || !(f >= 1 && f <= 31) || !(v >= 1 && v <= 31)) { root.toast('Informe o nome e os dias de fechamento e vencimento (1 a 31).', 'err'); return false; } const dd = dadosAtual(); const novo = { id: c ? c.id : uid(), nome, bandeira: band, cor: val(m2, 'kpfCor') || '', limite: num(val(m2, 'kpfLim')), limiteCom: val(m2, 'kpfLimCom') || '', fechamento: f, vencimento: v }; dd.cartoes = c ? dd.cartoes.map(x => x.id === c.id ? novo : x) : dd.cartoes.concat([novo]); if (!c) ST.cartaoSel = novo.id; gravarDados(ST.pf, dd); render(); });
      const at = () => { m.querySelector('#kpfBandBox').style.display = val(m, 'kpfBand') === '__outra' ? '' : 'none'; }; m.querySelector('#kpfBand').onchange = at; at();
      const marcarCor = () => { const v = val(m, 'kpfCor') || ''; m.querySelectorAll('#kpfCores button').forEach(b => { const on = (b.dataset.cor || '') === v; b.style.borderColor = on ? '#111827' : (b.dataset.cor ? 'transparent' : 'var(--border)'); b.style.boxShadow = on ? '0 0 0 2px #fff inset' : ''; b.textContent = on && b.dataset.cor ? '✓' : ''; }); const nm = CORES_CARTAO.find(x => x[1] === v); m.querySelector('#kpfCorNome').textContent = nm ? 'Cor escolhida: ' + nm[0] : 'Sem cor (branco)'; };
      m.querySelectorAll('#kpfCores button').forEach(b => { b.onclick = () => { m.querySelector('#kpfCor').value = b.dataset.cor || ''; marcarCor(); }; }); marcarCor();
    },
    faturaBaixa(cartaoId, fatura) {
      let v = prompt('Data do pagamento da fatura (AAAA-MM-DD ou DD/MM/AAAA):', hoje()); if (v == null) return; v = v.trim();
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (m) v = m[3] + '-' + m[2] + '-' + m[1];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { root.toast('Data inválida.', 'err'); return; }
      const dd = dadosAtual(); let n = 0;
      (dd.pagar || []).forEach(it => { if (it.forma !== 'cartao' || it.cartaoId !== cartaoId) return; (it.parcelas || []).forEach(p => { if (p.fatura === fatura && !p.pago) { p.pago = true; p.dataPago = v; p.baixaFatura = true; n++; } }); });
      if (!n) { root.toast('Essa fatura não tem nada em aberto.', 'err'); return; }
      gravarDados(ST.pf, dd); render(); root.toast('Fatura paga em ' + v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) + '.', 'ok');
    },
    faturaDesfazBaixa(cartaoId, fatura) {
      if (!confirm('Desfazer a baixa desta fatura? As parcelas pagas por aqui voltam para "em aberto".')) return;
      const dd = dadosAtual(); let n = 0;
      (dd.pagar || []).forEach(it => { if (it.forma !== 'cartao' || it.cartaoId !== cartaoId) return; (it.parcelas || []).forEach(p => { if (p.fatura === fatura && p.pago && p.baixaFatura) { p.pago = false; p.dataPago = null; delete p.baixaFatura; n++; } }); });
      if (!n) { root.toast('Não há baixa feita por aqui para desfazer (pagamentos vindos do extrato se desfazem no extrato).', 'err'); return; }
      gravarDados(ST.pf, dd); render();
    },
    saldoCartaoEditar(itemId) {
      const d0 = dadosAtual(), it = d0.pagar.find(x => x.id === itemId); if (!it || !it.parcelas || !it.parcelas[0]) return; const p0 = it.parcelas[0], c0 = d0.cartoes.find(x => x.id === it.cartaoId); if (!c0) return;
      modal('Editar saldo inicial — ' + E(c0.nome), campo('Mês do vencimento', inp('kpfFmMes', p0.fatura, 'month'), 'Vence dia ' + c0.vencimento + ' desse mês.') + campo('Saldo inicial (R$)', inp('kpfFmVal', String(p0.valor).replace('.', ','), 'text', 'inputmode="decimal"')), m => {
        const mes = val(m, 'kpfFmMes'), v = num(val(m, 'kpfFmVal')); if (!/^\d{4}-\d{2}$/.test(mes || '') || !(v > 0)) { root.toast('Informe o mês e um valor maior que zero.', 'err'); return false; }
        const dd = dadosAtual(), it2 = dd.pagar.find(x => x.id === itemId); if (!it2) return; const p = it2.parcelas[0]; it2.valor = v; p.valor = v; p.fatura = mes; p.venc = diaNoMes(mes, +c0.vencimento); gravarDados(ST.pf, dd); ST.mesFatura = mes; render(); root.toast('Saldo inicial atualizado.', 'ok');
      }, 'Salvar');
    },
    faturaManual(cartaoId) {
      const c0 = dadosAtual().cartoes.find(x => x.id === cartaoId); if (!c0) return;
      modal('Saldo inicial — ' + E(c0.nome), campo('Mês do vencimento', inp('kpfFmMes', fechMes(), 'month'), 'Vence dia ' + c0.vencimento + ' desse mês.') + campo('Saldo inicial (R$)', inp('kpfFmVal', '', 'text', 'inputmode="decimal" placeholder="0,00"'), 'Entra como um total só, sem detalhar as compras. Se a fatura desse mês já existir, o saldo é somado a ela. Depois você pode editar ou excluir na linha.'), m => {
        const mes = val(m, 'kpfFmMes'), v = num(val(m, 'kpfFmVal'));
        if (!/^\d{4}-\d{2}$/.test(mes || '') || !(v > 0)) { root.toast('Informe o mês e um valor maior que zero.', 'err'); return false; }
        const dd = dadosAtual(), venc = diaNoMes(mes, +c0.vencimento);
        dd.pagar.push({ id: uid(), data: hoje(), fornecedor: 'Saldo inicial', tipo: 'Saldo inicial', valor: v, parcelado: false, n: 1, forma: 'cartao', cartaoId, manual: true, parcelas: [{ n: 1, fatura: mes, venc, valor: v, pago: false, dataPago: null }] });
        gravarDados(ST.pf, dd); ST.mesFatura = mes; render(); root.toast('Saldo inicial de ' + rotMes(mes) + ' registrado.', 'ok');
      }, 'Salvar');
    },
    faturaAjuste(cartaoId, fatura) {
      const d = dadosAtual(), f = faturasDoCartao(d, cartaoId).find(x => x.fatura === fatura); if (!f) return;
      modal('Ajustar fatura — ' + rotMes(fatura), '<div style="font-size:12.5px;margin-bottom:8px">Total lançado hoje: <b>' + R$(f.total) + '</b></div>' + campo('Valor correto da fatura (R$)', inp('kpfFatC', String(f.total).replace('.', ','), 'text', 'inputmode="decimal"'), 'O site lança a diferença (para mais ou para menos) como “Ajuste de fatura”, dentro desta fatura.'), m => {
        const v = num(val(m, 'kpfFatC')); const dd = dadosAtual(), aj = ajusteDeFatura(dd, cartaoId, fatura, v); if (!aj) { root.toast('O valor é igual ao total lançado — nada a ajustar.', 'info'); return false; }
        if (!confirm('Lançar um ajuste de ' + R$(aj.valor) + ' nesta fatura (de ' + R$(f.total) + ' para ' + R$(v) + ')?')) return false; dd.pagar.push(aj); gravarDados(ST.pf, dd); render(); root.toast('Ajuste lançado.', 'ok');
      }, 'Ajustar');
    }
  };
  root.kcbmPf = K;
  function render() { if (!el()) return; if (ST.pf) telaPessoa(); else if (ST.tela === 'tipos') telaTipos(); else if (ST.tela === 'terceiros') telaTerceiros(); else telaLista(); }

  // ───────────── integração com o site (menu, cartão da tela inicial, página) ─────────────
  root.kcbmPfAbrir = function () { root.goPage('kcbm-pf'); };
  function montar() {
    if (document.getElementById('n-kcbm-pf') || !document.getElementById('page-home')) return false;
    const ref = document.getElementById('n-lembretes') || document.querySelector('aside .ni');
    if (ref) { const ni = document.createElement('div'); ni.className = 'ni'; ni.id = 'n-kcbm-pf'; ni.setAttribute('onclick', 'kcbmPfAbrir()'); ni.innerHTML = '<span class="ic"><img src="assets/pessoa-fisica.svg" alt="" style="height:16px;width:16px;vertical-align:middle"></span>Pessoa Física'; ref.parentNode.insertBefore(ni, ref.nextSibling); }
    const pag = document.createElement('div'); pag.className = 'page'; pag.id = 'page-kcbm-pf'; pag.style.display = 'none';
    document.getElementById('page-home').parentNode.appendChild(pag);
    const og = root.goPage;
    root.goPage = function (id) {
      if (id === 'kcbm-pf') {
        og.call(this, 'stub'); const st = document.getElementById('page-stub'); if (st) st.style.display = 'none';
        pag.style.display = 'block'; const g = document.getElementById('gEmpSel'); if (g) g.style.display = 'none';
        document.querySelectorAll('.ni').forEach(n => n.classList.remove('on')); const me = document.getElementById('n-kcbm-pf'); if (me) me.classList.add('on');
        try { currentPage = 'kcbm-pf'; } catch (e) {} render(); return;
      }
      pag.style.display = 'none'; return og.apply(this, arguments);
    };
    try { if (typeof root.renderHomeCards === 'function') root.renderHomeCards(); } catch (e) {}
    return true;
  }
  if (!montar()) { let t = 0; const iv = setInterval(() => { if (montar() || ++t > 60) clearInterval(iv); }, 500); }
})(window);
