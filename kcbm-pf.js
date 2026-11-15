/* KCBM — módulo PESSOA FÍSICA (só existe no KCBM; o JJR Controle não tem nem recebe este arquivo).
   Lista de pessoas físicas; ao abrir uma, as abas: Contas a pagar · Contas a receber · Extrato bancário · Entradas · Gastos · Cartões de crédito · Saldo a pagar/receber.
   Cadastros UNIVERSAIS (valem para todas as pessoas): Tipos de gasto/receita, A quem pago / de quem recebo, Por quem pago, bandeiras de cartão.
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
  const dataMaisDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
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
  const lerPorQuem = () => { const v = lerChave('kcbm_pf_porquem', []); return Array.isArray(v) ? v : []; };
  const seloPorQuem = it => (it && it.porQuem) ? ' <span title="Por quem eu pago" style="display:inline-block;background:#fde047;color:#422006;font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:99px;margin-left:4px;white-space:nowrap">' + E(it.porQuem) + '</span>' : '';
  const datalistPorQuem = id => { const vistos = new Set(), lista = []; lerPorQuem().concat(lerTerceiros()).forEach(t => { const n = String(t.nome || '').trim(), k = norm(n); if (n && !vistos.has(k)) { vistos.add(k); lista.push(n); } }); return '<datalist id="' + id + '">' + lista.sort((a, b) => a.localeCompare(b, 'pt-BR')).map(n => '<option value="' + E(n) + '">').join('') + '</datalist>'; }; // sugere os nomes de "Por quem pago" + os de "A quem pago / de quem recebo"
  function registrarPorQuem(nome) { nome = (nome || '').trim(); if (!nome) return; const l = lerPorQuem(); if (l.some(t => norm(t.nome) === norm(nome))) return; gravarChave('kcbm_pf_porquem', l.concat([{ id: uid(), nome }])); }
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
    if (cartao && cartao.mesmoDia) { const v = diaNoMes(somaMes(dataCompra.slice(0, 7), 1), +dataCompra.slice(8, 10)); return { fatura: v, venc: v }; }   // cartão de loja: vence no mesmo dia, no mês seguinte
    const m = dataCompra.slice(0, 7), dia = +dataCompra.slice(8, 10), fech = +cartao.fechamento || 31, venc = +cartao.vencimento || 10;
    const mesFecha = dia <= fech ? m : somaMes(m, 1);
    const mesVenc = venc > fech ? mesFecha : somaMes(mesFecha, 1);
    return { fatura: mesFecha, venc: diaNoMes(mesVenc, venc) };
  }
  // Opções de vencimento de fatura para o cartão: do mês anterior ao automático até 8 meses depois. Ex.: 10/11/2026 (fatura de novembro).
  function opcoesFatura(cartao, data) {
    if (cartao && cartao.mesmoDia) return [['', 'Automático — vence no mesmo dia da compra, no mês seguinte']];
    if (!cartao || !(cartao.fechamento >= 1 && cartao.vencimento >= 1)) return [['', 'Cartão sem fechamento/vencimento']];
    const f0 = faturaDaCompra(data || hoje(), cartao), m0 = f0.venc.slice(0, 7), out = [['', 'Automático — pela data da compra (vence ' + br(f0.venc) + ')']];
    for (let i = -1; i <= 8; i++) { const mv = somaMes(m0, i), v = diaNoMes(mv, +cartao.vencimento), fm = (+cartao.vencimento > +cartao.fechamento) ? mv : somaMes(mv, -1); out.push([mv, br(v) + ' — fatura de ' + rotMes(fm)]); }
    return out;
  }
  function gerarParcelas(item, cartao) { // compra (única ou parcelada)
    const n = item.parcelado ? Math.max(1, Math.floor(item.n) || 1) : 1, vals = dividir(item.valor, n), out = [];
    if (item.forma === 'cartao' && cartao && cartao.mesmoDia) {
      const base = item.venc1 || faturaDaCompra(item.data, cartao).venc, dia0 = +(item.venc1 || item.data).slice(8, 10);
      for (let i = 0; i < n; i++) { const v = diaNoMes(somaMes(base.slice(0, 7), i), dia0); out.push({ n: i + 1, fatura: v, venc: v, valor: vals[i], pago: false, dataPago: null }); }
    } else if (item.forma === 'cartao' && cartao) {
      let f0 = faturaDaCompra(item.data, cartao);
      if (item.vencFat) { const mv = item.vencFat; f0 = { fatura: (+cartao.vencimento > +cartao.fechamento) ? mv : somaMes(mv, -1), venc: diaNoMes(mv, +cartao.vencimento) }; }
      for (let i = 0; i < n; i++) out.push({ n: i + 1, fatura: somaMes(f0.fatura, i), venc: diaNoMes(somaMes(f0.venc.slice(0, 7), i), +f0.venc.slice(8, 10)), valor: vals[i], pago: false, dataPago: null });
    } else {
      const v0 = item.venc1 || (item.parcelado ? dataMaisDias(item.data, 30) : item.data);
      for (let i = 0; i < n; i++) out.push({ n: i + 1, venc: diaNoMes(somaMes(v0.slice(0, 7), i), +v0.slice(8, 10)), valor: vals[i], pago: false, dataPago: null });
    }
    return out;
  }
  // Recorrência: mensal (padrão), anual ou semanal. Cria as ocorrências do início até `ateMes` (ou até o fim, se encerrada). Só ACRESCENTA o que falta.
  // Semanal projeta no máximo 2 anos à frente (para não criar centenas de linhas).
  const recRot = it => it && it.freq === 'anual' ? 'anual' : it && it.freq === 'semanal' ? 'semanal' : 'mensal';
  function estenderRecorrencia(item, cartao, ateMes) {
    if (!item.rec || !item.inicio) return false;
    item.parcelas = item.parcelas || [];
    const nova = (mes, dia) => { const p = { n: item.parcelas.reduce((a, q) => Math.max(a, q.n || 0), 0) + 1, mes, rec: true, valor: Number(item.valor) || 0, pago: false, dataPago: null };
      if (item.forma === 'cartao' && cartao) { const f = faturaDaCompra(dia, cartao); p.fatura = f.fatura; p.venc = f.venc; } else p.venc = dia; item.parcelas.push(p); };
    let mudou = false;
    if (item.freq === 'semanal') {
      const ateS = ateMes < somaMes(fechMes(), 24) ? ateMes : somaMes(fechMes(), 24), lim = item.fim ? dataMaisDias(item.fim + '-01', -1) : diaNoMes(ateS, 31);
      const ult = item.parcelas.length ? item.parcelas.reduce((a, p) => ((p.dia || p.venc) > a ? (p.dia || p.venc) : a), '0000-00-00') : null;
      let d0 = ult ? dataMaisDias(ult, 7) : (item.inicioData || (item.inicio + '-' + p2(+item.diaVenc || 1)));
      for (; d0 <= lim; d0 = dataMaisDias(d0, 7)) { if ((item.puladas || []).indexOf(d0) >= 0) continue; nova(d0.slice(0, 7), d0); item.parcelas[item.parcelas.length - 1].dia = d0; mudou = true; }
      return mudou;
    }
    const passo = item.freq === 'anual' ? 12 : 1, ultimo = item.parcelas.length ? item.parcelas.reduce((a, p) => p.mes > a ? p.mes : a, '0000-00') : null;
    let m = ultimo ? somaMes(ultimo, passo) : item.inicio;
    const limite = item.fim ? somaMes(item.fim, -1) : ateMes;
    for (; m <= limite && m <= ateMes; m = somaMes(m, passo)) { if ((item.puladas || []).indexOf(m) >= 0) continue; nova(m, diaNoMes(m, +item.diaVenc || 1)); mudou = true; }
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
  // Limite em uso NO MÊS de referência: é o que já foi COMPRADO até o fim desse mês e ainda não foi pago (a compra pesa no limite na data em que acontece, mesmo que a fatura só vença no mês seguinte; compra parcelada pesa inteira; assinatura mensal pesa mês a mês). Quando a fatura é paga, o limite volta (no mês do pagamento). Sem mês = tudo em aberto.
  const limiteUsado = (dados, cartaoId, mes) => {
    if (!mes) return faturasDoCartao(dados, cartaoId).reduce((a, f) => a + f.aberto, 0);
    let t = 0;
    (dados.pagar || []).forEach(it => {
      if (it.forma !== 'cartao' || it.cartaoId !== cartaoId) return;
      (it.parcelas || []).forEach(p => {
        if (p.pago && (!p.dataPago || p.dataPago.slice(0, 7) <= mes)) return; // já pago até o mês: limite devolvido
        const mc = it.manual ? '' : (it.rec ? (p.mes || (p.venc || '').slice(0, 7)) : String(it.data || '').slice(0, 7));
        if (it.manual || mc <= mes) t += cents(p.valor);
      });
    });
    return t / 100;
  };
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
  // ── Taxa de uso / Anuidade automáticas por cartão ──
  // • Taxa de uso (c.taxaUso + c.taxaUsoValor): em toda fatura COM lançamentos, entra "Taxa de Utilização de Cartão de Crédito".
  // • Anuidade (c.anuidade + c.anuidadeValor): em toda fatura SEM lançamentos, entra "Anuidade de Cartão de Crédito" (para lembrar que vai cobrar). Janela: do mês de referência até 12 meses à frente.
  // Os lançamentos automáticos têm taxaAuto = 'uso' | 'anuidade'. Se a fatura passa a ter (ou deixa de ter) uso, o lançamento automático se ajusta sozinho (desde que não esteja baixado).
  const TAXA_NOME = { uso: 'Taxa de Utilização de Cartão de Crédito', anuidade: 'Anuidade de Cartão de Crédito' };
  function sincronizarTaxasCartao(d) {
    let mu = false; d.pagar = d.pagar || [];
    const ativos = (d.cartoes || []).filter(c => ((c.taxaUso && Number(c.taxaUsoValor) > 0) || (c.anuidade && Number(c.anuidadeValor) > 0)) && c.fechamento >= 1 && c.vencimento >= 1);
    const ids = new Set(ativos.map(c => c.id));
    // cartões que deixaram de cobrar: tira os automáticos que ainda não foram baixados
    const n0 = d.pagar.length;
    d.pagar = d.pagar.filter(it => !(it.taxaAuto && (!ids.has(it.cartaoId) || !(((d.cartoes || []).find(c => c.id === it.cartaoId) || {})[it.taxaAuto === 'uso' ? 'taxaUso' : 'anuidade'])) && !(it.parcelas || []).some(p => p.pago)));
    if (d.pagar.length !== n0) mu = true;
    ativos.forEach(c => {
      const usos = {}, ocupadas = {}; // usos: faturas com compras (sem contar o saldo inicial); ocupadas: faturas com qualquer lançamento
      d.pagar.forEach(it => { if (it.cartaoId !== c.id || it.forma !== 'cartao' || it.taxaAuto) return; (it.parcelas || []).forEach(p => { if (!p.fatura) return; ocupadas[p.fatura] = true; if (it.manual) return; const u = usos[p.fatura] = usos[p.fatura] || { venc: p.venc, data: it.data || p.venc }; if ((it.data || '') && it.data < u.data) u.data = it.data; }); });
      const ign = c.taxaIgnorar || [];
      const quer = {}; // fatura -> 'uso' | 'anuidade'
      Object.keys(usos).forEach(f => { if (c.taxaUso && Number(c.taxaUsoValor) > 0) quer[f] = 'uso'; });
      if (c.anuidade && Number(c.anuidadeValor) > 0) for (let k = 0; k <= 12; k++) {
        const vm = somaMes(fechMes(), k), f = (+c.vencimento > +c.fechamento) ? vm : somaMes(vm, -1);
        if (!ocupadas[f]) quer[f] = 'anuidade';
      }
      const mesVenc = f => (+c.vencimento > +c.fechamento) ? f : somaMes(f, 1);
      const existentes = d.pagar.filter(it => it.taxaAuto && it.cartaoId === c.id);
      Object.keys(quer).forEach(f => {
        const tp = quer[f], valor = Number(tp === 'uso' ? c.taxaUsoValor : c.anuidadeValor);
        if (ign.indexOf(tp + '|' + f) >= 0) return;
        const ex = existentes.filter(it => it.taxaAuto === tp && it.parcelas && it.parcelas[0] && it.parcelas[0].fatura === f);
        if (ex.length === 0) {
          const venc = (usos[f] && usos[f].venc) || diaNoMes(mesVenc(f), +c.vencimento), data = (usos[f] && usos[f].data) || venc;
          d.pagar.push({ id: uid(), data, fornecedor: TAXA_NOME[tp], tipo: 'Anuidade de Cartão de Crédito', valor, parcelado: false, n: 1, forma: 'cartao', cartaoId: c.id, venc1: '', taxaAuto: tp, parcelas: [{ n: 1, fatura: f, venc, valor, pago: false, dataPago: null }] }); mu = true;
        } else {
          ex.slice(1).forEach(it => { if (!(it.parcelas || []).some(p => p.pago)) { d.pagar = d.pagar.filter(x => x !== it); mu = true; } });
          const it = ex[0]; if (!it.taxaEditada && !it.parcelas[0].pago && Number(it.parcelas[0].valor) !== valor) { it.valor = valor; it.parcelas[0].valor = valor; mu = true; }
        }
      });
      // tira os automáticos que não valem mais (fatura passou a ter/deixou de ter uso) e ainda não foram baixados
      existentes.forEach(it => { const f = it.parcelas && it.parcelas[0] && it.parcelas[0].fatura; if (quer[f] !== it.taxaAuto && !(it.parcelas || []).some(p => p.pago) && d.pagar.indexOf(it) >= 0) { d.pagar = d.pagar.filter(x => x !== it); mu = true; } });
    });
    return mu;
  }
  // Transferência entre contas: a linha de um banco aponta o outro banco (classe.contraBancoId). Quando existe no outro banco uma linha de mesma data e valor oposto, as duas se amarram sozinhas.
  function parearTransferencias(d) {
    let mu = false; const ex = d.extrato || [];
    const livre = (x, bancoId) => x.bancoId === bancoId && !x.baixa && (!x.classe || (x.classe.tipo === 'transferencia' && !x.classe.parId));
    ex.filter(l => l.classe && l.classe.tipo === 'transferencia' && !l.classe.parId).forEach(l => {
      if (l.classe.parId) return;
      const alvo = cents(-l.valor), nome = ((d.bancos || []).find(b => b.id === l.bancoId) || {}).nome || l.banco || '';
      let c = ex.filter(x => x.id !== l.id && livre(x, l.classe.contraBancoId) && cents(x.valor) === alvo && x.data === l.data && (!x.classe || x.classe.contraBancoId === l.bancoId));
      if (!c.length) c = ex.filter(x => x.id !== l.id && livre(x, l.classe.contraBancoId) && cents(x.valor) === alvo && (!x.classe || x.classe.contraBancoId === l.bancoId) && Math.abs(new Date(x.data + 'T12:00:00') - new Date(l.data + 'T12:00:00')) <= 3 * 86400000);
      if (c.length !== 1) return;
      const m = c[0]; l.classe.parId = m.id;
      m.classe = Object.assign({}, m.classe || { auto: true }, { tipo: 'transferencia', contraBancoId: l.bancoId, contraBanco: nome, categoria: 'Transferência entre contas', parId: l.id }); mu = true;
    });
    return mu;
  }
  // avisos: transferências que saíram/entraram em outro banco e ainda não foram conciliadas neste
  function transfPendentes(d, bancoId) { return (d.extrato || []).filter(l => l.classe && l.classe.tipo === 'transferencia' && !l.classe.parId && l.classe.contraBancoId === bancoId); }
  function lancamentoTexto(l, banco) {
    banco = banco || 'Banco';
    if (l.baixa && l.baixa.length) return l.valor < 0 ? 'D Fornecedores (contas a pagar) · C ' + banco : 'D ' + banco + ' · C Clientes (contas a receber)';
    if (l.classe && l.classe.tipo === 'transferencia') { const o = l.classe.contraBanco || 'outro banco', pr = l.classe.parId ? '' : ' — aguardando o outro lado'; return (l.valor < 0 ? 'D ' + o + ' (transferência) · C ' + banco : 'D ' + banco + ' · C ' + o + ' (transferência)') + pr; }
    if (l.classe) return l.valor < 0 ? 'D Despesa — ' + (l.classe.categoria || 'Gastos') + ' · C ' + banco : 'D ' + banco + ' · C Receita — ' + (l.classe.categoria || 'Entradas');
    return '';
  }
  root.__kcbmPfTeste = { sincronizarTaxasCartao, garantirBancos, parearTransferencias, transfPendentes, get bancoTipoDe() { return bancoTipoDe; }, baixaAutomatica, mestreDe, gruposCartoes, grupoUso, temaCartao, get CORES_CARTAO() { return CORES_CARTAO; }, bandeiraSvg, lerLista, gravarLista, lerDados, gravarDados, dividir, faturaDaCompra, gerarParcelas, estenderRecorrencia, garantirRecorrencias, alterarValorParcela, encerrarRecorrencia, saldoMes, faturasDoCartao, faturasQueVencemNoMes, ajusteDeFatura, limiteUsado, lancamentoTexto, cpfValido, somaMes, num, mesInicio };

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
  const ST = { movMeses: null, movMesesRef: '', movAtras: false, bancoSel: '', pf: null, aba: 'movimentacao', movFiltro: 'todos', movAberto: {}, acumAberto: {}, scr: {}, dreAberto: {}, dreModo: 'ano', mesSaldo: null, mesLista: hoje().slice(0, 7), cartaoSel: null, mesFatura: null, tela: 'lista' };
  const el = () => document.getElementById('page-kcbm-pf');
  const CARTAO = '<svg width="18" height="14" viewBox="0 0 18 14" style="vertical-align:-2px"><defs><linearGradient id="pfPrata" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9ced6"/><stop offset=".55" stop-color="#f4f6f8"/><stop offset=".8" stop-color="#9aa1ab"/><stop offset="1" stop-color="#dfe3e8"/></linearGradient></defs><rect x="0.5" y="0.5" width="17" height="13" rx="2" fill="url(#pfPrata)" stroke="#8b929c"/><rect x="0.5" y="3" width="17" height="2.6" fill="#6b727c"/><rect x="2.5" y="9" width="5" height="1.6" rx=".8" fill="#8b929c"/></svg>';
  const ICO_DOIS = '<svg width="18" height="16" viewBox="0 0 24 20" style="vertical-align:-3px;color:var(--ink);filter:drop-shadow(0 0 2.5px currentColor)"><circle cx="8" cy="6" r="4" fill="currentColor"/><path d="M0 19c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/><circle cx="17" cy="7" r="3.3" fill="currentColor" opacity=".75"/><path d="M13.5 12.4c.9-.3 2-.4 3.5-.4 4 0 7 2.2 7 6.5v.5h-8.6c0-2.6-.8-5-1.9-6.6z" fill="currentColor" opacity=".75"/><ellipse cx="6.7" cy="4.6" rx="1.5" ry="1" fill="#fff" opacity=".45"/></svg>', ICO_UM = '<svg width="16" height="16" viewBox="0 0 20 20" style="vertical-align:-3px;color:var(--ink);filter:drop-shadow(0 0 2.5px currentColor)"><circle cx="10" cy="5.5" r="4.5" fill="currentColor"/><path d="M1 19c0-5 4-8 9-8s9 3 9 8z" fill="currentColor"/><ellipse cx="8.3" cy="3.8" rx="1.7" ry="1.1" fill="#fff" opacity=".45"/></svg>';
  const ICO_MOV = '<svg width="17" height="17" viewBox="0 0 24 24" style="vertical-align:-3px;filter:drop-shadow(0 0 3px #ffc400)" fill="none" stroke="#ffc400" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V9a3 3 0 0 1 3-3h11"/><path d="M15 2.5L18.5 6 15 9.5"/><path d="M20 13v2a3 3 0 0 1-3 3H6"/><path d="M9 21.5L5.5 18 9 14.5"/></svg>';
  const prataIco = (id, corpo) => '<svg width="17" height="17" viewBox="0 0 24 24" style="vertical-align:-3px"><defs><linearGradient id="pfP' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9ced6"/><stop offset=".55" stop-color="#f4f6f8"/><stop offset=".8" stop-color="#9aa1ab"/><stop offset="1" stop-color="#dfe3e8"/></linearGradient></defs><g fill="url(#pfP' + id + ')" stroke="#7b838e" stroke-width="1" stroke-linejoin="round">' + corpo + '</g></svg>';
  const ICO_EMP = prataIco('e', '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6.3" fill="none"/><path d="M12 7.5v9M14.6 9.6c-.5-1-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.5-2.7-1.5" fill="none" stroke-linecap="round"/>');
  const ICO_FIN = prataIco('f', '<path d="M2.5 11.5L12 3l9.5 8.5h-2.5V21h-5v-6h-4v6h-5v-9.5z"/>');
  const ICO_PAR = prataIco('p', '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="none"/>');
  const ICO_CX = prataIco('c', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3" fill="none"/><circle cx="6" cy="12" r="1" fill="#7b838e"/><circle cx="18" cy="12" r="1" fill="#7b838e"/>');
  const ICO_NF = prataIco('n', '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M8.5 7h7M8.5 11h7M8.5 15h4" fill="none" stroke-linecap="round"/>');
  const ICO_MERC = prataIco('m', '<path d="M2 3h3l2.4 11.5a2 2 0 0 0 2 1.5h8.2a2 2 0 0 0 2-1.5L21 7H6"/><circle cx="9.5" cy="20" r="1.6"/><circle cx="17.5" cy="20" r="1.6"/>');
  const ABAS = [['movimentacao', ICO_MOV, 'Movimentação', 'Movim.'], ['extrato', '🏦', 'Extrato bancário', 'Extrato'], ['cartoes', CARTAO, 'Cartões de crédito', 'Cartões'], ['emprestimos', ICO_EMP, 'Empréstimos', 'Empr.'], ['financiamentos', ICO_FIN, 'Financiamentos', 'Financ.'], ['parcelamentos', ICO_PAR, 'Parcelamentos', 'Parcel.'], ['notas', ICO_NF, 'Notas fiscais', 'Notas'], ['mercado', ICO_MERC, 'Mercado', 'Mercado'], ['saldo', '⚖', 'Saldo', 'Saldo'], ['caixa', ICO_CX, 'Saldo por caixa', 'Caixa'], ['acumulado', '📈', 'Acumulado', 'Acumul.'], ['dre', '📑', 'DRE', 'DRE']];
  const B = (txt, on, cls, ttl) => '<button class="btn ' + (cls || 'bo') + ' bsm" ' + (ttl ? 'title="' + E(ttl) + '" ' : '') + 'onclick="' + on + '">' + txt + '</button>';
  const IN = 'width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--white);color:var(--ink);font:inherit;font-size:13px';
  const TH = 'padding:7px 9px;text-align:left;font-size:11.5px;white-space:nowrap;background:var(--ink2);color:#fff';
  const TD = 'padding:6px 9px;border-bottom:1px solid var(--border);font-size:12.5px;vertical-align:top';
  const dadosAtual = () => { const d = lerDados(ST.pf); let mu = garantirRecorrencias(d, somaMes(fechMes(), LIMITE_MESES)); if (garantirBancos(d)) mu = true; if (parearTransferencias(d)) mu = true; if (sincronizarTaxasCartao(d)) mu = true; if (mu) gravarDados(ST.pf, d); return d; };
  const pfAtual = () => lerLista().find(x => x.id === ST.pf);
  // Tabela com cabeçalho congelado (fica visível ao rolar) e linha de filtros logo abaixo (um campo por coluna; filtra na hora, sem recarregar).
  function tabela(cols, linhas, vazio, semFiltro) {
    const sig = cols.map(c => String(c.t).replace(/<[^>]*>/g, '')).join('|') + '#' + (ST.pf || '') + (ST.aba || '') + (ST.tela || '');
    const fil = semFiltro ? '' : '<tr class="kpfFiltroLinha">' + cols.map((c, i) => '<th style="' + TH + ';padding:3px 5px;font-weight:400">' + ((String(c.t).replace(/<[^>]*>/g, '').trim()) ? '<input class="kpfFiltroIn" data-i="' + i + '" placeholder="filtrar" oninput="kcbmPf.filtrar(this)" style="width:100%;min-width:60px;box-sizing:border-box;padding:3px 6px;font-size:11.5px;border-radius:5px;border:1px solid var(--border);background:var(--white);color:var(--ink)">' : '') + '</th>').join('') + '</tr>';
    return '<div style="overflow:auto;max-height:calc(100vh - 150px);border:1px solid var(--border);border-radius:8px"><table data-sig="' + E(sig) + '" data-nf="' + (semFiltro ? 0 : 1) + '" style="width:100%;border-collapse:collapse"><thead style="position:sticky;top:0;z-index:3"><tr>' + cols.map(c => '<th style="' + TH + (c.r ? ';text-align:right' : '') + '">' + c.t + '</th>').join('') + '</tr>' + fil + '</thead><tbody>'
      + (linhas.length ? linhas.join('') : '<tr><td colspan="' + cols.length + '" style="padding:22px;text-align:center;color:var(--slate)">' + (vazio || 'Nada por aqui ainda.') + '</td></tr>') + '</tbody></table></div>';
  }
  const FILTROS = {};
  function aplicarFiltroTabela(t) {
    const f = FILTROS[t.getAttribute('data-sig')] || {}, ks = Object.keys(f).filter(k => f[k]);
    t.querySelectorAll('.kpfFiltroIn').forEach(inp => { const v = f[inp.getAttribute('data-i')] || ''; if (inp.value !== v) inp.value = v; });
    let visivel = true; const rows = Array.from(t.tBodies[0] ? t.tBodies[0].rows : []);
    rows.forEach(r => {
      const sub = r.cells.length === 1 && r.cells[0].colSpan > 1;
      if (sub) { if (rows.length > 1) r.style.display = visivel ? '' : 'none'; return; }
      visivel = ks.every(k => norm(r.cells[+k] ? r.cells[+k].textContent : '').indexOf(norm(f[k])) >= 0); r.style.display = visivel ? '' : 'none';
    });
  }
  function rotularTabelas() {
    try { const e = el(); if (!e) return; e.querySelectorAll('table[data-nf]').forEach(t => { const hs = Array.from(t.querySelectorAll('thead tr:first-child th')).map(h => h.textContent.trim()); t.classList.add('tabCard'); Array.from(t.tBodies[0] ? t.tBodies[0].rows : []).forEach(r => { if (r.cells.length === hs.length) Array.from(r.cells).forEach((c, i) => c.setAttribute('data-label', hs[i] || '')); }); }); } catch (x) { console.warn('rotular', x); }
  }
  const aplicarFiltros = () => { try { const e = el(); if (e) e.querySelectorAll('table[data-nf="1"]').forEach(aplicarFiltroTabela); } catch (x) { console.warn('filtros', x); } };
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
  const navMes = (mes) => '<div style="display:flex;align-items:center;gap:6px"><b style="min-width:150px" title="O mês vem da data lá em cima, no topo do site">' + rotMes(mes) + '</b></div>';
  // campo de pessoa (fornecedor/cliente) com sugestões do cadastro universal
  const datalistCred = (id, d) => '<datalist id="' + id + '">' + (d.cartoes || []).map(c => '<option value="' + E(c.nome) + '">Cartão de crédito</option>').join('') + (d.bancos || []).map(b => '<option value="' + E(b.nome) + '">Conta corrente</option>').join('') + lerTerceiros().filter(t => t.tipo === 'fornecedor' || t.tipo === 'ambos').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(t => '<option value="' + E(t.nome) + '">').join('') + '</datalist>';
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
      const sp = saldoMes(d, 'pagar', m), sr = saldoMes(d, 'receber', m), dif = Math.round((sr.final - sp.final) * 100) / 100;
      return '<tr style="cursor:pointer" onclick="kcbmPf.abrir(\'' + p.id + '\')"><td style="' + TD + ';font-weight:600">' + E(p.nome) + '</td>' + td(E(fmtCpf(p.cpf)) || '—') + td(R$(sp.final), 1) + td(R$(sr.final), 1) + td('<b style="color:' + (dif < 0 ? '#dc2626' : '#16a34a') + '">' + R$(dif) + '</b>', 1)
        + '<td style="' + TD + ';text-align:right;white-space:nowrap" onclick="event.stopPropagation()">' + B('Abrir', "kcbmPf.abrir('" + p.id + "')", 'bp') + ' ' + B('✏️', "kcbmPf.editarPessoa('" + p.id + "')", 'bo', 'Editar nome/CPF') + ' ' + B('🗑', "kcbmPf.excluirPessoa('" + p.id + "')", 'bo', 'Excluir esta pessoa e todos os dados dela (pede confirmação)') + '</td></tr>';
    });
    el().innerHTML = '<div style="padding:18px 22px 40px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><img src="assets/pessoa-fisica.svg" alt="" style="height:28px;width:28px"><div style="font-size:1.3rem;font-weight:700">Pessoa Física</div>'
      + '<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">' + B('🏷 Tipos de gasto / receita', "kcbmPf.tela('tipos')") + B(ICO_DOIS + ' A quem pago / de quem recebo', "kcbmPf.tela('terceiros')") + B(ICO_UM + ' Por quem pago', "kcbmPf.tela('porquem')") + B('⬇ Exportar dados', 'kcbmPf.exportar()', 'bo', 'Baixa um arquivo com tudo deste módulo (para levar ao Fluxo PF ou guardar como backup)') + B('+ Nova pessoa física', 'kcbmPf.novaPessoa()', 'bp') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Cadastre a pessoa e abra para lançar contas a pagar/receber, extrato, cartões e ver o saldo. Os valores são do mês do topo (' + rotMes(fechMes()) + '): tudo que ainda não foi pago ou recebido até o fim do mês, incluindo as faturas de cartão. Saldo total = a receber − a pagar (verde positivo, vermelho negativo).</div>'
      + tabela([{ t: 'Pessoa' }, { t: 'CPF' }, { t: 'Saldo a pagar', r: 1 }, { t: 'Saldo a receber', r: 1 }, { t: 'Saldo total', r: 1 }, { t: '' }], linhas, 'Nenhuma pessoa física cadastrada. Clique em "+ Nova pessoa física".') + '</div>';
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
  function telaPorQuem() {
    const ts = lerPorQuem().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const linhas = ts.map(t => '<tr>' + td(seloPorQuem({ porQuem: t.nome })) + '<td style="' + TD + ';text-align:right">' + B('✏️', "kcbmPf.porQuemForm('" + t.id + "')") + ' ' + B('🗑', "kcbmPf.porQuemExcluir('" + t.id + "')") + '</td></tr>');
    el().innerHTML = '<div style="padding:18px 22px 40px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + B('← Pessoas físicas', "kcbmPf.tela('lista')") + '<div style="font-size:1.25rem;font-weight:700">' + ICO_UM + ' Por quem pago</div><div style="margin-left:auto">' + B('+ Novo', 'kcbmPf.porQuemForm()', 'bp') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Pessoas que usam um gasto que você paga (ex.: um filho no futebol). Ao lançar uma conta a pagar você escolhe aqui, e o nome aparece como um selinho amarelo ao lado de <b>a quem pago</b>. Cadastro único para todas as pessoas.</div>'
      + tabela([{ t: 'Nome' }, { t: '' }], linhas, 'Ninguém cadastrado ainda. Clique em "+ Novo" (ou digite o nome direto ao lançar uma conta).') + '</div>';
  }
  function telaTerceiros() {
    const ts = lerTerceiros().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const linhas = ts.map(t => '<tr>' + td('<b>' + E(t.nome) + '</b>') + td({ fornecedor: 'A quem pago', cliente: 'De quem recebo', ambos: 'Os dois' }[t.tipo] || '') + td(E(t.doc || '')) + '<td style="' + TD + ';text-align:right">' + B('✏️', "kcbmPf.tercForm('" + t.id + "')") + ' ' + B('🗑', "kcbmPf.tercExcluir('" + t.id + "')") + '</td></tr>');
    el().innerHTML = '<div style="padding:18px 22px 40px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + B('← Pessoas físicas', "kcbmPf.tela('lista')") + '<div style="font-size:1.25rem;font-weight:700">' + ICO_DOIS + ' A quem pago / de quem recebo</div><div style="margin-left:auto">' + B('+ Novo', 'kcbmPf.tercForm()', 'bp') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Cadastro único para todas as pessoas. Quem recebe o seu dinheiro (<b>a quem pago</b>) e quem lhe paga (<b>de quem recebo</b>) entra aqui sozinho quando você lança uma conta, e depois aparece como sugestão ao cadastrar de novo.</div>'
      + tabela([{ t: 'Nome' }, { t: 'Tipo' }, { t: 'CPF/CNPJ' }, { t: '' }], linhas, 'Ninguém cadastrado ainda.') + '</div>';
  }

  // ───────────── dentro da pessoa ─────────────
  function telaPessoa() {
    const p = pfAtual(); if (!p) { ST.pf = null; return telaLista(); }
    const abas = ABAS.map(a => '<button class="kpfTab" onclick="kcbmPf.aba(\'' + a[0] + '\')" style="padding:8px 14px;border:1px solid var(--border);border-bottom:' + (ST.aba === a[0] ? '3px solid var(--teal)' : '1px solid var(--border)') + ';background:' + (ST.aba === a[0] ? 'var(--white)' : 'transparent') + ';color:var(--ink);font-weight:' + (ST.aba === a[0] ? '700' : '500') + ';border-radius:8px 8px 0 0;cursor:pointer;font-size:12.5px;white-space:nowrap">' + '<span class="kpfI">' + a[1] + '</span><span class="lg"> ' + a[2] + '</span><span class="sh">' + a[3] + '</span></button>').join('');
    el().innerHTML = '<div style="padding:16px 22px 40px"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + B('← Pessoas físicas', 'kcbmPf.voltar()') + '<div style="font-size:1.25rem;font-weight:700">' + E(p.nome) + '</div><div style="font-size:12px;color:var(--slate)">' + E(fmtCpf(p.cpf)) + '</div>' + B('🧾 Anexar nota fiscal', 'kcbmPf.notaAnexar()', 'bo', 'Anexar NFC-e / nota fiscal (XML ou PDF)') + '</div>'
      + '<div class="kpfTabs" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;border-bottom:1px solid var(--border)">' + abas + '</div><div id="kpfAba">' + telaAba() + '</div></div>';
  }
  function telaAba() {
    const d = dadosAtual();
    return ({ entradas: () => abaMov(d, 'entradas'), gastos: () => abaMov(d, 'gastos'), extrato: () => abaExtrato(d), movimentacao: () => abaMovimentacao(d), pagar: () => abaTitulos(d, 'pagar'), receber: () => abaTitulos(d, 'receber'), saldo: () => abaSaldo(d), cartoes: () => abaCartoes(d), acumulado: () => abaAcumulado(d), caixa: () => abaSaldoCaixa(d), dre: () => abaDRE(d), emprestimos: () => abaContratos(d, 'emprestimo'), financiamentos: () => abaContratos(d, 'financiamento'), parcelamentos: () => abaContratos(d, 'parcelamento'), notas: () => abaNotas(d), mercado: () => abaPesqTela(pqSeed(d), ST.mercadoVis || 'pesq') }[ST.aba] || (() => ''))();
  }
  // ── Entradas / Gastos ──
  function abaMov(d, tipo) {
    const ent = tipo === 'entradas', mes = fechMes(), itens = (d[tipo] || []).filter(x => x.data.slice(0, 7) === mes).sort((a, b) => a.data.localeCompare(b.data));
    const total = itens.reduce((a, x) => a + cents(x.valor), 0) / 100;
    const linhas = itens.map(x => '<tr>' + td(br(x.data)) + td(E(x.descricao)) + td(E(x.categoria || '')) + td(E(x.banco || '')) + td(R$(x.valor), 1) + td(x.extratoId ? '<span title="Veio do extrato">🏦</span>' : '') + '<td style="' + TD + ';text-align:right">' + B('✏️', "kcbmPf.movForm('" + tipo + "','" + x.id + "')") + ' ' + B('🗑', "kcbmPf.movExcluir('" + tipo + "','" + x.id + "')") + '</td></tr>');
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes, 'kcbmPf.mesLista') + '<div style="margin-left:auto">' + B(ent ? '+ Nova entrada' : '+ Novo gasto', "kcbmPf.movForm('" + tipo + "')", 'bp') + '</div></div>'
      + tabela([{ t: 'Data' }, { t: 'Descrição' }, { t: ent ? 'Tipo de receita' : 'Tipo de gasto' }, { t: 'Banco' }, { t: 'Valor', r: 1 }, { t: '' }, { t: '' }], linhas, ent ? 'Nenhuma entrada neste mês.' : 'Nenhum gasto neste mês.')
      + '<div style="text-align:right;font-weight:700;margin-top:8px">Total do mês: <span style="color:' + (ent ? 'var(--teal)' : '#dc2626') + '">' + R$(total) + '</span></div>';
  }
  // ── Extrato bancário ──
  // ── Bancos (cardzinhos do Extrato): símbolo, agência/conta (opcional) e saldo inicial. O PDF NÃO é guardado: só as linhas viram tabela. ──
  const BANCOS_TIPOS = [['caixa', 'Caixa Econômica'], ['bradesco', 'Bradesco'], ['bb', 'Banco do Brasil'], ['itau', 'Itaú'], ['santander', 'Santander'], ['nubank', 'Nubank'], ['inter', 'Inter'], ['c6', 'C6 Bank'], ['mercadopago', 'Mercado Pago'], ['brb', 'BRB'], ['digio', 'Digio'], ['next', 'Next'], ['picpay', 'PicPay'], ['sicoob', 'Sicoob'], ['sicredi', 'Sicredi'], ['btg', 'BTG Pactual'], ['xp', 'XP'], ['safra', 'Safra'], ['pagbank', 'PagBank'], ['neon', 'Neon'], ['original', 'Banco Original'], ['outro', 'Outro']];
  const bancoTipoDe = nome => { const n = String(nome || '').toLowerCase(); return /caixa/.test(n) ? 'caixa' : /bradesco/.test(n) ? 'bradesco' : /brasil|^bb$/.test(n) ? 'bb' : /ita[uú]/.test(n) ? 'itau' : /santander/.test(n) ? 'santander' : /nubank/.test(n) ? 'nubank' : /inter/.test(n) ? 'inter' : /c6/.test(n) ? 'c6' : /mercado *pago/.test(n) ? 'mercadopago' : /(^|[^a-z0-9])brb([^a-z0-9]|$)/.test(n) ? 'brb' : /digio/.test(n) ? 'digio' : /next/.test(n) ? 'next' : /picpay/.test(n) ? 'picpay' : /sicoob/.test(n) ? 'sicoob' : /sicredi/.test(n) ? 'sicredi' : /btg/.test(n) ? 'btg' : /(^|[^a-z0-9])xp([^a-z0-9]|$)/.test(n) ? 'xp' : /safra/.test(n) ? 'safra' : /pagbank|pagseguro/.test(n) ? 'pagbank' : /neon/.test(n) ? 'neon' : /original/.test(n) ? 'original' : 'outro'; };
  // logos que já têm forma/cor própria: no tema escuro a parte branca ao redor some (fica da cor do cartão)
  const LOGO_PROPRIO = ['brb', 'itau', 'inter', 'picpay', 'nubank', 'bradesco', 'digio', 'caixa'];
  const LOGOS_OFICIAIS = ['caixa', 'bradesco', 'bb', 'itau', 'santander', 'nubank', 'inter', 'c6', 'mercadopago', 'brb', 'digio', 'picpay', 'sicoob', 'sicredi', 'btg', 'xp', 'safra', 'pagbank', 'neon', 'original'];
  // Administrador do cartão (banco ou loja): o logo dele aparece no cartão; a bandeira (Visa/Master…) fica numa linha embaixo.
  // Bancos usam assets/bancos/<id>.png; lojas usam assets/emissores/<id>.png (troque o arquivo pelo logo oficial quando quiser).
  const EMISSORES = [['bradesco', 'Bradesco', 'b'], ['nubank', 'Nubank', 'b'], ['itau', 'Itaú', 'b'], ['santander', 'Santander', 'b'], ['bb', 'Banco do Brasil', 'b'], ['caixa', 'Caixa', 'b'], ['inter', 'Inter', 'b'], ['c6', 'C6 Bank', 'b'], ['mercadopago', 'Mercado Pago', 'b'], ['brb', 'BRB', 'b'], ['digio', 'Digio', 'b'], ['picpay', 'PicPay', 'b'], ['carrefour', 'Carrefour', 'e'], ['renner', 'Renner', 'e'], ['marisa', 'Marisa', 'e'], ['vestcasa', 'Vest Casa', 'e'], ['dmcard', 'DM Card', 'e'], ['maiscard', 'Cartão Mais', 'e'], ['dibs', 'Dibs', 'e'], ['negreiros', 'Mercado Negreiros', 'e'], ['fernando', 'Armarinhos Fernando', 'e'], ['amazon', 'Amazon', 'e'], ['outro', 'Outro', '']];
  const emissorDe = c => { if (!c) return ''; if (c.emissor) return c.emissor; const n = norm(c.nome || ''), pal = x => new RegExp('(^|[^a-z0-9])' + x + '([^a-z0-9]|$)').test(n); return /bradesco/.test(n) ? 'bradesco' : (/nubank/.test(n) || pal('nu')) ? 'nubank' : /itau/.test(n) ? 'itau' : /santander/.test(n) ? 'santander' : (/brasil/.test(n) || pal('bb')) ? 'bb' : /caixa/.test(n) ? 'caixa' : pal('inter') ? 'inter' : pal('c6') ? 'c6' : /mercado *pago/.test(n) ? 'mercadopago' : pal('brb') ? 'brb' : /digio/.test(n) ? 'digio' : /picpay/.test(n) ? 'picpay' : /carrefour/.test(n) ? 'carrefour' : /renner/.test(n) ? 'renner' : /marisa/.test(n) ? 'marisa' : /vest *casa/.test(n) ? 'vestcasa' : (pal('dm') || /dm *card/.test(n)) ? 'dmcard' : /mais/.test(n) ? 'maiscard' : /dibs/.test(n) ? 'dibs' : /negreiros/.test(n) ? 'negreiros' : /fernando/.test(n) ? 'fernando' : /amazon/.test(n) ? 'amazon' : ''; };
  const imagemDe = c => { if (!c) return ''; if (c.imagem) return c.imagem; const n = norm(c.nome || ''); if (emissorDe(c) === 'nubank' && /master/i.test(c.bandeira || '')) return 'assets/cartoes/nubank-mastercard.webp?v=1'; if (emissorDe(c) === 'caixa' && /visa/i.test(c.bandeira || '')) return 'assets/cartoes/caixa-visa.webp?v=1'; if (emissorDe(c) === 'brb' && /visa/i.test(c.bandeira || '')) return 'assets/cartoes/brb-visa.webp?v=1'; if (emissorDe(c) === 'digio' && /visa/i.test(c.bandeira || '')) return 'assets/cartoes/digio-visa.webp?v=1'; if (emissorDe(c) === 'amazon' && /master/i.test(c.bandeira || '')) return 'assets/cartoes/amazon-mastercard.webp?v=2'; if (emissorDe(c) === 'negreiros') return 'assets/cartoes/negreiros.webp?v=4'; if (emissorDe(c) === 'vestcasa') return 'assets/cartoes/vestcasa.webp?v=6'; if (emissorDe(c) === 'fernando') return 'assets/cartoes/fernando.webp?v=1'; if (emissorDe(c) === 'dmcard') return 'assets/cartoes/dmcard.webp?v=1'; if (emissorDe(c) === 'renner') return 'assets/cartoes/renner.webp?v=1'; if (emissorDe(c) === 'marisa') return 'assets/cartoes/marisa.webp?v=1'; if (emissorDe(c) === 'dibs') return 'assets/cartoes/dibs.webp?v=1'; if (emissorDe(c) === 'maiscard') return 'assets/cartoes/maiscard.webp?v=3'; if (emissorDe(c) === 'carrefour') return 'assets/cartoes/carrefour.webp?v=2'; return /bradesco/.test(n) && /disney/.test(n) ? 'assets/cartoes/bradesco-disney.webp?v=4' : (/bradesco/.test(n) && /(^|[^a-z0-9])neo([^a-z0-9]|$)/.test(n) ? 'assets/cartoes/bradesco-neo.webp?v=4' : ''); };
  function emissorLogo(id, z) {
    z = z || 24; const e = EMISSORES.find(x => x[0] === id);
    if (!e || e[2] === '') return bancoLogo('outro', z);
    if (e[2] === 'b') return bancoLogo(id, z);
    if (id === 'fernando') return '<img src="assets/emissores/fernando.png?v=2" height="' + z + '" alt="' + E(e[1]) + '" style="flex:none;height:' + z + 'px;width:auto;border-radius:5px;background:#fff;padding:2px 4px">'; // logo largo (não é quadrado)
    return '<img src="assets/emissores/' + id + '.png?v=2" width="' + z + '" height="' + z + '" alt="' + E(e[1]) + '" style="flex:none;border-radius:7px;background:#fff;object-fit:contain">';
  }
  function bancoLogo(tipo, z) {
    z = z || 34;
    if (LOGOS_OFICIAIS.indexOf(tipo) >= 0) return '<img class="' + (LOGO_PROPRIO.indexOf(tipo) >= 0 ? 'kpfLP' : '') + '" src="assets/bancos/' + tipo + '.svg?v=2" onerror="this.onerror=null;this.src=\'assets/bancos/' + tipo + '.png\'" width="' + z + '" height="' + z + '" alt="" style="flex:none;border-radius:9px;background:#fff;object-fit:contain">';
    const sv = (bg, inner) => '<svg width="' + z + '" height="' + z + '" viewBox="0 0 40 40" style="flex:none;border-radius:9px"><rect width="40" height="40" rx="9" fill="' + bg + '"/>' + inner + '</svg>';
    const txt = (t, c, fs) => '<text x="20" y="26" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="' + (fs || 15) + '" fill="' + (c || '#fff') + '">' + t + '</text>';
    if (tipo === 'caixa') return sv('#005CA9', '<path d="M9 9 L18 20 L9 31 L15 31 L21 23.5 L27 31 L33 31 L24 20 L33 9 L27 9 L21 16.5 L15 9 Z" fill="#fff"/><path d="M21 16.5 L27 9 L33 9 L24 20 L21 16.5Z" fill="#F7941D"/>');
    if (tipo === 'bradesco') return sv('#CC092F', '<rect x="8" y="12" width="24" height="17" rx="2" fill="#fff"/><path d="M8 12 L20 5 L32 12Z" fill="#fff"/><rect x="12" y="16" width="3" height="9" fill="#CC092F"/><rect x="18.5" y="16" width="3" height="9" fill="#CC092F"/><rect x="25" y="16" width="3" height="9" fill="#CC092F"/>');
    if (tipo === 'bb') return sv('#FCFC30', txt('BB', '#0038A8', 17));
    if (tipo === 'itau') return sv('#EC7000', txt('itaú', '#fff', 12));
    if (tipo === 'santander') return sv('#EC0000', txt('S', '#fff', 20));
    if (tipo === 'nubank') return sv('#8A05BE', txt('nu', '#fff', 17));
    if (tipo === 'inter') return sv('#FF7A00', txt('inter', '#fff', 11));
    if (tipo === 'c6') return sv('#242424', txt('C6', '#fff', 16));
    const mapa = { mercadopago: ['#009EE3', 'MP', '#fff', 16], brb: ['#0033A0', 'BRB', '#fff', 13], digio: ['#0A2A6B', 'digio', '#00D1FF', 10], next: ['#00FF5F', 'next', '#000', 12], picpay: ['#11C76F', 'Pic', '#fff', 13], sicoob: ['#003641', 'sicoob', '#7DB61C', 9], sicredi: ['#3FA110', 'Sic', '#fff', 14], btg: ['#001E50', 'BTG', '#fff', 13], xp: ['#000', 'XP', '#FFD400', 17], safra: ['#001A4D', 'Safra', '#fff', 10], pagbank: ['#1BB99A', 'Pag', '#fff', 13], neon: ['#00E5E5', 'neon', '#000', 11], original: ['#00A857', 'Orig', '#fff', 11] };
    if (mapa[tipo]) return sv(mapa[tipo][0], txt(mapa[tipo][1], mapa[tipo][2], mapa[tipo][3]));
    return sv('#52525B', '<path d="M8 16 L20 8 L32 16Z M10 18 H30 V20 H10Z M12 21 H15 V30 H12Z M18.5 21 H21.5 V30 H18.5Z M25 21 H28 V30 H25Z M9 31 H31 V33 H9Z" fill="#fff"/>');
  }
  // acha/cria bancos a partir do que já existe no extrato; semeia o Bradesco para quem já usa a Caixa (pedido do dono). Só roda uma vez por pessoa.
  function garantirBancos(d) {
    let mu = false; if (!Array.isArray(d.bancos)) { d.bancos = []; mu = true; }
    (d.extrato || []).forEach(l => {
      if (l.bancoId && d.bancos.some(b => b.id === l.bancoId)) return;
      const nome = (l.banco || '').trim() || 'Banco'; let b = d.bancos.find(x => norm(x.nome) === norm(nome));
      if (!b) { b = { id: uid(), tipo: bancoTipoDe(nome), nome, agencia: '', conta: '', saldoIni: 0, saldoIniData: '' }; d.bancos.push(b); }
      l.bancoId = b.id; mu = true;
    });
    if (!d.bancosSemeados) {
      d.bancosSemeados = true; mu = true;
      const cx = d.bancos.find(b => b.tipo === 'caixa');
      if (cx) {
        if (!cx.agencia && !cx.conta) { cx.agencia = '3053'; cx.conta = 'op. 3701 · 000599919528-0'; }
        if (!d.bancos.some(b => b.tipo === 'bradesco')) d.bancos.push({ id: uid(), tipo: 'bradesco', nome: 'Bradesco', agencia: '3980', conta: '613583-8', saldoIni: 0, saldoIniData: '' });
      }
    }
    return mu;
  }
  const saldoBanco = (d, b, mes) => { const fim = mes + '-31'; let s0 = cents(b.saldoIni || 0); (d.extrato || []).forEach(l => { if (l.bancoId === b.id && l.data <= fim && (!b.saldoIniData || l.data > b.saldoIniData)) s0 += cents(l.valor); }); return s0 / 100; };
  // Uma linha só, com setas para os lados (rolar). Guarda a posição para não voltar ao início ao redesenhar.
  function carrossel(id, html) {
    const seta = (lado, txt, dir) => '<button type="button" class="btn bo kpfSeta" aria-label="' + (dir < 0 ? 'Anterior' : 'Próximo') + '" style="position:absolute;' + lado + ':0;top:50%;transform:translateY(-50%);z-index:5;width:34px;height:34px;padding:0;border-radius:50%;font-size:20px;line-height:1;box-shadow:0 2px 10px rgba(0,0,0,.35)" onclick="kcbmPf.rolar(\'' + id + '\',' + dir + ')">' + txt + '</button>';
    return '<div style="position:relative">' + seta('left', '‹', -1) + '<div id="' + id + '" class="kpfCarr" onscroll="kcbmPf.scr(this)" style="display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;padding:4px 2px 10px;margin:0 46px">' + html + '</div>' + seta('right', '›', 1) + '</div>';
  }
  function restaurarCarrosseis() { try { const e = el(); if (!e) return; e.querySelectorAll('.kpfCarr').forEach(c => { const v = ST.scr[c.id]; if (v) { c.style.scrollBehavior = 'auto'; c.scrollLeft = v; c.style.scrollBehavior = ''; } }); } catch (x) {} }
  function abaBancos(d) {
    const mes = fechMes(), sel = ST.bancoSel || '';
    const cards = (d.bancos || []).map(b => {
      const ls = (d.extrato || []).filter(l => l.bancoId === b.id && l.data.slice(0, 7) === mes), ent = ls.filter(l => l.valor > 0).reduce((a, l) => a + cents(l.valor), 0) / 100, sai = ls.filter(l => l.valor < 0).reduce((a, l) => a + cents(l.valor), 0) / 100, pend = ls.filter(l => !l.baixa && !l.classe).length, tp = transfPendentes(d, b.id), on = sel === b.id, sd = saldoBanco(d, b, mes), sa = saldoBanco(d, b, somaMes(mes, -1));
      return '<div draggable="true" ondragstart="kcbmPf.arrastarIni(event,\'banco\',\'' + b.id + '\')" ondragend="kcbmPf.arrastarFim(event)" ondragover="kcbmPf.arrastarSobre(event,\'banco\')" ondrop="kcbmPf.soltar(event,\'banco\',\'' + b.id + '\')" onclick="kcbmPf.bancoSel(\'' + b.id + '\')" style="cursor:grab;min-width:230px;flex:0 0 270px;scroll-snap-align:start;position:relative;border:' + (on ? '3px solid var(--teal)' : '2px solid var(--border)') + ';border-radius:12px;padding:11px 13px;background:var(--white)"><div style="display:flex;align-items:center;gap:10px">' + bancoLogo(b.tipo, 34) + '<div style="flex:1;min-width:0"><b>' + E(b.nome) + '</b>' + ((b.agencia || b.conta) ? '<div style="font-size:11.5px;color:var(--slate)">' + (b.agencia ? 'Ag. ' + E(b.agencia) : '') + (b.agencia && b.conta ? ' · ' : '') + (b.conta ? 'Conta ' + E(b.conta) : '') + '</div>' : '') + '</div><span class="kpfEdit" onclick="event.stopPropagation()">' + B('✏️', "kcbmPf.bancoForm('" + b.id + "')", 'bo', 'Editar banco') + '</span></div>'
        + '<div style="font-size:12.5px;line-height:1.55;margin-top:6px">'
          + '<div style="display:flex;justify-content:space-between;gap:8px"><span>Saldo inicial <span style="color:var(--slate);font-size:11px">(' + ((b.saldoIniData && b.saldoIniData.slice(0, 7) === somaMes(mes, -1)) ? br(b.saldoIniData) : 'início de ' + mes.slice(5, 7) + '/' + mes.slice(0, 4)) + ')</span></span><b style="color:' + cor(sa) + '">' + R$(sa) + '</b></div>'
          + '<div style="display:flex;justify-content:space-between;gap:8px"><span>Entradas</span><b style="color:var(--teal)">' + R$(ent) + '</b></div>'
          + '<div style="display:flex;justify-content:space-between;gap:8px"><span>Saídas</span><b style="color:#dc2626">' + R$(sai) + '</b></div>'
          + '<div style="display:flex;justify-content:space-between;gap:8px;color:#b45309"><span>Lançamentos pendentes</span><b>' + pend + '</b></div>'
          + (tp.length ? '<div style="margin-top:3px;padding:3px 7px;border-radius:7px;background:#fde047;color:#422006;font-weight:700;font-size:11.5px" title="Uma transferência saiu ou entrou em outro banco e ainda não foi conciliada aqui">↔ Transferência entre contas pendente: ' + tp.length + ' (' + R$(tp.reduce((a, l) => a + Math.abs(l.valor), 0)) + ')</div>' : '')
          + '<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border);margin-top:3px;padding-top:3px"><span><b>Saldo corrente</b> <span style="color:var(--slate);font-size:11px">(' + mes.slice(5, 7) + '/' + mes.slice(0, 4) + ')</span></span><b style="color:' + cor(sd) + '">' + R$(sd) + '</b></div>'
        + '</div></div>';
    }).join('');
    return (cards ? carrossel('kpfCarBancos', cards) : '') + '<div style="margin:0 0 14px">' + B('Adicionar banco', 'kcbmPf.bancoForm()', 'bp') + '</div>'
      + ((d.bancos || []).length ? '<div style="font-size:12px;color:var(--slate);margin:-4px 0 10px">Clique no banco para ver o extrato dele no mês. ' + (sel ? '' : '<b>Nenhum selecionado: mostrando todos.</b> ') + (sel ? B('Ver todos', "kcbmPf.bancoSel('')") : '') + '</div>' : '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Adicione o seu primeiro banco para importar extratos.</div>');
  }
  function abaExtrato(d) { return abaBancos(d) + abaExtratoLista(d); }
  // saldo da conta depois de cada linha do extrato (saldo inicial + lançamentos depois da data do saldo inicial, na ordem do extrato)
  function saldosCorrentes(d, sel) {
    const out = {}, bs = d.bancos || [];
    if (sel) { // um banco: saldo só dele
      const b = bs.find(x => x.id === sel); if (!b) return out; let s0 = cents(b.saldoIni || 0);
      (d.extrato || []).filter(l => l.bancoId === b.id).sort((a, c) => a.data.localeCompare(c.data) || (a.criado || 0) - (c.criado || 0)).forEach(l => { if (b.saldoIniData && l.data <= b.saldoIniData) { out[l.id] = null; return; } s0 += cents(l.valor); out[l.id] = s0 / 100; });
      return out;
    }
    // todos os bancos juntos: saldo consolidado (soma dos saldos iniciais + todas as linhas, na ordem em que aparecem)
    let s0 = bs.reduce((a, b) => a + cents(b.saldoIni || 0), 0);
    (d.extrato || []).slice().sort((a, c) => a.data.localeCompare(c.data) || (a.criado || 0) - (c.criado || 0)).forEach(l => {
      const b = bs.find(x => x.id === l.bancoId); if (b && b.saldoIniData && l.data <= b.saldoIniData) { out[l.id] = null; return; }
      if (!(l.classe && l.classe.tipo === 'transferencia')) s0 += cents(l.valor); // transferência entre contas suas não muda o saldo consolidado
      out[l.id] = s0 / 100;
    });
    return out;
  }
  function abaExtratoLista(d) {
    const mes = fechMes(), itens = (d.extrato || []).filter(x => x.data.slice(0, 7) === mes && (!ST.bancoSel || x.bancoId === ST.bancoSel)).sort((a, b) => a.data.localeCompare(b.data) || (a.criado || 0) - (b.criado || 0));
    const ent = itens.filter(x => x.valor > 0).reduce((a, x) => a + cents(x.valor), 0) / 100, sai = itens.filter(x => x.valor < 0).reduce((a, x) => a + cents(x.valor), 0) / 100;
    const sc = saldosCorrentes(d, ST.bancoSel || ''), mesAnt = somaMes(mes, -1);
    const antLin = (d.bancos || []).filter(b => !ST.bancoSel || b.id === ST.bancoSel).filter(b => Number(b.saldoIni) || (d.extrato || []).some(l => l.bancoId === b.id && l.data.slice(0, 7) <= mesAnt)).map(b => {
      const v = saldoBanco(d, b, mesAnt), rot = (b.saldoIniData && b.saldoIniData.slice(0, 7) === mesAnt) ? 'Saldo inicial em ' + br(b.saldoIniData) : 'Saldo anterior (fim de ' + rotMes(mesAnt) + ')';
      return '<tr style="background:rgba(127,127,127,.10);font-style:italic"><td style="' + TD + '"></td>' + td(br(mes + '-01')) + td(E(b.nome)) + td(rot) + td('') + '<td style="' + TD + ';text-align:right;white-space:nowrap;font-weight:700;color:' + cor(v) + '">' + R$(v) + '</td>' + td('') + td('') + '</tr>';
    });
    if (!ST.bancoSel && antLin.length > 1) { const tot = (d.bancos || []).reduce((a, b) => a + cents(saldoBanco(d, b, mesAnt)), 0) / 100; antLin.push('<tr style="background:rgba(127,127,127,.18);font-style:italic;font-weight:700"><td style="' + TD + '"></td>' + td(br(mes + '-01')) + td('Todos os bancos') + td('Saldo inicial juntos') + td('') + '<td style="' + TD + ';text-align:right;white-space:nowrap;color:' + cor(tot) + '">' + R$(tot) + '</td>' + td('') + td('') + '</tr>'); }
    const linhas = antLin.concat(itens.map(x => {
      const lanc = lancamentoTexto(x, x.banco), pend = !lanc;
      return '<tr>' + '<td style="' + TD + '">' + (pend ? '<input type="checkbox" class="kpfSelL" data-id="' + x.id + '">' : '') + '</td>' + td(br(x.data)) + td(E(x.banco || '')) + td(E(x.hist)) + '<td style="' + TD + ';text-align:right;white-space:nowrap;color:' + cor(x.valor) + '">' + R$(x.valor) + '</td>' + '<td style="' + TD + ';text-align:right;white-space:nowrap;font-weight:600;color:' + (sc[x.id] == null ? 'var(--slate)' : cor(sc[x.id])) + '">' + (sc[x.id] == null ? '' : R$(sc[x.id])) + '</td>'
        + td(pend ? '<span style="color:#b45309">— pendente —</span>' : '<span style="font-size:11.5px">' + E(lanc) + '</span>') + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + (pend ? B('Baixar / classificar', "kcbmPf.extratoBaixar('" + x.id + "')", 'bp') : B('↩ Desfazer', "kcbmPf.extratoDesfazer('" + x.id + "')")) + ' ' + B('🗑', "kcbmPf.extratoExcluir('" + x.id + "')") + '</td></tr>';
    }));
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes, 'kcbmPf.mesLista') + '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">' + B('📄 Importar extrato (PDF)', 'kcbmPf.importarPdf()', 'bp', 'Sobe o PDF do extrato; o site lê e você classifica') + B('+ Lançar à mão', 'kcbmPf.extratoForm()') + B('⚡ Baixa automática', 'kcbmPf.baixaAuto()', 'bo', 'Dá baixa nas contas cujo valor e vencimento batem com a linha do extrato') + B('✔ Classificar selecionadas', 'kcbmPf.extratoLote()', 'bo', 'Classifica várias linhas pendentes de uma vez') + '</div></div>'
      + (d.bancos || []).filter(b => (!ST.bancoSel || b.id === ST.bancoSel) && transfPendentes(d, b.id).length).map(b => '<div style="border:1px solid #eab308;background:rgba(253,224,71,.18);border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12.5px"><b>↔ Transferência entre contas pendente no ' + E(b.nome) + ':</b> ' + transfPendentes(d, b.id).map(l => R$(Math.abs(l.valor)) + ' em ' + br(l.data) + ' (' + (l.valor < 0 ? 'saiu d' : 'entrou n') + 'o ' + E(l.banco || '') + ')').join(' · ') + '. Localize a linha correspondente aqui e classifique como transferência entre contas (ou lance à mão).</div>').join('')
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:8px">Cada linha do extrato forma um <b>lançamento contábil</b>: dar baixa numa conta a pagar/receber, ou classificar como gasto/entrada (com o tipo cadastrado). Valor positivo = entrada; negativo = saída.</div>'
      + tabela([{ t: '<input type="checkbox" onchange="document.querySelectorAll(\'.kpfSelL\').forEach(c=>c.checked=this.checked)" title="Marcar todas as pendentes">' }, { t: 'Data' }, { t: 'Banco' }, { t: 'Histórico' }, { t: 'Valor', r: 1 }, { t: 'Saldo', r: 1 }, { t: 'Lançamento contábil' }, { t: '' }], linhas, 'Nenhuma linha de extrato neste mês.')
      + '<div style="text-align:right;margin-top:8px;font-size:13px">Entradas <b style="color:var(--teal)">' + R$(ent) + '</b> · Saídas <b style="color:#dc2626">' + R$(sai) + '</b> · Resultado <b>' + R$(ent + sai) + '</b></div>';
  }
  // ── Baixa automática: linha do extrato que paga exatamente o valor de algo que vencia no dia (ou até 3 dias antes). Inclui faturas de cartão. ──
  function baixaAutomatica(dd) {
    let n = 0;
    (dd.extrato || []).slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(l => {
      if (l.baixa || l.classe || !l.valor) return; const sai = l.valor < 0, tipo = sai ? 'pagar' : 'receber', alvo = cents(Math.abs(l.valor)), cand = [];
      (dd[tipo] || []).forEach(it => { if (it.forma === 'cartao') return; (it.parcelas || []).forEach(p => { if (!p.pago && cents(p.valor) === alvo) cand.push({ venc: p.venc, itens: [{ it, p }] }); }); });
      if (sai) (dd.cartoes || []).forEach(c => faturasDoCartao(dd, c.id).forEach(f => { if (f.aberto > 0.004 && cents(f.aberto) === alvo) cand.push({ venc: f.venc, itens: f.linhas.filter(x => !x.p.pago).map(x => ({ it: x.item, p: x.p })) }); }));
      let ok = cand.filter(c => c.venc === l.data); if (!ok.length) ok = cand.filter(c => c.venc < l.data && c.venc >= dataMaisDias(l.data, -3));
      if (ok.length !== 1) return;
      l.baixa = []; ok[0].itens.forEach(x => { x.p.pago = true; x.p.dataPago = l.data; x.p.extratoId = l.id; l.baixa.push({ tipo, itemId: x.it.id, n: x.p.n }); }); n++;
    });
    return n;
  }
  // ── Movimentação: tudo que vence no mês do topo (a pagar e a receber), com baixa; fatura de cartão em uma linha que abre e fecha ──
  // ── Acumulado: resultado por ano (5 anos, abre um novo a cada virada do calendário real) e movimento mês a mês ──
  // Conta cada parcela de conta a pagar/receber pela data de vencimento (compra no cartão entra na data da fatura) + entradas/gastos avulsos (inclui os classificados do extrato).
  function movimentosAno(d) {
    const out = [];
    [['pagar', 'fornecedor'], ['receber', 'cliente']].forEach(([tipo, campo]) => (d[tipo] || []).forEach(it => (it.parcelas || []).forEach(p => {
      if (!p.venc || it.quitaDivida) return; out.push({ data: p.venc, rec: tipo === 'receber', tipo: String(it.tipo || '').trim() || 'Sem tipo', porQuem: it.porQuem || '', nome: String(it[campo] || '') + (it.parcelado ? ' (' + p.n + '/' + it.n + ')' : '') + (it.forma === 'cartao' ? ' · cartão' : ''), valor: Number(p.valor) || 0, pago: !!p.pago });
    })));
    (d.entradas || []).forEach(x => { if (x.data) out.push({ data: x.data, rec: true, tipo: String(x.categoria || '').trim() || 'Sem tipo', nome: String(x.descricao || x.categoria || ''), valor: Math.abs(Number(x.valor) || 0), pago: true }); });
    (d.gastos || []).forEach(x => { if (x.data) out.push({ data: x.data, rec: false, tipo: String(x.categoria || '').trim() || 'Sem tipo', nome: String(x.descricao || x.categoria || ''), valor: Math.abs(Number(x.valor) || 0), pago: true }); });
    return out;
  }
  // ── DRE: receitas e gastos por TIPO, no mês do topo e acumulados (no ano até o mês, ou desde o início) ──
  // Conta pela data de vencimento, igual à aba Acumulado; compra no cartão entra pelo tipo da compra (não pelo pagamento da fatura).
  function abaDRE(d) {
    const ref = fechMes(), ano = ref.slice(0, 4), tudo = ST.dreModo === 'tudo';
    const mov = movimentosAno(d), ini = tudo ? '0000-00' : ano + '-01', fimMes = ref;
    const noMes = mov.filter(m => m.data.slice(0, 7) === ref), acum = mov.filter(m => { const k = m.data.slice(0, 7); return k >= ini && k <= fimMes; });
    const soma = (ls, rec) => ls.filter(m => m.rec === rec).reduce((a, m) => a + cents(m.valor), 0) / 100;
    const grupos = rec => { const g = {}; acum.filter(m => m.rec === rec).forEach(m => { (g[m.tipo] = g[m.tipo] || []).push(m); }); return Object.keys(g).map(t => ({ tipo: t, linhas: g[t].sort((a, b) => a.data.localeCompare(b.data)), acum: g[t].reduce((a, m) => a + cents(m.valor), 0) / 100, mes: g[t].filter(m => m.data.slice(0, 7) === ref).reduce((a, m) => a + cents(m.valor), 0) / 100 })).sort((a, b) => b.acum - a.acum); };
    const gr = grupos(true), gg = grupos(false), totRecA = soma(acum, true), totGasA = soma(acum, false), totRecM = soma(noMes, true), totGasM = soma(noMes, false);
    const pct = (v, base) => base > 0.004 ? (v / base * 100).toFixed(1).replace('.', ',') + '%' : '—';
    const linhaTipo = (g, rec) => {
      const k = (rec ? 'r|' : 'g|') + g.tipo, ab = !!ST.dreAberto[k], cor1 = rec ? 'var(--teal)' : '#dc2626';
      let h = '<tr style="cursor:pointer" onclick="kcbmPf.dreAbrir(\'' + k.replace(/'/g, "\\'") + '\')">' + td('<span style="font-size:11px">' + (ab ? '▼' : '▶') + '</span> ' + E(g.tipo)) + td('<span style="color:' + cor1 + '">' + R$(rec ? g.mes : -g.mes) + '</span>', 1) + td('<b style="color:' + cor1 + '">' + R$(rec ? g.acum : -g.acum) + '</b>', 1) + td('<span style="color:var(--slate)">' + pct(g.acum, rec ? totRecA : totRecA) + '</span>', 1) + '</tr>';
      if (ab) h += '<tr><td colspan="4" style="padding:0;background:rgba(127,127,127,.07)"><div style="padding:6px 12px 10px 30px"><table style="width:100%;border-collapse:collapse">' + g.linhas.map(m => '<tr>' + td(br(m.data)) + td(E(m.nome) + seloPorQuem({ porQuem: m.porQuem })) + td(m.pago ? (m.rec ? 'recebido' : 'pago') : '<span style="color:var(--slate)">em aberto</span>') + td(R$(rec ? m.valor : -m.valor), 1) + '</tr>').join('') + '</table></div></td></tr>';
      return h;
    };
    const sec = (titulo, cor1, total, totalM, lin) => '<tr style="background:rgba(127,127,127,.14)"><td style="' + TD + ';font-weight:800">' + titulo + '</td><td style="' + TD + ';text-align:right;font-weight:800;color:' + cor1 + '">' + R$(totalM) + '</td><td style="' + TD + ';text-align:right;font-weight:800;color:' + cor1 + '">' + R$(total) + '</td><td style="' + TD + '"></td></tr>' + lin;
    const resA = (cents(totRecA) - cents(totGasA)) / 100, resM = (cents(totRecM) - cents(totGasM)) / 100;
    const corpo = sec('RECEITAS', 'var(--teal)', totRecA, totRecM, gr.map(g => linhaTipo(g, true)).join('') || '<tr><td colspan="4" style="' + TD + ';color:var(--slate)">Nenhuma receita no período.</td></tr>')
      + sec('GASTOS', '#dc2626', -totGasA, -totGasM, gg.map(g => linhaTipo(g, false)).join('') || '<tr><td colspan="4" style="' + TD + ';color:var(--slate)">Nenhum gasto no período.</td></tr>')
      + '<tr style="background:rgba(127,127,127,.22)"><td style="' + TD + ';font-weight:800">RESULTADO (receitas − gastos)</td><td style="' + TD + ';text-align:right;font-weight:800;color:' + (resM < 0 ? '#dc2626' : '#16a34a') + '">' + R$(resM) + '</td><td style="' + TD + ';text-align:right;font-weight:800;color:' + (resA < 0 ? '#dc2626' : '#16a34a') + '">' + R$(resA) + '</td><td style="' + TD + ';text-align:right;color:var(--slate)">' + pct(resA, totRecA) + ' da receita</td></tr>';
    const chip = (k, t) => '<button class="btn ' + (ST.dreModo === k ? 'bp' : 'bo') + ' bsm" onclick="kcbmPf.dreModo(\'' + k + '\')">' + t + '</button>';
    const mesRot = MESES[+ref.slice(5, 7) - 1].replace(/^./, c => c.toUpperCase());
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:1.1rem">DRE — até ' + mesRot + ' de ' + ref.slice(0, 4) + '</b>' + chip('ano', 'Acumulado no ano (jan a ' + ref.slice(5, 7) + ')') + chip('tudo', 'Desde o início') + '</div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:10px">Receitas e gastos por <b>tipo</b>. A coluna "No mês" é só o mês do topo; "Acumulado" soma ' + (tudo ? 'tudo desde o primeiro lançamento' : 'de janeiro até o mês do topo') + '. Conta pela data de vencimento. Clique no tipo para ver os lançamentos. Mude o mês pelas setas lá em cima.</div>'
      + '<div style="overflow:auto;border:1px solid var(--border);border-radius:8px"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="' + TH + '">Tipo</th><th style="' + TH + ';text-align:right">No mês</th><th style="' + TH + ';text-align:right">Acumulado</th><th style="' + TH + ';text-align:right">% da receita</th></tr></thead><tbody>' + corpo + '</tbody></table></div>';
  }
  // ── Empréstimos, Financiamentos e Parcelamentos ──
  // Cada contrato gera lançamentos normais: as parcelas viram contas a pagar (1ª no vencimento escolhido, as outras mês a mês) e, no empréstimo, o dinheiro que entra vira uma conta a receber na data de entrada.
  // Por isso tudo aparece na Movimentação, no Saldo e na DRE, no mês certo.
  const CONTRATO = {
    emprestimo: { tit: 'Empréstimos', un: 'empréstimo', ic: '🤝', ajuda: 'Dinheiro que você pegou emprestado. Ao adicionar, o valor recebido entra como receita na data informada e as parcelas viram contas a pagar nos meses seguintes.' },
    financiamento: { tit: 'Financiamentos', un: 'financiamento', ic: '🏠', ajuda: 'Compras financiadas (carro, apartamento…). Escolha o tipo de gasto; cada parcela entra na Movimentação no mês certo.' },
    parcelamento: { tit: 'Parcelamentos', un: 'parcelamento', ic: '🧩', ajuda: 'Dívidas ou compras que você parcelou (por exemplo, a fatura de um cartão). Cada parcela entra na Movimentação no mês certo.' }
  };
  const FORMAS_PAG = [['Boleto', 'Boleto'], ['Débito automático', 'Débito automático'], ['Pix', 'Pix'], ['Carnê', 'Carnê'], ['Outro', 'Outro']];
  function resumoContrato(d, c) {
    const it = (d.pagar || []).find(x => x.id === c.pagarId); if (!it) return null;
    const todos = [it].concat([c.jurosId, c.iofId].map(id => id && (d.pagar || []).find(x => x.id === id)).filter(Boolean)), ps = todos.reduce((a, x) => a.concat(x.parcelas || []), []);
    const pagas = (it.parcelas || []).filter(p => p.pago), abertas = ps.filter(p => !p.pago).sort((a, b) => a.venc.localeCompare(b.venc));
    return { it, n: (it.parcelas || []).length, pagas: pagas.length, aberto: abertas.reduce((a, p) => a + cents(p.valor), 0) / 100, prox: abertas[0] ? abertas[0].venc : '', total: ps.reduce((a, p) => a + cents(p.valor), 0) / 100, quitado: !abertas.length };
  }
  function abaContratos(d, tipo) {
    const cfg = CONTRATO[tipo], lista = (d.contratos || []).filter(c => c.tipo === tipo).map(c => ({ c, r: resumoContrato(d, c) })).filter(x => x.r);
    const emp = tipo === 'emprestimo', par = tipo === 'parcelamento', cols = [{ t: 'Credor' }].concat(emp ? [{ t: 'Recebido', r: 1 }, { t: 'Entrou em' }] : par ? [{ t: 'Dívida quitada', r: 1 }, { t: 'Juros + IOF', r: 1 }] : [{ t: 'Tipo' }]).concat([{ t: 'Total a pagar', r: 1 }, { t: 'Parcelas' }, { t: 'Em aberto', r: 1 }, { t: 'Próx. vencimento' }, { t: '' }]);
    const linhas = lista.sort((a, b) => (b.c.criado || 0) - (a.c.criado || 0)).map(({ c, r }) => '<tr>' + td('<b>' + E(c.credor) + '</b>' + (c.desc ? '<div style="font-size:11px;color:var(--slate)">' + E(c.desc) + '</div>' : ''))
      + (emp ? td('<span style="color:var(--teal)">' + R$(c.principal) + '</span>', 1) + td(br(c.dataEntrada) + (c.bancoId ? '<div style="font-size:11px;color:var(--slate)">' + E(((d.bancos || []).find(b => b.id === c.bancoId) || {}).nome || '') + '</div>' : '')) : par ? td(R$(c.divida || 0), 1) + td('<span style="color:#dc2626">' + R$((Number(c.juros) || 0) + (Number(c.iof) || 0)) + '</span>', 1) : td(E(c.tipoGasto || '')))
      + td(R$(r.total), 1) + td(r.pagas + '/' + r.n + (r.quitado ? ' <span style="color:var(--teal)">✔ quitado</span>' : '')) + td('<b style="color:' + (r.aberto > 0.004 ? '#dc2626' : 'var(--teal)') + '">' + R$(r.aberto) + '</b>', 1) + td(r.prox ? br(r.prox) : '—')
      + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + B('Parcelas', "kcbmPf.tituloVer('pagar','" + c.pagarId + "')") + ' ' + B('🗑', "kcbmPf.contratoExcluir('" + c.id + "')", 'bo', 'Excluir este ' + cfg.un) + '</td></tr>');
    const totAberto = lista.reduce((a, x) => a + cents(x.r.aberto), 0) / 100;
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:1.1rem">' + cfg.ic + ' ' + cfg.tit + '</b><span style="font-size:12.5px;color:var(--slate)">Em aberto: <b style="color:#dc2626">' + R$(totAberto) + '</b></span><div style="margin-left:auto">' + B('+ Adicionar ' + cfg.un, "kcbmPf.contratoForm('" + tipo + "')", 'bp') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:10px">' + cfg.ajuda + '</div>'
      + tabela(cols, linhas, 'Nenhum ' + cfg.un + ' cadastrado ainda. Clique em "+ Adicionar ' + cfg.un + '".');
  }
  function abaAcumulado(d) {
    const mov = movimentosAno(d), anoHoje = +hoje().slice(0, 4), ini = Math.min(2026, anoHoje, ...mov.map(m => +m.data.slice(0, 4)).filter(n => n > 1990)), fim = Math.max(anoHoje + 4, ...mov.map(m => +m.data.slice(0, 4)));
    let acum = 0, html = '';
    for (let ano = ini; ano <= fim; ano++) {
      const ms = mov.filter(m => +m.data.slice(0, 4) === ano), rec = ms.filter(m => m.rec).reduce((a, m) => a + cents(m.valor), 0) / 100, gas = ms.filter(m => !m.rec).reduce((a, m) => a + cents(m.valor), 0) / 100, res = (cents(rec) - cents(gas)) / 100;
      acum = (cents(acum) + cents(res)) / 100;
      const aberto = !!ST.acumAberto[ano];
      html += '<tr style="cursor:pointer;font-weight:600" onclick="kcbmPf.acumAbrir(\'' + ano + '\')">' + td('<span style="font-size:11px">' + (aberto ? '▼' : '▶') + '</span> <b>' + ano + '</b>')
        + td('<span style="color:var(--teal)">' + R$(rec) + '</span>', 1) + td('<span style="color:#dc2626">' + R$(-gas) + '</span>', 1) + td('<span style="color:' + cor(res) + '">' + R$(res) + '</span>', 1) + td('<b style="color:' + cor(acum) + '">' + R$(acum) + '</b>', 1) + '</tr>';
      if (aberto) {
        let det = '';
        for (let m = 1; m <= 12; m++) {
          const mes = ano + '-' + p2(m), li = ms.filter(x => x.data.slice(0, 7) === mes).sort((a, b) => a.data.localeCompare(b.data) || (a.rec === b.rec ? 0 : a.rec ? -1 : 1)); if (!li.length) continue;
          const r2 = li.filter(x => x.rec).reduce((a, x) => a + cents(x.valor), 0) / 100, g2 = li.filter(x => !x.rec).reduce((a, x) => a + cents(x.valor), 0) / 100;
          det += '<tr style="background:rgba(127,127,127,.12)"><td colspan="4" style="' + TD + ';font-weight:700">' + rotMes(mes) + '</td><td style="' + TD + ';text-align:right;white-space:nowrap">Receitas <b style="color:var(--teal)">' + R$(r2) + '</b> · Gastos <b style="color:#dc2626">' + R$(-g2) + '</b> · Resultado <b>' + R$((cents(r2) - cents(g2)) / 100) + '</b></td></tr>'
            + li.map(x => '<tr>' + td(br(x.data)) + td(x.rec ? '<span style="color:var(--teal)">Receita</span>' : '<span style="color:#dc2626">Gasto</span>') + td(E(x.nome) + seloPorQuem({ porQuem: x.porQuem })) + td(x.pago ? (x.rec ? 'recebido' : 'pago') : '<span style="color:var(--slate)">em aberto</span>') + td('<span style="color:' + (x.rec ? 'var(--teal)' : '#dc2626') + '">' + R$(x.rec ? x.valor : -x.valor) + '</span>', 1) + '</tr>').join('');
        }
        html += '<tr><td colspan="5" style="padding:0;background:rgba(127,127,127,.06)"><div style="padding:6px 12px 12px 30px">' + (det ? '<table style="width:100%;border-collapse:collapse"><tr><th style="' + TD + ';text-align:left">Data</th><th style="' + TD + ';text-align:left">Tipo</th><th style="' + TD + ';text-align:left">Quem pagou / a quem paguei</th><th style="' + TD + ';text-align:left">Situação</th><th style="' + TD + ';text-align:right">Valor</th></tr>' + det + '</table>' : '<div style="color:var(--slate);font-size:12.5px;padding:8px">Sem movimento neste ano.</div>') + '</div></td></tr>';
      }
    }
    return '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Resultado acumulado ano a ano (receitas − gastos). Clique no ano para ver o movimento mês a mês. Conta pela data de vencimento; compra no cartão entra na data da fatura. Um ano novo abre sozinho quando o calendário virar.</div>'
      + tabela([{ t: 'Ano' }, { t: 'Receitas', r: 1 }, { t: 'Gastos', r: 1 }, { t: 'Resultado do ano', r: 1 }, { t: 'Acumulado', r: 1 }], [html], '', true);
  }
  // ── Notas fiscais (NFC-e / NF-e): anexar, produtos, fornecedor, forma de pagamento e análise por produto ──
  const normP = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/ +/g, ' ').trim();
  // Nomes padrão de produtos já vistos nas suas notas (a descrição da nota -> nome seu). O que você nomear na tela da nota tem prioridade.
  const NF_SEMENTE = {"abacx perola unidade": "Abacaxi", "achoc po 3 coracoe c": "Chocolate", "acucar ref barra 1kg": "Açúcar Barra", "acucar ref uniao 1kg": "Açúcar União", "acucar uniao pct 1k": "Açúcar União", "ag c gas crystal 500": "Água mineral com gás", "agua min c gas cryst": "Água mineral com gás", "agua san crfo 2l": "Água sanitária", "agua sanitaria olimp": "Água sanitária", "agua sanitaria rajja": "Água sanitária", "alface crespa crfo m": "Alface", "alho granel": "Alho", "amac conc downy bris": "Amaciante", "amac conc downy fres": "Amaciante", "amac plush elegance": "Amaciante", "amac tuff plus azul": "Amaciante", "arroz ag solit 5k": "Arroz Solito", "arroz branco crf cla": "Arroz Carrefour", "arroz tp1 camil 5kg": "Arroz Camil", "arroz tp1 crfo 5kg": "Arroz Carrefour", "azeit vde 80g": "Azeite", "azeite ev espanhol v": "Azeite", "bacon peca seara": "Bacon", "bala de gelatina mor": "Gelatina e balas", "bala de gelatina wum": "Gelatina e balas", "bala gela tubes mor": "Gelatina e balas", "bala gelat haribo me": "Gelatina e balas", "banana nanica crf kg": "Banana", "batat newbraz 1 5k": "Batata", "batata elma chips ru": "Batata", "batata monalisa crfo": "Batata", "beb lac polpa caroli": "Leite condensado / lácteos", "bebida lactea italac": "Leite condensado / lácteos", "bife vazio cg sw 1kg": "Carne bovina", "bis pir mrg 76 grama": "Biscoitos", "bisc ch piraque 85g": "Biscoitos", "bisc coco marilan 30": "Biscoitos", "bisc dc lt piraqu 85": "Biscoitos", "bisc rech red adria": "Biscoitos", "bisc tort adria cho": "Biscoitos", "biscoito recheado ne": "Biscoitos", "bisteca fatias cong": "Bisteca suína", "bolo decorado": "Outros", "bucha banho crf soft": "Esponja e utensílios de limpeza", "c mole bov bife kg": "Carne bovina", "cafe almof ext forte": "Café Extra Forte", "cafe almof pilao 500": "Café Pilão", "cafe t m pilao 500g": "Café Pilão", "cald sazon bac 32 5g": "Temperos", "carne moida frango c": "Frango (inteiro/passarinho)", "carne moida paleta": "Carne bovina", "carne moida patinho": "Carne bovina", "cebola crfo kg": "Cebola", "cebola granel kg": "Cebola", "cenoura crfo kg": "Cenoura", "chin ip an surf 0906": "Outros", "choc bis lacta ao le": "Chocolate", "choc tab nestle clas": "Chocolate", "choc tab rech nestle": "Chocolate", "choco biscuit 80g": "Biscoitos", "coador m 102 c 30": "Esponja e utensílios de limpeza", "coentro crfo mercado": "Coentro", "coxa fgo swift 1kg": "Coxa/sobrecoxa de frango", "cr trat skg coco 1k": "Shampoo e condicionador", "creme avela crf orig": "Chocolate", "creme leite uht pira": "Leite integral longa vida", "crm dent colgate tri": "Higiene pessoal", "deo rollon dove 50ml": "Higiene pessoal", "desod sanit past pat": "Higiene pessoal", "det po brilhan 2 2kg": "Sabão em pó / lava-roupas", "det ype 500ml": "Detergente", "deterg ype 500ml": "Detergente", "doce leite tra gota": "Leite condensado / lácteos", "empan fgo tekitos se": "Empanado de frango", "ervi quero lt 170g": "Milho/ervilha/seleta", "esc dental oralb ind": "Higiene pessoal", "escova sanitaria san": "Esponja e utensílios de limpeza", "esp bombril multl4p3": "Esponja e utensílios de limpeza", "esp m uso l4p3": "Esponja e utensílios de limpeza", "espag 5 adria 500g": "Macarrão espaguete", "fa mand tem yokg 400": "Farofa pronta", "far mil tem yokg 400": "Farofa pronta", "farofa pronta milho": "Farofa pronta", "farofa pronta yoki 4": "Farofa pronta", "feij carioca nene t1": "Feijão carioca Nenê", "feijao carioca da ca": "Feijão carioca Da Casa", "feijao carioca pante": "Feijão carioca Pantera", "fgo a pas swift 1 kg": "Frango (inteiro/passarinho)", "file de peito cong s": "Filé de peito de frango", "file merluza swift": "Filé de merluza", "file peito fgo resf": "Filé de peito de frango", "fuba mimoso yoki 500": "Fubá", "gelat sol fram 20g": "Gelatina e balas", "gelatina cereja 20g": "Gelatina e balas", "gelatina limao 20g": "Limão", "gelatina mor 20g": "Gelatina e balas", "gelatina po morango": "Gelatina e balas", "gelatina uva 20g": "Uva", "hamb ave bov per672g": "Hambúrguer", "hamb bov seara 672g": "Hambúrguer", "hamb perdi 672g": "Hambúrguer", "hamburguer texas bur": "Hambúrguer", "ket heinz 1 033kg": "Ketchup Heinz", "ketchup cepera": "Ketchup", "ketchup hemmer 750g": "Ketchup Hemmer", "ketchup trad topdown": "Ketchup", "la de aco lustro 6 u": "Esponja e utensílios de limpeza", "lasanha c ovos 500g": "Lasanha", "lava roupa po brilha": "Sabão em pó / lava-roupas", "lava roupa po conc t": "Sabão em pó / lava-roupas", "lava roupa po conc u": "Sabão em pó / lava-roupas", "leite l vida integra": "Leite integral longa vida", "leite uht int parmal": "Leite integral longa vida", "limao tahiti crf kg": "Limão", "limp deseng crf esse": "Desengordurante / limpeza", "ling cal cur perd kg": "Linguiça", "ling tipo calabresa": "Linguiça", "linguica calabr 500g": "Linguiça", "linguica de pernil": "Linguiça", "linguica toscana swi": "Linguiça", "lte ferm bob esponja": "Leite condensado / lácteos", "lte ferm chamyto tra": "Leite condensado / lácteos", "m lac crm lte m 200g": "Creme de leite", "mac inst express ren": "Macarrão instantâneo", "mac semola c ovo esp": "Macarrão espaguete", "mac semola c ovos pa": "Macarrão espaguete", "mac semola c ovos pe": "Macarrão espaguete", "macarrao inst carref": "Macarrão instantâneo", "maion hell quei 335g": "Maionese Hellmanns", "maionese hellmanns 5": "Maionese Hellmanns", "maionese quero 495g": "Maionese Quero", "maionese quero sc 20": "Maionese Quero", "marg qualy crem c s": "Margarina Qualy", "margarina qualy c sa": "Margarina Qualy", "md tubete cg sw 500g": "Carne bovina", "melancia premium crf": "Melancia", "milho fugini sache 1": "Milho/ervilha/seleta", "milho pipoca yoki 40": "Milho/ervilha/seleta", "milho quero lt 170g": "Milho/ervilha/seleta", "mist lac c m tp 395g": "Leite condensado / lácteos", "mistura creme de lei": "Leite condensado / lácteos", "mlh tmt trd qro 240g": "Molho de tomate Quero", "molho pimenta cala a": "Molhos (pimenta/mostarda)", "molho pimenta srirac": "Molhos (pimenta/mostarda)", "molho tom crf classi": "Molho de tomate Carrefour", "molho tomate hemmer": "Molho de tomate Hemmer", "molho tomate so frut": "Molho de tomate Sofrut", "monange cond boost c": "Shampoo e condicionador", "mostarda hellm 250g": "Molhos (pimenta/mostarda)", "oleo soja confiare": "Óleo de soja", "oleo soja vitaliv": "Óleo de soja", "oleo soya pet": "Óleo de soja", "oregano da terrinha": "Temperos", "oregano kitano 10g": "Temperos", "ovo codorna katayama": "Ovo de codorna", "ovo gde branco bulne": "Ovos brancos (dúzia)", "pack crm dent colgat": "Higiene pessoal", "packg cc ftlrn 2l": "Refrigerante", "packg ob 3d whitel": "Higiene pessoal", "papel higienico crf": "Papel higiênico", "papel toalha 2un 120": "Papel toalha", "papel toalha carrefo": "Papel toalha", "peito de frango desf": "Filé de peito de frango", "ph personal vip fd": "Papel higiênico", "pimentao verm estufa": "Pimentão", "pv cenoura 1kg": "Cenoura", "qa batata cong 1 5kg": "Batata congelada", "qa batata p qa 500g": "Batata", "qa oleo soja 900ml": "Óleo de soja", "qa toalha pap c 2": "Papel toalha", "qa uva clara 500g": "Uva", "queijo parmesao rala": "Queijo ralado", "queijo ralado mococa": "Queijo ralado", "ref maracu tang 18g": "Refresco em pó", "ref po tang uva 18g": "Uva", "ref tang moran 18g": "Refresco em pó", "refres po tang azul": "Refresco em pó", "refres po tang limao": "Limão", "refresco po frisco a": "Refresco em pó", "refresco po frisco c": "Refresco em pó", "refresco po frisco l": "Refresco em pó", "refresco po frisco m": "Refresco em pó", "refresco po frisco s": "Refresco em pó", "refresco po frisco t": "Refresco em pó", "refresco po frisco u": "Refresco em pó", "refri fanta 2l": "Refrigerante", "refri sukita 2l": "Refrigerante", "refrig coca cola ori": "Refrigerante", "refrig pepsi cola pe": "Refrigerante", "refrig sprite origin": "Refrigerante", "requeijao crem crf c": "Requeijão", "rosquinha chocolate": "Biscoitos", "rosquinha leite crf": "Biscoitos", "sab barra palmolive": "Sabonete", "sab barra ype fl mac": "Sabão em barra", "sab lux 85g orquid": "Sabonete", "sab lux 85g rosas": "Sabonete", "sab lux glice oleo d": "Sabonete", "sabao b min 800g 5un": "Sabão em barra", "sabao barra crf esse": "Sabão em barra", "sacola cinz 48x55": "Sacola plástica", "sacola plast valfilm": "Sacola plástica", "sal lebre pct 1k": "Sal refinado", "sal refinado 1kg": "Sal refinado", "sal rosa fino bombay": "Sal rosa fino", "salg cheetos elma ch": "Salgadinho", "salg fandangos elma": "Salgadinho", "sardinha ralada molh": "Sardinha", "sassami swift 1kg": "Sassami de frango", "seleta legumes quero": "Milho/ervilha/seleta", "sh 300ml cond 190ml": "Shampoo e condicionador", "sh monange quimica s": "Shampoo e condicionador", "sh cond skg coco 325": "Shampoo e condicionador", "sobrecoxa de frango": "Coxa/sobrecoxa de frango", "sorvete perfetto var": "Sorvete", "sprite orig 600ml": "Refrigerante", "tapioca crfo 500g": "Tapioca", "temperafacil nordest": "Temperos", "uva vitoria 500g": "Uva", "vela estrela c 4": "Outros", "vela palito esp rsa": "Outros"};
  const PQ_SEMENTE = [["Tomate", 1, "kg"], ["Farofa de milho", 400, "g"], ["Mostarda", 200, "g"], ["Abacaxi", 1, "un"], ["Alface", 1, "un"], ["Alho", 1, "kg"], ["Amaciante", 2, "L"], ["Arroz branco tipo 1", 5, "kg"], ["Azeite de oliva", 500, "ml"], ["Açúcar refinado", 1, "kg"], ["Bacon", 1, "kg"], ["Banana", 1, "kg"], ["Batata", 1, "kg"], ["Batata congelada", 1.5, "kg"], ["Biscoitos", 1, "un"], ["Bisteca suína", 1, "kg"], ["Café torrado e moído", 500, "g"], ["Carne bovina (moída/bife)", 1, "kg"], ["Cebola", 1, "kg"], ["Cenoura", 1, "kg"], ["Chocolate", 1, "un"], ["Coentro", 1, "un"], ["Coxa e sobrecoxa de frango", 1, "kg"], ["Creme de leite", 200, "g"], ["Creme dental", 90, "g"], ["Desengordurante", 500, "ml"], ["Detergente", 500, "ml"], ["Empanado de frango", 300, "g"], ["Esponja de limpeza", 1, "un"], ["Farofa pronta", 400, "g"], ["Feijão carioca", 1, "kg"], ["Filé de merluza", 1, "kg"], ["Filé de peito de frango", 1, "kg"], ["Frango inteiro", 1, "kg"], ["Fubá", 500, "g"], ["Gelatina em pó", 20, "g"], ["Hambúrguer", 672, "g"], ["Ketchup", 1, "kg"], ["Leite condensado", 395, "g"], ["Leite integral longa vida", 1, "L"], ["Limão", 1, "kg"], ["Linguiça (toscana/calabresa)", 1, "kg"], ["Macarrão espaguete", 500, "g"], ["Macarrão instantâneo", 80, "g"], ["Maionese", 500, "g"], ["Margarina", 500, "g"], ["Massa de lasanha", 500, "g"], ["Melancia", 1, "kg"], ["Milho, ervilha e seleta de legumes", 170, "g"], ["Molho de tomate", 340, "g"], ["Molhos e condimentos", 250, "g"], ["Ovo de codorna", 1, "un"], ["Ovos", 12, "un"], ["Papel higiênico", 12, "un"], ["Papel toalha", 2, "un"], ["Pimentão", 1, "kg"], ["Queijo ralado", 50, "g"], ["Refresco em pó", 18, "g"], ["Refrigerante", 2, "L"], ["Requeijão cremoso", 200, "g"], ["Sabonete", 85, "g"], ["Sabão em barra", 5, "un"], ["Sabão em pó", 1, "kg"], ["Sacola plástica", 1, "un"], ["Sal refinado", 1, "kg"], ["Sal rosa fino", 1, "kg"], ["Salgadinho", 1, "un"], ["Sardinha em lata", 125, "g"], ["Sassami de frango", 1, "kg"], ["Shampoo", 325, "ml"], ["Sorvete", 1, "un"], ["Tapioca", 500, "g"], ["Temperos", 1, "un"], ["Uva", 500, "g"], ["Água mineral", 500, "ml"], ["Água sanitária", 2, "L"], ["Óleo de soja", 900, "ml"]];
  const prodDe = (d, desc) => (d.produtos || {})[normP(desc)] || NF_SEMENTE[normP(desc)] || '';
  const num2 = v => Math.round((Number(v) || 0) * 100) / 100;
  function nfLerXml(txt) {
    const doc = new DOMParser().parseFromString(txt, 'text/xml'); if (doc.getElementsByTagName('parsererror').length) return null;
    const inf = doc.getElementsByTagName('infNFe')[0]; if (!inf) return null;
    const t = (el, tag) => { const x = el && el.getElementsByTagName(tag)[0]; return x ? x.textContent.trim() : ''; };
    const emit = inf.getElementsByTagName('emit')[0], ide = inf.getElementsByTagName('ide')[0], tot = inf.getElementsByTagName('ICMSTot')[0];
    const itens = [].slice.call(inf.getElementsByTagName('det')).map(det => { const pr = det.getElementsByTagName('prod')[0]; return { desc: t(pr, 'xProd'), qtd: +t(pr, 'qCom') || 0, un: t(pr, 'uCom'), vu: +t(pr, 'vUnCom') || 0, vt: num2(+t(pr, 'vProd') || 0), grupo: '' }; });
    return { data: (t(ide, 'dhEmi') || t(ide, 'dEmi')).slice(0, 10), fornecedor: t(emit, 'xFant') || t(emit, 'xNome'), razao: t(emit, 'xNome'), cnpj: t(emit, 'CNPJ'), chave: (inf.getAttribute('Id') || '').replace(/^NFe/, ''), desconto: num2(+t(tot, 'vDesc') || 0), total: +t(tot, 'vNF') || itens.reduce((a, x) => a + x.vt, 0), itens, origem: 'xml' };
  }
  async function nfLerPdf(buf) {
    if (typeof pdfjsLib === 'undefined') await new Promise(res => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; sc.onload = res; sc.onerror = res; document.head.appendChild(sc); });
    if (typeof pdfjsLib === 'undefined') return null;
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise, linhas = [];
    for (let pg = 1; pg <= pdf.numPages; pg++) { const tc = await (await pdf.getPage(pg)).getTextContent(), mapa = {};
      tc.items.forEach(i => { const y = Math.round(i.transform[5] / 3); (mapa[y] = mapa[y] || []).push({ x: i.transform[4], s: i.str }); });
      Object.keys(mapa).map(Number).sort((a, b) => b - a).forEach(y => linhas.push(mapa[y].sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/ +/g, ' ').trim())); }
    return nfDeLinhas(linhas.filter(Boolean), 'pdf');
  }
  async function nfLerImg(arq) {
    if (typeof Tesseract === 'undefined') await new Promise(res => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js'; sc.onload = res; sc.onerror = res; document.head.appendChild(sc); });
    if (typeof Tesseract === 'undefined') return null;
    const r = await Tesseract.recognize(arq, 'por'), L = String(r.data.text || '').split('\n').map(x => x.replace(/ +/g, ' ').trim()).filter(Boolean);
    return nfDeLinhas(L, 'ocr');
  }
  function nfDeLinhas(L, origem) {
    const txt = L.join('\n'), mnum = s => +String(s).replace(/\./g, '').replace(',', '.') || 0;
    const sp = /V[Il1]\.?\s*Unit/i.test(txt) && /C[oó]digo:/i.test(txt);
    const md = (sp ? /Emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(txt) : null) || /(\d{2})\/(\d{2})\/(\d{4})/.exec(txt), mt = /valor\s*a\s*pagar[^0-9\n]*([\d.]+,\d{2})/i.exec(txt) || /(?:valor\s*total|total\s*r\$)[^0-9\n]*([\d.]+,\d{2})/i.exec(txt), mc = /(\d{44})/.exec(txt.replace(/(\d) (?=\d)/g, '$1')), mcn = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/.exec(txt);
    const forn = (L.find(l => /[A-Za-zÀ-ú]{4}/.test(l) && !/danfe|nfc-?e|nota fiscal|documento auxiliar|cnpj|consumidor/i.test(l)) || '').slice(0, 80);
    const itens = [];
    if (sp) L.forEach((l, i) => { const a = /^(.+?)\s*\(C[oó]digo:?\s*[A-Za-z0-9]+\s*\)/i.exec(l), b = a && /Qtde\.?:?\s*([\d.,]+)\s*[—–-]?\s*UN:?\s*(\S+?)\s*[—–-]?\s*V[Il1]\.?\s*Unit\.?:?\s*([\d.,]+)\s+([\d.,]+)/i.exec(L[i + 1] || ''); if (b) itens.push({ desc: a[1].trim(), qtd: mnum(b[1]), un: b[2].replace(/\d+$/, '').toUpperCase(), vu: mnum(b[3]), vt: mnum(b[4]), grupo: '' }); });
    else L.forEach(l => { const m = /^(?:\d{1,14}\s+)?(.+?)\s+([\d.,]+)\s*(UN|UND|KG|LT|L|PC|PCT|CX|G|ML|FD|DZ|M)\s*(?:x|X)?\s*([\d.,]+)\s+([\d.,]+)$/.exec(l); if (m && /[A-Za-z]{3}/.test(m[1])) itens.push({ desc: m[1].trim(), qtd: mnum(m[2]), un: m[3].toUpperCase(), vu: mnum(m[4]), vt: mnum(m[5]), grupo: '' }); });
    return { data: md ? md[3] + '-' + md[2] + '-' + md[1] : '', fornecedor: forn, razao: forn, cnpj: mcn ? mcn[1].replace(/\D/g, '') : '', chave: (/chNFe=(\d{44})/.exec(txt) || mc || [])[1] || '', desconto: (/descontos?\s*r\$:?\s*([\d.]+,\d{2})/i.exec(txt) || [])[1] ? mnum(/descontos?\s*r\$:?\s*([\d.]+,\d{2})/i.exec(txt)[1]) : 0, total: mt ? mnum(mt[1]) : itens.reduce((a, x) => a + x.vt, 0), itens, origem };
  }
  const fmtCnpjNf = c => { const x = String(c || '').replace(/\D/g, ''); return x.length === 14 ? x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : x; };
  const chaveForn = n => { const c = String(n.cnpj || '').replace(/\D/g, ''); return c.length === 14 ? 'c' + c : 'n' + normP(n.fornecedor || ''); };
  const nfRotPg = (d, n) => { const g = n.pg || {}; if (g.tipo === 'cartao') { const c = (d.cartoes || []).find(x => x.id === g.cartaoId); return '💳 ' + E(c ? c.nome : 'cartão'); } if (g.tipo === 'vinculo') return '🔗 vinculada a um lançamento'; if (g.tipo === 'extrato') return '🏦 extrato bancário'; if (g.tipo === 'dinheiro') return '💵 dinheiro / outro'; return '<span style="color:#dc2626">sem pagamento</span>'; };
  // ── Pesquisa de mercado: lista padrão (produto/marca × mercado) e lista do mês agrupada por mercado ──
  const pqUn = (q, u) => { const x = String(u || '').toLowerCase(), k = Number(q) || 0; if (!k) return null; if (x === 'kg') return { f: k, u: 'kg' }; if (x === 'g') return { f: k / 1000, u: 'kg' }; if (x === 'l' || x === 'lt') return { f: k, u: 'L' }; if (x === 'ml') return { f: k / 1000, u: 'L' }; return null; };
  const pqBase = d => { d.pesq = d.pesq || { mercados: [], produtos: [] }; d.pesq.mercados = d.pesq.mercados || []; d.pesq.produtos = d.pesq.produtos || []; return d.pesq; };
  const pqPorKg = (p, preco) => { const c = pqUn(p.qtd, p.un); return c && preco > 0 ? R$(preco / c.f) + '/' + c.u : ''; };
  const PQ_GRUPOS = ['Carnes, aves e peixes', 'Hortifruti', 'Mercearia', 'Laticínios, ovos e frios', 'Bebidas', 'Limpeza', 'Higiene pessoal'];
  const pqGrupoAuto = nm => { const x = norm(nm); if (/frango|carne|bisteca|bacon|lingui|hamburguer|empanado|merluza|sardinha|sassami|coxa|peixe|bovin|suin/.test(x)) return PQ_GRUPOS[0]; if (/abacaxi|alface|^alho|banana|^batata( inglesa| comum)?$|cebola|cenoura|coentro|limao|melancia|pimentao|^uva|^tomate/.test(x)) return PQ_GRUPOS[1]; if (/leite|creme de leite|requeij|queijo|margarina|^ovo|iogurte|manteiga/.test(x)) return PQ_GRUPOS[3]; if (/refriger|agua mineral|refresco|suco|cerveja/.test(x)) return PQ_GRUPOS[4]; if (/amaciante|desengord|detergente|esponja|sabao|agua sanitaria|papel toalha|sacola|desinf|limpa/.test(x)) return PQ_GRUPOS[5]; if (/creme dental|shampoo|sabonete|papel higien|desodor|condicion/.test(x)) return PQ_GRUPOS[6]; return PQ_GRUPOS[2]; };
  const pqGr = p => p.grupo || pqGrupoAuto(p.produto);
  const pqGrupos = P => (P.grupos && P.grupos.length) ? P.grupos : PQ_GRUPOS.map(n => ({ nome: n, cor: '' }));
  const pqGBg = (P, g) => { const c = ((pqGrupos(P).find(x => x.nome === g)) || {}).cor; return c ? 'color-mix(in srgb,' + c + ' 20%,var(--bg))' : 'var(--bg)'; };
  const pqOrd = P => P.produtos.slice().sort((a, b) => { const gl = pqGrupos(P).map(g => g.nome), ga = pqGr(a), gb = pqGr(b), ia = gl.indexOf(ga), ib = gl.indexOf(gb); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || ga.localeCompare(gb, 'pt-BR') || a.produto.localeCompare(b.produto, 'pt-BR') || (a.marca || '').localeCompare(b.marca || '', 'pt-BR'); });
  const pqAgora = t => { const x = t ? new Date(t) : new Date(), p2 = n => String(n).padStart(2, '0'); return p2(x.getDate()) + '/' + p2(x.getMonth() + 1) + '/' + x.getFullYear() + ' ' + p2(x.getHours()) + ':' + p2(x.getMinutes()); };
  // menor preço já pesquisado (em qualquer mercado) no momento em que o item entra na lista — fica guardado: pesquisas novas não mudam listas antigas
  const pqRef = (P, p) => { let b = null; (P.mercados || []).forEach(m => { const x = (p.precos || {})[m.id]; if (x && x.preco > 0 && (!b || x.preco < b.p)) b = { p: x.preco, m: m.nome, d: x.data }; }); return b; };
  const pqNomeP = p => p.produto + (p.marca ? ' ' + p.marca : '');
  const pqToks = s => normP(s).split(' ').filter(w => w.length > 2 && !/^(com|sem|para|tipo|pct|pacote|cx|caixa|und|unid|kg|ml|lt)$/.test(w));
  const pqSim = (a, b) => { const A = pqToks(a), B = pqToks(b); if (!A.length || !B.length) return 0; const bs = new Set(B); const inter = A.filter(w => bs.has(w) || B.some(v => v.length > 3 && (v.indexOf(w) === 0 || w.indexOf(v) === 0))).length; return inter / Math.min(A.length, B.length); };
  const pqListaTot = L => (L.itens || []).reduce((a, it) => a + (Number(it.qtd) || 0) * (Number(it.pu) || 0), 0);
  const pqSeed = d => { pqBase(d); return d; };
  function abaPesqTela(d, vis) {
    const P = pqBase(d); P.listas = P.listas || []; const mes = ST.pesqMes || fechMes(); const mesBtn = '<input type="month" value="' + mes + '" onchange="kcbmPf.pesqMes(this.value)" style="' + IN + ';width:auto">';
    const topo = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px"><b style="font-size:1.1rem">🛒 Mercado</b>' + B('Lista padrão (preços)', "kcbmPf.mercadoVis('pesq')", vis === 'pesq' ? 'bp' : 'bo') + B('Lista de mercado do mês', "kcbmPf.mercadoVis('lista')", vis === 'lista' ? 'bp' : 'bo') + '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">' + B('🤖 Pedir ao Claude para atualizar preços', 'kcbmPf.pesqPedir()', 'bp', 'Copia um pedido pronto, com todos os dados desta tela, para colar na conversa do Claude') + '</div></div>';
    const melhor = p => { let b = null; P.mercados.forEach(m => { const x = (p.precos || {})[m.id]; if (x && x.preco > 0 && (!b || x.preco < b.preco)) b = { id: m.id, preco: x.preco }; }); return b; };
    if (vis === 'pesq') {
      const comP = P.mercados.filter(m => P.produtos.some(q => (q.precos || {})[m.id] && q.precos[m.id].preco > 0)), semP = P.mercados.length - comP.length, MV = (ST.pesqTodosMerc || !comP.length) ? P.mercados : comP;
      const cab = [{ t: 'Produto' }, { t: 'Marca' }, { t: 'Embalagem' }].concat(MV.map(m => ({ t: E(m.nome), r: 1 }))).concat([{ t: '' }]), linhas = []; let gAtual = '';
      pqOrd(P).forEach(p => { const g = pqGr(p); if (g !== gAtual) { gAtual = g; linhas.push('<tr class="pqGrupo"><td colspan="' + cab.length + '" style="' + TD + ';position:static!important;max-width:none!important;font-weight:800;background:' + pqGBg(P, g) + '!important;border-left:4px solid ' + ((pqGrupos(P).find(x => x.nome === g) || {}).cor || 'var(--border)') + '">' + E(g) + '</td></tr>'); } const b = melhor(p);
        linhas.push('<tr>' + td('<b>' + E(p.produto) + '</b>') + td(E(p.marca || '—')) + td(E((p.qtd || '') + ' ' + (p.un || ''))) + MV.map(m => { const x = (p.precos || {})[m.id], vel = x && x.data && (new Date(hoje()) - new Date(x.data)) / 86400000 > 15; return '<td style="' + TD + ';text-align:right;white-space:nowrap;cursor:pointer" onclick="kcbmPf.pesqPreco(\'' + p.id + '\',\'' + m.id + '\')" title="Clique para informar/alterar o preço">' + (x && x.preco > 0 ? '<span style="font-weight:' + (b && b.id === m.id ? 800 : 400) + ';color:' + (b && b.id === m.id ? 'var(--teal)' : 'inherit') + '">' + R$(x.preco) + '</span><div style="font-size:10.5px;color:' + (vel ? '#dc2626' : 'var(--slate)') + '">' + br(x.data) + (vel ? ' · velho' : '') + (pqPorKg(p, x.preco) ? ' · ' + pqPorKg(p, x.preco) : '') + '</div>' : '<span style="color:var(--slate)">—</span>') + '</td>'; }).join('')
          + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + B('Marcas', "kcbmPf.pesqMarcas('" + p.id + "')", 'bo', 'Escolher até 5 marcas de preferência para este produto') + ' ' + B('✏️', "kcbmPf.pesqProdutoForm('" + p.id + "')", 'bo', 'Editar') + ' ' + B('🗑', "kcbmPf.pesqProdutoExcluir('" + p.id + "')") + '</td></tr>'); });
      return topo + '<style>#kpfPesq table th:nth-child(-n+3),#kpfPesq table td:nth-child(-n+3){position:sticky;background:var(--white);z-index:2}#kpfPesq table th:nth-child(1),#kpfPesq table td:nth-child(1){left:0;min-width:170px;max-width:170px}#kpfPesq table th:nth-child(2),#kpfPesq table td:nth-child(2){left:170px;min-width:90px;max-width:90px}#kpfPesq table th:nth-child(3),#kpfPesq table td:nth-child(3){left:260px;min-width:90px;max-width:90px;box-shadow:2px 0 0 var(--border)}#kpfPesq table thead th:nth-child(-n+3){z-index:5}</style><div id="kpfPesq"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' + B('+ Produto / marca', "kcbmPf.pesqProdutoForm()", 'bp') + B('⚙ Grupos', 'kcbmPf.pesqGrupos()', 'bo', 'Criar, renomear, colorir ou excluir grupos de produtos') + B('+ Mercado', "kcbmPf.pesqMercadoForm()", 'bp') + B('Montar lista inicial', 'kcbmPf.pesqLista()', 'bp', 'Cria os itens padrão (sem marca) a partir das suas notas') + B('Trazer produtos das notas', 'kcbmPf.pesqTrazer()') + (semP > 0 || ST.pesqTodosMerc ? B(ST.pesqTodosMerc ? 'Ocultar mercados sem preço' : 'Mostrar mercados sem preço (' + semP + ')', 'kcbmPf.pesqVerTodos()') : '') + P.mercados.map(m => B('✏️ ' + E(m.nome), "kcbmPf.pesqMercadoForm('" + m.id + "')", 'bo', m.url || 'Editar mercado')).join('') + '</div>'
        + '<div style="font-size:12px;color:var(--slate);margin-bottom:8px">Produtos organizados por grupo. Clique no preço de um mercado para informar ou corrigir; o mais barato de cada linha fica em verde. Preço com mais de 15 dias aparece como "velho". Para ir ao mercado, monte uma lista na aba "Lista de mercado do mês".</div>'
        + tabela(cab, linhas, 'Nenhum produto ainda. Use "+ Produto / marca" ou "Montar lista inicial".') + '</div>';
    }
    // ── Lista de mercado do mês: várias listas por mês, carrinho com quantidade × preço da prateleira, e comparação com a nota ──
    const aberta = P.listas.find(l => l.id === ST.listaAberta);
    if (aberta) return topo + pqTelaLista(d, P, aberta);
    const doMes = P.listas.filter(l => l.mes === mes).sort((a, b) => (a.criado || 0) - (b.criado || 0));
    const cards = doMes.map(l => { const mc = P.mercados.find(m => m.id === l.mercadoId); return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:180px"><b>' + E(l.nome || 'Lista') + '</b><div style="font-size:12px;color:var(--slate)">🏬 ' + E(mc ? mc.nome : 'mercado não definido') + ' · ' + (l.itens || []).length + ' item(ns) · criada em ' + pqAgora(l.criado) + ' · estimado <b>' + R$(pqListaTot(l)) + '</b>' + (l.nota ? ' · 🧾 nota comparada' : '') + (l.notaId ? ' · ✅ enviada para Notas' : '') + '</div></div>' + B('Abrir', "kcbmPf.listaAbrir('" + l.id + "')", 'bp') + B('🗑', "kcbmPf.listaExcluir('" + l.id + "')") + '</div>'; }).join('');
    return topo + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' + mesBtn + B('+ Nova lista', 'kcbmPf.listaNova()', 'bp') + '<span style="font-size:12px;color:var(--slate)">Pode ter mais de uma lista no mesmo mês (uma por mercado, por exemplo).</span></div>'
      + (cards ? '<div style="display:flex;flex-direction:column;gap:8px">' + cards + '</div>' : '<div style="padding:18px;color:var(--slate)">Nenhuma lista em ' + rotMes(mes) + '. Clique em "+ Nova lista", escolha o mercado e marque os produtos que quer levar.</div>');
  }
  function pqTelaLista(d, P, L) {
    const mc = P.mercados.find(m => m.id === L.mercadoId), tot = pqListaTot(L);
    const cab = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + B('← Listas', 'kcbmPf.listaFechar()') + '<input value="' + E(L.nome || '') + '" onchange="kcbmPf.listaRenomear(\'' + L.id + '\',this.value)" style="' + IN + ';flex:1 1 340px;min-width:260px;max-width:620px;font-weight:700;font-size:15px"> ' + sel('pqLM', [['', '— mercado —']].concat(P.mercados.map(m => [m.id, m.nome])), L.mercadoId || '', 'onchange="kcbmPf.listaMercado(\'' + L.id + '\',this.value)" style="width:auto"') + '<span style="font-size:12px;color:var(--slate)">' + rotMes(L.mes) + (L.criado ? ' · criada em ' + pqAgora(L.criado) : '') + '</span></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + B('+ Produtos da lista padrão', "kcbmPf.listaAdd('" + L.id + "')", 'bp') + B('+ Item avulso', "kcbmPf.listaAvulso('" + L.id + "')") + B('🧾 Subir a nota fiscal da compra', "kcbmPf.listaNota('" + L.id + "')", 'bp') + '</div>';
    const itens = (L.itens || []).map(it => { const p = it.prodId && P.produtos.find(x => x.id === it.prodId), sug = p && p.precos && p.precos[L.mercadoId] && p.precos[L.mercadoId].preco > 0 ? p.precos[L.mercadoId].preco : 0, t = (Number(it.qtd) || 0) * (Number(it.pu) || 0);
      return '<div class="pqIt" data-iid="' + it.id + '" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 4px;border-bottom:1px solid var(--border)"><div style="flex:1 1 170px;min-width:150px"><b>' + E(it.nome) + '</b>' + (it.ref ? '<div style="font-size:11.5px;color:var(--slate)">Menor preço pesquisado: <b>' + R$(it.ref.p) + '</b> no <b>' + E(it.ref.m) + '</b> (' + br(it.ref.d) + ')</div><div class="pqCmp" data-ref="' + it.ref.p + '" style="font-size:11.5px;font-weight:700"></div>' : '<div style="font-size:11px;color:var(--slate)">sem preço pesquisado</div>') + '</div>'
        + '<label style="font-size:11px;color:var(--slate)">Qtd<br><input class="pqQ" value="' + E(it.qtd) + '" inputmode="decimal" oninput="kcbmPf.listaCalc()" onchange="kcbmPf.listaSalvaItem(\'' + L.id + '\',\'' + it.id + '\')" style="' + IN + ';width:64px;text-align:right"></label>'
        + '<label style="font-size:11px;color:var(--slate)">Unit. (R$)<br><input class="pqP" value="' + E(it.pu ? String(it.pu).replace('.', ',') : '') + '" placeholder="' + (sug ? String(sug).replace('.', ',') : '0,00') + '" inputmode="decimal" oninput="kcbmPf.listaCalc()" onchange="kcbmPf.listaSalvaItem(\'' + L.id + '\',\'' + it.id + '\')" style="' + IN + ';width:84px;text-align:right"></label>'
        + '<div style="min-width:84px;text-align:right"><div style="font-size:11px;color:var(--slate)">Total</div><b class="pqT">' + R$(t) + '</b></div>' + B('🗑', "kcbmPf.listaItemDel('" + L.id + "','" + it.id + "')") + '</div>'; }).join('');
    const barra = '<div style="position:sticky;bottom:0;background:var(--white);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;z-index:6;flex-wrap:wrap"><span>🛒 <b id="pqNIt">' + (L.itens || []).length + '</b> item(ns)</span><span style="font-size:13px">Menor preço pesquisado (total): <b id="pqRefTot">' + R$(0) + '</b></span><span style="font-size:13px">Diferença: <b id="pqDif">—</b></span><span>Total do carrinho: <b id="pqTotal" style="font-size:1.2rem">' + R$(tot) + '</b></span></div>';
    return cab + (itens || '<div style="padding:18px;color:var(--slate)">Lista vazia. Use "+ Produtos da lista padrão" para marcar o que quer levar.</div>') + barra + '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="kcbmPf.listaCalc()" style="display:none">' + (L.nota ? pqComparacao(d, P, L) : '');
  }
  function pqComparacao(d, P, L) {
    const N = L.nota, V = L.vinc || {}, usados = new Set(Object.values(V).filter(x => x >= 0)), opt = (sel0) => '<option value="-1">— não encontrei na nota —</option>' + (N.itens || []).map((x, i) => '<option value="' + i + '"' + (i === sel0 ? ' selected' : '') + '>' + E(x.desc) + ' (' + R$(x.vu) + ')</option>').join('');
    let dif = 0; const linhas = (L.itens || []).map(it => { const i = V[it.id] != null ? V[it.id] : -1, nx = i >= 0 ? N.itens[i] : null, pe = Number(it.pu) || 0, pn = nx ? nx.vu : 0, qd = Number(it.qtd) || 0, df = nx && pe ? (pn - pe) * qd : 0; dif += df;
      const st = !nx ? '<span style="color:#dc2626">não está na nota</span>' : !pe ? '<span style="color:var(--slate)">sem preço da etiqueta</span>' : Math.abs(pn - pe) < 0.005 ? '<span style="color:var(--teal)">✓ igual à etiqueta</span>' : pn > pe ? '<span style="color:#dc2626">⚠ nota mais cara ' + R$(df) + '</span>' : '<span style="color:var(--teal)">↓ nota mais barata ' + R$(df) + '</span>';
      return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 4px;border-bottom:1px solid var(--border);font-size:12.5px"><div style="flex:1 1 150px;min-width:130px"><b>' + E(it.nome) + '</b><div style="color:var(--slate)">etiqueta ' + (pe ? R$(pe) : '—') + ' × ' + qd + '</div></div><select onchange="kcbmPf.listaVincula(\'' + L.id + '\',\'' + it.id + '\',this.value)" style="' + IN + ';max-width:230px">' + opt(i) + '</select><div style="min-width:120px;text-align:right">' + (nx ? 'nota ' + R$(pn) + '<br>' : '') + st + '</div></div>'; }).join('');
    const soltos = (N.itens || []).map((x, i) => usados.has(i) ? '' : '<div style="padding:4px 4px;font-size:12.5px;border-bottom:1px solid var(--border)">' + E(x.desc) + ' — ' + x.qtd + ' × ' + R$(x.vu) + ' = <b>' + R$(x.vt) + '</b></div>').join('');
    return '<div style="margin-top:18px;border-top:2px solid var(--ink);padding-top:10px"><div style="font-weight:800;margin-bottom:4px">🧾 Comparação com a nota — ' + E(N.fornecedor || '') + ' · ' + br(N.data) + '</div><div style="font-size:12px;color:var(--slate);margin-bottom:6px">Escolhi o que combinava sozinho. Onde errei, escolha na lista o item certo da nota.</div>' + linhas
      + '<div style="margin-top:8px;font-size:13px">Produtos na nota: <b>' + R$((N.itens || []).reduce((a, x) => a + x.vt, 0)) + '</b>' + (N.desconto ? ' · desconto ' + R$(N.desconto) : '') + ' · total pago <b>' + R$(N.total) + '</b> · carrinho que você marcou <b>' + R$(pqListaTot(L)) + '</b> · diferença de preço nos itens ligados: <b style="color:' + (dif > 0.004 ? '#dc2626' : 'var(--teal)') + '">' + R$(dif) + '</b></div>'
      + (soltos ? '<div style="margin-top:8px;font-weight:700;font-size:12.5px">Na nota e fora da lista</div>' + soltos : '')
      + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' + B(L.notaId ? '↻ Enviar de novo para Notas' : '➡ Enviar esta nota para a aba Notas (classificar e informar o pagamento)', "kcbmPf.listaEnviar('" + L.id + "')", 'bp') + B('Remover a nota desta lista', "kcbmPf.listaNotaTira('" + L.id + "')") + '</div></div>';
  }
  function abaNotas(d) {
    d.notas = d.notas || []; d.produtos = d.produtos || {};
    const vis = ST.notasVis || 'notas', anos = [...new Set(d.notas.map(n => (n.data || '').slice(0, 4)).filter(Boolean).concat([hoje().slice(0, 4)]))].sort().reverse(), ano = ST.notasAno && anos.indexOf(ST.notasAno) >= 0 ? ST.notasAno : anos[0];
    const topo = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px"><b style="font-size:1.1rem">🧾 Notas fiscais</b>' + B('Notas', "kcbmPf.notasVis('notas')", vis === 'notas' ? 'bp' : 'bo') + B('Produtos do ano', "kcbmPf.notasVis('produtos')", vis === 'produtos' ? 'bp' : 'bo') + sel('kpfNtAno', anos.map(a => [a, a]), ano, 'onchange="kcbmPf.notasAno(this.value)" style="width:auto"') + '<div style="margin-left:auto">' + B('+ Anexar nota fiscal', 'kcbmPf.notaAnexar()', 'bp') + '</div></div>';
    const doAno = d.notas.filter(n => (n.data || '').slice(0, 4) === ano).sort((a, b) => b.data.localeCompare(a.data));
    if (vis === 'notas') {
      const linhas = []; doAno.forEach(n => { const ab = !!(ST.notaAberta || {})[n.id]; linhas.push('<tr style="cursor:pointer" onclick="kcbmPf.notaAbrir(\'' + n.id + '\')">' + td((ab ? '▼ ' : '▶ ') + br(n.data)) + td(E(n.fornecedor || '—')) + td(String((n.itens || []).length) + ' item(ns)') + td(R$(n.total), 1) + td(nfRotPg(d, n)) + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + (n.pg && n.pg.tipo ? B('Pagamento', "kcbmPf.notaPagar('" + n.id + "')") : B('✔ Informar pagamento', "kcbmPf.notaPagar('" + n.id + "')", 'bp')) + ' ' + B('✏️', "kcbmPf.notaEditar('" + n.id + "')", 'bo', 'Editar produtos e dados') + ' ' + B('🗑', "kcbmPf.notaExcluir('" + n.id + "')", 'bo', 'Excluir a nota inteira') + '</td></tr>');
        if (ab) linhas.push('<tr><td colspan="6" style="padding:0;background:rgba(127,127,127,.07)"><div style="padding:6px 12px 10px 30px"><table style="width:100%;border-collapse:collapse">' + (n.itens || []).map((it, ix) => '<tr>' + td(E(it.desc) + (it.grupo ? ' <span style="color:var(--slate);font-size:11.5px">→ ' + E(it.grupo) + '</span>' : '')) + td(String(it.qtd) + ' ' + E(it.un || ''), 1) + td(R$(it.vu), 1) + td(R$(it.vt), 1) + '<td style="' + TD + ';text-align:right">' + B('🗑', "kcbmPf.notaItemExcluir('" + n.id + "'," + ix + ")", 'bo', 'Excluir só este produto') + '</td></tr>').join('') + '</table></div></td></tr>'); });
      return topo + '<div style="font-size:12px;color:var(--slate);margin-bottom:8px">Anexe o XML da nota (baixado do site da Fazenda) ou o PDF. Você confere os produtos, liga o fornecedor e diz como pagou: no cartão (a compra entra na fatura) ou vinculando a um lançamento que já existe.</div>'
        + tabela([{ t: 'Data' }, { t: 'Fornecedor' }, { t: 'Produtos' }, { t: 'Total', r: 1 }, { t: 'Pagamento' }, { t: '' }], linhas, 'Nenhuma nota neste ano. Clique em "Anexar nota fiscal".');
    }
    const q = normP(ST.notasBusca || ''), rows = []; doAno.forEach(n => (n.itens || []).forEach(it => { const nome = it.grupo || prodDe(d, it.desc) || it.desc; if (!q || normP(nome + ' ' + it.desc + ' ' + n.fornecedor).indexOf(q) >= 0) rows.push({ n, it, nome }); }));
    const res = {}; rows.forEach(r => { const g = res[normP(r.nome)] = res[normP(r.nome)] || { nome: r.nome, qtd: 0, tot: 0, vezes: 0, forn: {} }; g.qtd += r.it.qtd; g.tot += r.it.vt; g.vezes++; const f = g.forn[r.n.fornecedor] = g.forn[r.n.fornecedor] || { q: 0, t: 0 }; f.q += r.it.qtd; f.t += r.it.vt; });
    const resL = Object.values(res).sort((a, b) => b.tot - a.tot).map(g => { const fs = Object.keys(g.forn).map(k => ({ k, pm: g.forn[k].q > 0 ? g.forn[k].t / g.forn[k].q : 0 })).filter(x => x.pm > 0).sort((a, b) => a.pm - b.pm); return '<tr>' + td('<b>' + E(g.nome) + '</b>') + td(String(g.vezes)) + td(String(Math.round(g.qtd * 1000) / 1000), 1) + td(R$(g.tot), 1) + td(g.qtd > 0 ? R$(g.tot / g.qtd) : '—', 1) + td(fs.length ? E(fs[0].k) + ' (' + R$(fs[0].pm) + ')' : '—') + '</tr>'; });
    const detL = rows.sort((a, b) => b.n.data.localeCompare(a.n.data)).map(r => '<tr>' + td(br(r.n.data)) + td('<b>' + E(r.nome) + '</b>' + (r.nome !== r.it.desc ? '<div style="font-size:11px;color:var(--slate)">' + E(r.it.desc) + '</div>' : '')) + td(String(r.it.qtd) + ' ' + E(r.it.un || ''), 1) + td(R$(r.it.vu), 1) + td(R$(r.it.vt), 1) + td(E(r.n.fornecedor)) + td(E(r.it.tipo || '—')) + '</tr>');
    return topo + '<div style="margin-bottom:10px">' + inp('kpfNtBusca', ST.notasBusca || '', 'text', 'placeholder="Buscar produto ou fornecedor (ex.: arroz)" oninput="kcbmPf.notasBusca(this.value)" style="max-width:360px"') + '</div>'
      + '<div style="font-weight:700;margin:6px 0">Resumo por produto — ' + ano + '</div>' + tabela([{ t: 'Produto' }, { t: 'Compras' }, { t: 'Qtd total', r: 1 }, { t: 'Gasto total', r: 1 }, { t: 'Preço médio', r: 1 }, { t: 'Fornecedor mais barato' }], resL, 'Nenhum produto neste ano.', 1)
      + '<div style="font-weight:700;margin:14px 0 6px">Todas as compras de produtos</div>' + tabela([{ t: 'Data' }, { t: 'Produto' }, { t: 'Qtd', r: 1 }, { t: 'Valor unit.', r: 1 }, { t: 'Valor total', r: 1 }, { t: 'Fornecedor' }, { t: 'Tipo de gasto' }], detL, 'Nenhuma compra de produto.');
  }
  function abaMovimentacao(d) {
    const mes = fechMes(), fl = ST.movFiltro || 'todos', rows = [];
    if (ST.movMesesRef !== mes) { ST.movMeses = null; ST.movMesesRef = mes; }
    const sel = ST.movMeses && ST.movMeses.length ? ST.movMeses.slice().sort() : [mes], conj = new Set(sel), mini = sel[0], trazer = !!ST.movAtras;
    ['pagar', 'receber'].forEach(tipo => (d[tipo] || []).forEach(it => { if (it.forma === 'cartao') return; (it.parcelas || []).forEach(p => { const vm = p.venc.slice(0, 7); if (conj.has(vm) || (trazer && !p.pago && vm < mini)) rows.push({ tipo, venc: p.venc, it, p, atras: !conj.has(vm) }); }); }));
    (d.cartoes || []).forEach(c => faturasDoCartao(d, c.id).forEach(f => { const vm = f.venc.slice(0, 7); if (conj.has(vm) || (trazer && f.aberto > 0.004 && vm < mini)) rows.push({ tipo: 'pagar', venc: f.venc, fat: { c, f }, atras: !conj.has(vm) }); }));
    rows.sort((a, b) => a.venc.localeCompare(b.venc));
    let aPagar = 0, aReceber = 0, pagoT = 0, recebT = 0;
    const html = rows.filter(r => fl === 'todos' || r.tipo === fl).map(r => {
      const pag = r.tipo === 'pagar', badge = '<span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px;border:1px solid ' + (pag ? '#dc2626' : 'var(--teal)') + ';color:' + (pag ? '#dc2626' : 'var(--teal)') + '">' + (pag ? 'A pagar' : 'A receber') + '</span>';
      if (r.fat) {
        const { c, f } = r.fat, key = c.id + '|' + f.fatura, aberta = !!ST.movAberto[key], quit = f.aberto <= 0.004;
        const viaP = !!f.linhas.length && f.linhas.every(x => x.p.via);
        if (quit) { if (!viaP) pagoT += f.total; } else aPagar += f.aberto;
        const sit = viaP ? '<span style="color:#a78bfa">quitada por parcelamento</span>' : quit ? '<span style="color:var(--teal)">paga</span>' : (r.atras ? '<span style="color:#dc2626">atrasada</span>' : 'em aberto');
        const acao = viaP ? '' : quit ? (f.linhas.some(x => x.p.baixaFatura) ? B('↩ Desfazer', "kcbmPf.faturaDesfazBaixa('" + c.id + "','" + f.fatura + "')") : '') : B('✔ Dar baixa', "kcbmPf.faturaBaixa('" + c.id + "','" + f.fatura + "')", 'bp');
        let h = '<tr style="cursor:pointer' + (quit ? ';background:rgba(59,130,246,.16)' : '') + '" onclick="kcbmPf.movAbrir(\'' + key + '\')">' + '<td style="' + TD + ';width:26px;text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="kpfMovChk" data-v="' + cents(-(quit ? f.total : f.aberto)) + '" data-ab="' + (quit ? 0 : 1) + '" onclick="event.stopPropagation();kcbmPf.movSelCalc()"></td>' + td(br(f.venc)) + td(badge) + td('<span style="display:inline-flex;align-items:center;gap:6px"><span style="font-size:11px">' + (aberta ? '▼' : '▶') + '</span>' + emissorLogo(emissorDe(c), 20) + '<b>' + E(c.nome) + '</b> <span style="color:var(--slate);font-size:11.5px">fatura de ' + rotMes(f.fatura) + ' · ' + f.linhas.length + ' lançamento(s)</span></span>') + td('Cartão de crédito') + td('<span style="color:#dc2626">' + R$(-f.total) + '</span>', 1) + td(sit) + '<td style="' + TD + ';text-align:right;white-space:nowrap" onclick="event.stopPropagation()">' + acao + '</td></tr>';
        if (aberta) h += '<tr><td colspan="8" style="padding:0;background:rgba(127,127,127,.07)"><div style="padding:6px 12px 10px 38px"><table style="width:100%;border-collapse:collapse">' + f.linhas.map(x => '<tr>' + td(br(x.item.data)) + td(E(x.item.fornecedor) + seloPorQuem(x.item)) + td(x.item.rec ? '↻ ' + recRot(x.item) : (x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista')) + td(E(x.item.tipo || '')) + td(R$(-x.p.valor), 1) + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + B('✏️', "kcbmPf.tituloEditar('pagar','" + x.item.id + "')", 'bo', 'Editar esta compra') + ' ' + B('🗑', "kcbmPf.tituloExcluir('pagar','" + x.item.id + "'" + ',' + x.p.n + ")", 'bo', 'Excluir esta compra') + '</td></tr>').join('') + '</table></div></td></tr>';
        return h;
      }
      const { it, p } = r, v = pag ? -p.valor : p.valor; if (p.pago) { if (!p.via) { if (pag) pagoT += p.valor; else recebT += p.valor; } } else if (pag) aPagar += p.valor; else aReceber += p.valor;
      const sit = p.via ? '<span style="color:#a78bfa">quitada por parcelamento</span>' : p.pago ? '<span style="color:var(--teal)">' + (pag ? 'paga' : 'recebida') + ' em ' + br(p.dataPago) + (p.extratoId ? ' · extrato' : '') + '</span>' : (r.atras ? '<span style="color:#dc2626">atrasada</span>' : 'em aberto');
      const acao = p.via ? '' : p.pago ? (p.extratoId ? '' : B('↩ Desfazer', "kcbmPf.parcelaDesfaz('" + r.tipo + "','" + it.id + "'," + p.n + ")")) : B(pag ? '✔ Pagar' : '✔ Receber', "kcbmPf.parcelaBaixa('" + r.tipo + "','" + it.id + "'," + p.n + ")", 'bp');
      return '<tr' + (p.pago ? ' style="background:' + (pag ? 'rgba(59,130,246,.16)' : 'rgba(34,197,94,.17)') + '"' : '') + '>' + '<td style="' + TD + ';width:26px;text-align:center" onclick="event.stopPropagation()"><input type="checkbox" class="kpfMovChk" data-v="' + cents(v) + '" data-ab="' + (p.pago ? 0 : 1) + '" onclick="event.stopPropagation();kcbmPf.movSelCalc()"></td>' + td(br(r.venc)) + td(badge) + td(E(it[pag ? 'fornecedor' : 'cliente']) + seloPorQuem(it) + (it.rec ? ' ↻' : '') + (it.parcelado ? ' <span style="color:var(--slate);font-size:11.5px">' + p.n + '/' + it.n + '</span>' : '')) + td(E(it.tipo || '')) + td('<span style="color:' + cor(v) + '">' + R$(v) + '</span>', 1) + td(sit) + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + acao + ' ' + B('✏️', "kcbmPf.tituloEditar('" + r.tipo + "','" + it.id + "')", 'bo', 'Editar') + ' ' + B('Parcelas', "kcbmPf.tituloVer('" + r.tipo + "','" + it.id + "')") + (pag ? ' ' + B(ICO_UM, "kcbmPf.porQuemDefinir('" + r.tipo + "','" + it.id + "')") : '') + ' ' + B('🗑', "kcbmPf.tituloExcluir('" + r.tipo + "','" + it.id + "'" + ',' + p.n + ")") + '</td></tr>';
    });
    const chip = (k, t) => '<button class="btn ' + (fl === k ? 'bp' : 'bo') + ' bsm" onclick="kcbmPf.movFiltro(\'' + k + '\')">' + t + '</button>';
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes) + B('📅 ' + (ST.movMeses && ST.movMeses.length > 1 ? ST.movMeses.length + ' meses' : 'Meses / ano'), 'kcbmPf.movMesesAbrir()', ST.movMeses && ST.movMeses.length > 1 ? 'bp' : 'bo') + '<button class="btn ' + (trazer ? 'bp' : 'bo') + ' bsm" title="Inclui o que venceu antes e ainda não foi pago" onclick="kcbmPf.movAtras()">' + (trazer ? '✓ ' : '') + 'Trazer pendências anteriores</button>' + chip('todos', 'Tudo') + chip('pagar', 'A pagar') + chip('receber', 'A receber') + '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">' + B('+ Conta a pagar', "kcbmPf.tituloForm('pagar')", 'bp') + B('+ Conta a receber', "kcbmPf.tituloForm('receber')", 'bp') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:8px">' + (sel.length > 1 ? 'Mostrando: <b>' + sel.map(rotMes).join(', ') + '</b>. ' : 'Só o que vence em <b>' + rotMes(mes) + '</b> (pago ou não). ') + (trazer ? 'Com as pendências de meses anteriores. ' : 'Use o botão "Trazer pendências anteriores" para somar o que ficou sem pagar antes. ') + 'Compras no cartão aparecem somadas na fatura: clique na linha do cartão para abrir ou fechar o que compõe o valor. A baixa também é feita sozinha quando o extrato paga exatamente o valor no dia do vencimento.</div>'
      + tabela([{ t: '<input type="checkbox" title="Marcar todas as linhas" onclick="kcbmPf.movSelTodos(this)">' }, { t: 'Vencimento' }, { t: 'Movimento' }, { t: 'Descrição' }, { t: 'Tipo' }, { t: 'Valor', r: 1 }, { t: 'Situação' }, { t: '<span id="kpfMovTot" style="font-weight:600;white-space:nowrap"></span><img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" onload="kcbmPf.movSelCalc()" style="display:none">', r: 1 }], html, 'Nada vence neste mês.')
      + '<div style="text-align:right;margin-top:8px;font-size:13px">A pagar <b style="color:#dc2626">' + R$(aPagar) + '</b> · Pago <b>' + R$(pagoT) + '</b> · A receber <b style="color:var(--teal)">' + R$(aReceber) + '</b> · Recebido <b>' + R$(recebT) + '</b></div>';
  }
  // ── Contas a pagar / receber ──
  function abaTitulos(d, tipo) {
    const pag = tipo === 'pagar', itens = (d[tipo] || []).slice().sort((a, b) => b.data.localeCompare(a.data));
    const linhas = itens.map(it => {
      const ps = it.parcelas || [], feitas = ps.filter(p => p.pago).length, forma = it.forma === 'cartao' ? (() => { const cc = d.cartoes.find(c => c.id === it.cartaoId) || {}; return '<span style="display:inline-flex;align-items:center;gap:6px">' + emissorLogo(emissorDe(cc), 20) + E(cc.nome || 'cartão') + '</span>'; })() : E({ avista: 'À vista / boleto', carne: 'Carnê', outro: 'Outro' }[it.forma] || '');
      const parc = it.rec ? '↻ todo mês, dia ' + it.diaVenc + (it.fim ? ' (até ' + rotMes(somaMes(it.fim, -1)) + ')' : '') : (it.parcelado ? it.n + 'x' : 'à vista');
      return '<tr>' + td(br(it.data)) + td(E(it[pag ? 'fornecedor' : 'cliente'])) + td(E(it.tipo || '')) + td(R$(it.valor), 1) + td(parc) + td(forma) + td(it.rec ? feitas + ' feitas · ' + (ps.length - feitas) + ' projetadas' : feitas + ' de ' + ps.length + ' ' + (pag ? 'pagas' : 'recebidas'))
        + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + B('Parcelas', "kcbmPf.tituloVer('" + tipo + "','" + it.id + "')") + ' ' + B('🗑', "kcbmPf.tituloExcluir('" + tipo + "','" + it.id + "')") + '</td></tr>';
    });
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><div style="font-weight:700">' + (pag ? 'Compras a prazo e contas a pagar' : 'Receitas a prazo e contas a receber') + '</div><div style="margin-left:auto">' + B(pag ? '+ Registrar compra / conta' : '+ Registrar receita', "kcbmPf.tituloForm('" + tipo + "')", 'bp') + '</div></div>'
      + tabela([{ t: 'Data' }, { t: pag ? 'A quem pago' : 'De quem recebo' }, { t: pag ? 'Tipo de gasto' : 'Tipo de receita' }, { t: 'Valor', r: 1 }, { t: 'Parcelas / recorrência' }, { t: 'Forma' }, { t: 'Situação' }, { t: '' }], linhas, pag ? 'Nenhuma conta registrada.' : 'Nenhuma receita a receber registrada.');
  }
  // ── Cartões ──
  function abaCartoes(d) {
    const cards = d.cartoes.map(c => {
      const gr = gruposCartoes(d).find(g => g.membros.some(x => x.id === c.id)), unif = gr && gr.membros.length > 1, limG = Number(gr.mestre.limite) || 0, usado = unif ? grupoUso(d, gr, fechMes()) : limiteUsado(d, c.id, fechMes()), disp = limG - usado, sel2 = ST.cartaoSel === c.id, tm = temaCartao(c.cor);
      return '<div draggable="true" ondragstart="kcbmPf.arrastarIni(event,\'cartao\',\'' + c.id + '\')" ondragend="kcbmPf.arrastarFim(event)" ondragover="kcbmPf.arrastarSobre(event,\'cartao\')" ondrop="kcbmPf.soltar(event,\'cartao\',\'' + c.id + '\')" onclick="kcbmPf.cartaoSel(\'' + c.id + '\')" style="cursor:grab;min-width:215px;flex:0 0 245px;scroll-snap-align:start;padding-bottom:26px !important;border:' + (sel2 ? '3px' : '2px') + ' solid ' + (sel2 ? tm.sel : tm.borda) + ';border-radius:12px;padding:6px 12px 9px;background:' + tm.bg + ';color:' + tm.fg + ';position:relative"><div style="display:flex;justify-content:space-between;align-items:center"><b style="display:flex;align-items:center;gap:8px;' + (imagemDe(c) ? 'font-size:11px;font-weight:600' : '') + '">' + (imagemDe(c) ? '' : emissorLogo(emissorDe(c), 28)) + E(c.nome) + '</b><span class="kpfEdit" onclick="event.stopPropagation()">' + B('✏️', "kcbmPf.cartaoForm('" + c.id + "')") + '</span></div>'
        + (imagemDe(c) ? '<img src="' + imagemDe(c) + '" alt="" style="display:block;width:auto;max-width:62%;max-height:150px;height:auto;border-radius:7px;margin:3px 0 2px">' : '')
        + '<div style="font-size:11px;color:' + tm.mut + ';margin:3px 0">' + (c.mesmoDia ? 'vence no mesmo dia da compra, no mês seguinte' : 'fecha dia ' + (c.fechamento || '—') + ' · vence dia ' + (c.vencimento || '—')) + (!c.mesmoDia && c.fechamento >= 1 ? ' · melhor dia de compra: ' + (c.fechamento >= 31 ? 1 : +c.fechamento + 1) : '') + '</div><div style="font-size:11px;line-height:1.5">' + (unif ? '<span style="font-size:11px;color:' + tm.mut + '">Limite unificado: ' + gr.membros.map(x => E(x.nome)).join(' + ') + '</span><br>' : '') + 'Limite <b>' + R$(limG) + '</b><br>Em uso' + (unif ? ' (grupo)' : '') + ' em ' + fechMes().slice(5, 7) + '/' + fechMes().slice(0, 4) + ' <b style="color:' + tm.neg + '">' + R$(usado) + '</b><br>Disponível <b style="color:' + (disp < 0 ? tm.neg : tm.pos) + '">' + R$(disp) + '</b></div>' + (c.bandeira && !imagemDe(c) ? '<span title=\"' + E(c.bandeira) + '\" style=\"position:absolute;right:12px;bottom:10px;line-height:0\">' + bandeiraSvg(c.bandeira, 22) + '</span>' : '') + '</div>';
    }).join('');
    let det = ''; const c = d.cartoes.find(x => x.id === ST.cartaoSel);
    if (c) {
      const fats = faturasDoCartao(d, c.id), prox = fats.filter(f => f.aberto > 0.004)[0];
      const linhas = []; fats.forEach(f => {
        const ab = !!ST.movAberto['f|' + c.id + '|' + f.fatura];
        linhas.push('<tr style="' + (ST.mesFatura === f.fatura ? 'background:rgba(20,184,166,.12)' : '') + ';cursor:pointer" onclick="kcbmPf.faturaSel(\'' + f.fatura + '\')">' + td('<span style="display:inline-flex;align-items:center;gap:8px"><span onclick="event.stopPropagation()">' + B(ab ? '▼' : '▶', "kcbmPf.faturaAbrir('" + c.id + "','" + f.fatura + "')", 'bo', 'Ver as compras que formam esta fatura') + '</span><b>' + rotMes(f.fatura) + '</b></span>') + td(br(f.venc)) + td(R$(f.total), 1) + td(R$(f.pago), 1) + td('<b style="color:' + (f.aberto > 0.004 ? '#dc2626' : 'var(--teal)') + '">' + R$(f.aberto) + '</b>', 1) + '</tr>');
        if (ab) linhas.push('<tr><td colspan="5" style="padding:0;background:rgba(127,127,127,.07)"><div style="padding:6px 12px 10px 38px"><table style="width:100%;border-collapse:collapse"><tr><th style="' + TD + ';text-align:left">Data</th><th style="' + TD + ';text-align:left">Compra</th><th style="' + TD + ';text-align:left">Parcela</th><th style="' + TD + ';text-align:left">Tipo</th><th style="' + TD + ';text-align:right">Valor</th><th style="' + TD + '"></th></tr>'
          + f.linhas.map(x => '<tr>' + td(br(x.item.data)) + td(E(x.item.fornecedor) + seloPorQuem(x.item)) + td(x.item.rec ? '↻ ' + recRot(x.item) : (x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista')) + td(E(x.item.tipo || '')) + td(R$(-x.p.valor), 1) + '<td style="' + TD + ';text-align:right;white-space:nowrap" onclick="event.stopPropagation()">' + (x.p.pago ? '' : B('✏️', x.item.manual ? "kcbmPf.saldoCartaoEditar('" + x.item.id + "')" : "kcbmPf.tituloEditar('pagar','" + x.item.id + "')", 'bo', 'Editar')) + ' ' + B('🗑', "kcbmPf.tituloExcluir('pagar','" + x.item.id + "'" + ',' + x.p.n + ")", 'bo', 'Excluir') + '</td></tr>').join('')
          + '<tr style="font-weight:700"><td colspan="4" style="' + TD + ';text-align:right">Total da fatura</td><td style="' + TD + ';text-align:right;white-space:nowrap">' + R$(-f.total) + '</td><td style="' + TD + '"></td></tr></table></div></td></tr>');
      });
      const fs = fats.find(f => f.fatura === ST.mesFatura);
      const compras = fs ? tabela([{ t: 'Compra' }, { t: 'A quem pago' }, { t: 'Parcela' }, { t: 'Valor', r: 1 }, { t: 'Situação' }, { t: '' }], fs.linhas.map(x => '<tr>' + td(br(x.item.data)) + td(E(x.item.fornecedor) + seloPorQuem(x.item)) + td(x.item.rec ? '↻ ' + recRot(x.item) : (x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista')) + td('<span style="color:' + cor(x.p.valor) + '">' + R$(x.p.valor) + '</span>', 1) + td(x.p.pago ? '<span style="color:var(--teal)">paga em ' + br(x.p.dataPago) + '</span>' : 'em aberto') + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + (x.p.pago ? '' : B('✏️', x.item.manual ? "kcbmPf.saldoCartaoEditar('" + x.item.id + "')" : "kcbmPf.tituloEditar('pagar','" + x.item.id + "')", 'bo', 'Editar')) + ' ' + B('🗑', "kcbmPf.tituloExcluir('pagar','" + x.item.id + "'" + ',' + x.p.n + ")", 'bo', 'Excluir') + '</td></tr>'), '') : '';
      det = '<div style="margin-top:16px"><div style="font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px">' + emissorLogo(emissorDe(c), 24) + 'Faturas — ' + E(c.nome) + ' ' + B('+ Saldo inicial', "kcbmPf.faturaManual('" + c.id + "')", 'bo', 'Informe quanto você já deve numa fatura que existe (ex.: a de novembro), sem detalhar as compras') + (prox ? ' <span style="font-weight:400;color:var(--slate)">· próxima a pagar: ' + rotMes(prox.fatura) + ', vence ' + br(prox.venc) + ', <b style="color:#dc2626">' + R$(prox.aberto) + '</b></span>' : '') + ' ' + B('+ Conta a pagar', "kcbmPf.tituloForm('pagar',{forma:'cartao',cartaoId:'" + c.id + "'})", 'bp', 'Lança uma compra neste cartão (aparece também na Movimentação)') + ' ' + B('+ Conta a receber', "kcbmPf.tituloForm('receber')", 'bp', 'Lança uma receita (aparece também na Movimentação)') + '</div>'
        + tabela([{ t: 'Fatura (fechamento)' }, { t: 'Vencimento' }, { t: 'Total', r: 1 }, { t: 'Pago', r: 1 }, { t: 'Em aberto', r: 1 }], linhas, 'Nenhuma compra neste cartão ainda.')
        + (fs ? '<div style="margin-top:12px;display:flex;align-items:center;gap:10px"><b>Compras da fatura de ' + rotMes(fs.fatura) + '</b>' + B('⚖ Ajustar fatura', "kcbmPf.faturaAjuste('" + c.id + "','" + fs.fatura + "')", 'bo', 'Informe o valor correto da fatura e o site lança a diferença como ajuste') + (fs.aberto > 0.004 ? B('✔ Dar baixa', "kcbmPf.faturaBaixa('" + c.id + "','" + fs.fatura + "')", 'bp', 'Marca a fatura inteira como paga na data que você informar') : '') + (fs.pago > 0.004 ? B('↩ Desfazer baixa', "kcbmPf.faturaDesfazBaixa('" + c.id + "','" + fs.fatura + "')", 'bo', 'Volta a fatura para em aberto (só as baixas feitas por aqui)') : '') + '</div>' + compras : '<div style="font-size:12px;color:var(--slate);margin-top:6px">Clique numa fatura para ver as compras dela e ajustar o valor.</div>') + '</div>';
    }
    const refM = fechMes(), gs = gruposCartoes(d), limTot = gs.reduce((a, g) => a + (Number(g.mestre.limite) || 0), 0), usoTot = gs.reduce((a, g) => a + grupoUso(d, g, refM), 0), fv = faturasQueVencemNoMes(d, refM), aPagar = fv.reduce((a, f) => a + f.aberto, 0), jaPago = fv.reduce((a, f) => a + f.pago, 0);
    const mini = (t, v, sub, cor) => '<div style="flex:1 1 170px;min-width:150px;border:1px solid var(--border);border-radius:10px;padding:9px 12px;background:var(--white)"><div style="font-size:11px;color:var(--slate);font-weight:600">' + t + '</div><div style="font-size:18px;font-weight:800;color:' + (cor || 'var(--ink)') + ';margin:2px 0">' + R$(v) + '</div><div style="font-size:11px;color:var(--slate)">' + sub + '</div></div>';
    const resumo = d.cartoes.length ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + mini('A pagar em ' + refM.slice(5, 7) + '/' + refM.slice(0, 4), aPagar, fv.length + ' fatura(s) vencendo' + (jaPago > 0.004 ? ' · já pago ' + R$(jaPago) : ''), aPagar > 0.004 ? '#dc2626' : '') + mini('Limite total', limTot, gs.length + ' limite(s)' + (gs.length < d.cartoes.length ? ' · unificados contam 1 vez' : '')) + mini('Em uso até ' + refM.slice(5, 7) + '/' + refM.slice(0, 4), usoTot, limTot ? Math.round(usoTot / limTot * 100) + '% do limite' : '') + mini('Disponível', limTot - usoTot, 'limite total − em uso', limTot - usoTot < 0 ? '#dc2626' : 'var(--teal)') + '</div>' : '';
    return resumo + '<div style="display:flex;align-items:center;margin-bottom:10px"><div style="font-weight:700">Cartões de crédito</div><div style="margin-left:auto">' + B('+ Novo cartão', 'kcbmPf.cartaoForm()', 'bp') + '</div></div>'
      + (cards ? carrossel('kpfCarCartoes', cards) : '<div style="color:var(--slate);padding:16px">Nenhum cartão cadastrado. Cadastre para escolher na compra parcelada ou recorrente.</div>') + det;
  }
  // ── Saldo a pagar / a receber (depois dos cartões): faturas que vencem no mês + contas fora do cartão ──
  function abaSaldo(d) {
    // Saldo mês a mês, "como se tudo já tivesse acontecido": receitas, contas e faturas já cadastradas entram no mês em que vencem, pagas ou não.
    // Saldo do fim do mês = saldo anterior + a receber − contas a pagar − faturas. O saldo de um mês é o saldo anterior do seguinte.
    // o saldo começa no mês dos "Saldos iniciais" (se definido) ou no mês do primeiro lançamento: assim NÃO muda quando você troca o mês lá em cima
    const venc0 = []; (d.receber || []).forEach(it => (it.parcelas || []).forEach(p => p.venc && venc0.push(p.venc.slice(0, 7)))); (d.pagar || []).forEach(it => { if (it.forma !== 'cartao') (it.parcelas || []).forEach(p => p.venc && venc0.push(p.venc.slice(0, 7))); }); (d.cartoes || []).forEach(c => faturasDoCartao(d, c.id).forEach(f => f.venc && venc0.push(f.venc.slice(0, 7))));
    const defIni = d.saldoIni && d.saldoIni.definido && /^\d{4}-\d{2}$/.test(d.saldoIni.mes || '');
    const mesIni = defIni ? d.saldoIni.mes : (venc0.length ? venc0.reduce((x, y) => x < y ? x : y) : fechMes()), mesMax = somaMes(fechMes() > mesIni ? fechMes() : mesIni, LIMITE_MESES); let m = fechMes(); if (m < mesIni) m = mesIni; if (m > mesMax) m = mesMax; ST.mesSaldo = m;
    const rec = {}, pag = {}, fat = {}, mk = v => { const x = String(v || '').slice(0, 7); return x < mesIni ? mesIni : x; };
    (d.receber || []).forEach(it => (it.parcelas || []).forEach(p => { const k = mk(p.venc); rec[k] = (rec[k] || 0) + cents(p.valor); }));
    (d.pagar || []).forEach(it => { if (it.forma === 'cartao') return; (it.parcelas || []).forEach(p => { const k = mk(p.venc); if (p.via) return; pag[k] = (pag[k] || 0) + cents(p.valor); }); });
    (d.cartoes || []).forEach(c => faturasDoCartao(d, c.id).forEach(f => { const k = mk(f.venc); fat[k] = (fat[k] || 0) + cents(f.total) - f.linhas.filter(x => x.p.via).reduce((a, x) => a + cents(x.p.valor), 0); }));
    const bancosIni = (d.bancos || []).reduce((a, b) => a + cents(b.saldoIni || 0), 0); // saldo das contas correntes (inicial): positivo abate o negativo, negativo aumenta
    const ini0 = cents((d.saldoIni || {}).receber || 0) - cents((d.saldoIni || {}).pagar || 0) + bancosIni;
    // Movimento de conta corrente: só linhas do extrato JÁ classificadas (gasto/entrada, sem relação com conta a pagar/receber já cadastrada). As que deram baixa em conta a pagar/receber ficam de fora (já contam lá) e as que ainda estão pendentes também.
    const mvE = {}, mvS = {}; (d.extrato || []).forEach(l => { if (!l.classe || (l.baixa && l.baixa.length)) return; const bk = (d.bancos || []).find(b => b.id === l.bancoId); if (bk && bk.saldoIniData && String(l.data) <= String(bk.saldoIniData)) return; const k = mk(l.data), v = cents(l.valor); if (v >= 0) mvE[k] = (mvE[k] || 0) + v; else mvS[k] = (mvS[k] || 0) + v; });
    const linhas = []; let acum = ini0;
    for (let k = mesIni; k <= somaMes(m, 12) && k <= mesMax; k = somaMes(k, 1)) {
      const r = rec[k] || 0, pg = pag[k] || 0, ft = fat[k] || 0, me = mvE[k] || 0, ms = mvS[k] || 0, ant = acum; acum = ant + me + ms + r - pg - ft;
      linhas.push({ k, ant: ant / 100, me: me / 100, ms: ms / 100, mv: (me + ms) / 100, r: r / 100, pg: pg / 100, ft: ft / 100, fim: acum / 100 });
    }
    const L = linhas.find(x => x.k === m) || { ant: 0, mv: 0, me: 0, ms: 0, r: 0, pg: 0, ft: 0, fim: 0 };
    const card = (t, v, c, sub, grande) => '<div style="flex:0 1 ' + (grande ? 215 : 160) + 'px;min-width:140px;border:' + (grande ? '2px solid var(--ink)' : '1px solid var(--border)') + ';border-radius:10px;padding:8px 12px"><div style="font-size:11.5px;color:var(--slate)">' + t + '</div><div style="font-size:' + (grande ? '1.3rem' : '1.05rem') + ';font-weight:800;color:' + c + '">' + R$(v) + '</div>' + (sub ? '<div style="font-size:11px;color:var(--slate);margin-top:2px">' + sub + '</div>' : '') + '</div>';
    const cabec = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><b style="font-size:1.1rem" title="O mês vem da data lá em cima, no topo do site">' + rotMes(m) + '</b>' + (fechMes() < mesIni ? '<span style="font-size:11.5px;color:var(--slate)">(o mês do topo é anterior ao mês inicial dos saldos)</span>' : '') + '<div style="margin-left:auto">' + B('⚙ Saldos iniciais', 'kcbmPf.saldoIniForm()') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:12px">Tudo o que já está cadastrado conta no mês em que vence, tenha sido pago ou não. O saldo começa com o saldo das suas contas correntes (se estiverem negativas, o saldo final fica ainda mais negativo; se positivas, abatem o negativo). O "movimento de conta corrente" soma só o que você classificou no extrato como gasto/entrada; o que deu baixa em conta a pagar, a receber ou fatura não entra de novo (já está nos outros quadros). O saldo do fim de um mês é o saldo com que o mês seguinte começa. Mude o mês pelas setas lá em cima.</div>';
    const cards = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + card('Saldo do mês anterior', L.ant, L.ant < 0 ? '#dc2626' : 'var(--ink)', 'com que ' + rotMes(m) + ' começa' + (m === mesIni && (d.bancos || []).length ? ' (inclui o saldo inicial das contas correntes: ' + R$(bancosIni / 100) + ')' : ''))
      + card('(±) Movimento de conta corrente', L.mv, L.mv < 0 ? '#dc2626' : 'var(--teal)', 'entradas ' + R$(L.me) + ' · saídas ' + R$(L.ms) + ' — só o que você classificou no extrato e não é conta a pagar/receber')
      + card('(+) Contas a receber', L.r, 'var(--teal)', 'receitas que vencem no mês')
      + card('(−) Contas a pagar', L.pg, '#dc2626', 'fora do cartão')
      + card('(−) Faturas de cartão', L.ft, '#dc2626', 'faturas que vencem no mês')
      + card('Saldo no fim do mês', L.fim, L.fim < 0 ? '#dc2626' : '#16a34a', 'passa para o mês seguinte', true) + '</div>';
    const tab = tabela([{ t: 'Mês' }, { t: 'Saldo anterior', r: 1 }, { t: 'Mov. conta corrente', r: 1 }, { t: 'A receber', r: 1 }, { t: 'Contas a pagar', r: 1 }, { t: 'Faturas', r: 1 }, { t: 'Saldo no fim do mês', r: 1 }],
      linhas.filter(x => x.k >= m).slice(0, 13).map(x => '<tr' + (x.k === m ? ' style="font-weight:700;background:rgba(127,127,127,.12)"' : '') + '>' + td(rotMes(x.k)) + td(R$(x.ant), 1) + td('<span style="color:' + (x.mv < 0 ? '#dc2626' : 'var(--teal)') + '">' + R$(x.mv) + '</span>', 1) + td('<span style="color:var(--teal)">' + R$(x.r) + '</span>', 1) + td(R$(-x.pg), 1) + td(R$(-x.ft), 1) + td('<b style="color:' + (x.fim < 0 ? '#dc2626' : '#16a34a') + '">' + R$(x.fim) + '</b>', 1) + '</tr>'), 'Sem dados.', true);
    return cabec + cards + '<div style="font-weight:700;margin:14px 0 6px">Como fica nos próximos meses</div>' + tab;
  }

  // ── Saldo por caixa: só o que EFETIVAMENTE aconteceu (baixas dadas), mês a mês.
  // Começa com o saldo dos bancos (saldo inicial de cada um); depois soma o recebido e tira o que foi pago em contas e em faturas de cartão.
  function abaSaldoCaixa(d) {
    const bancos = d.bancos || [], ev = { rec: {}, pag: {}, fat: {} }, abre = {};
    const add = (tipo, data, v) => { const k = String(data || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(k)) ev[tipo][k] = (ev[tipo][k] || 0) + cents(v); };
    (d.receber || []).forEach(it => (it.parcelas || []).forEach(p => { if (p.pago && p.dataPago) add('rec', p.dataPago, p.valor); }));
    (d.pagar || []).forEach(it => (it.parcelas || []).forEach(p => { if (p.pago && p.dataPago && !p.via) add(it.forma === 'cartao' ? 'fat' : 'pag', p.dataPago, p.valor); }));
    // o saldo inicial de cada banco entra no mês seguinte à data do saldo (ou no 1º mês com movimento, se não tiver data)
    const meses = [].concat(Object.keys(ev.rec), Object.keys(ev.pag), Object.keys(ev.fat));
    bancos.forEach(b => { if (!Number(b.saldoIni)) return; const k = b.saldoIniData ? somaMes(b.saldoIniData.slice(0, 7), 1) : null; if (k) { abre[k] = (abre[k] || 0) + cents(b.saldoIni); meses.push(k); } });
    const semData = bancos.filter(b => Number(b.saldoIni) && !b.saldoIniData).reduce((a, b) => a + cents(b.saldoIni), 0);
    const mesIni = meses.length ? meses.reduce((x, y) => x < y ? x : y) : fechMes(); if (semData) abre[mesIni] = (abre[mesIni] || 0) + semData;
    const mesMax = somaMes(fechMes() > mesIni ? fechMes() : mesIni, LIMITE_MESES); let m = fechMes(); if (m < mesIni) m = mesIni; if (m > mesMax) m = mesMax;
    const linhas = []; let acum = 0;
    for (let k = mesIni; k <= somaMes(m, 12) && k <= mesMax; k = somaMes(k, 1)) {
      const ini = acum + (abre[k] || 0), r = ev.rec[k] || 0, pg = ev.pag[k] || 0, ft = ev.fat[k] || 0; acum = ini + r - pg - ft;
      linhas.push({ k, ant: ini / 100, r: r / 100, pg: pg / 100, ft: ft / 100, fim: acum / 100 });
    }
    const L = linhas.find(x => x.k === m) || { ant: 0, r: 0, pg: 0, ft: 0, fim: 0 };
    const card = (t, v, c, sub, grande) => '<div style="flex:0 1 ' + (grande ? 215 : 160) + 'px;min-width:140px;border:' + (grande ? '2px solid var(--ink)' : '1px solid var(--border)') + ';border-radius:10px;padding:8px 12px"><div style="font-size:11.5px;color:var(--slate)">' + t + '</div><div style="font-size:' + (grande ? '1.3rem' : '1.05rem') + ';font-weight:800;color:' + c + '">' + R$(v) + '</div>' + (sub ? '<div style="font-size:11px;color:var(--slate);margin-top:2px">' + sub + '</div>' : '') + '</div>';
    const cabec = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><b style="font-size:1.1rem">' + rotMes(m) + '</b><div style="margin-left:auto">' + B('⚙ Saldo inicial dos bancos', "kcbmPf.aba('extrato')") + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:12px">Só o que de fato aconteceu: o saldo dos bancos mais o que você deu baixa como recebido, menos o que deu baixa como pago em contas e em faturas de cartão, pela data da baixa. O saldo do fim do mês passa para o mês seguinte. Mude o mês pelas setas lá em cima.</div>';
    const cards = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + card('Saldo anterior (bancos)', L.ant, L.ant < 0 ? '#dc2626' : 'var(--ink)', 'saldo dos bancos + o que sobrou do mês anterior')
      + card('(+) Recebido no mês', L.r, 'var(--teal)', 'contas a receber com baixa no mês')
      + card('(−) Contas pagas', L.pg, '#dc2626', 'contas a pagar com baixa no mês')
      + card('(−) Faturas pagas', L.ft, '#dc2626', 'faturas de cartão com baixa no mês')
      + card('Saldo por caixa no fim do mês', L.fim, L.fim < 0 ? '#dc2626' : '#16a34a', 'passa para o mês seguinte', true) + '</div>';
    const tab = tabela([{ t: 'Mês' }, { t: 'Saldo anterior', r: 1 }, { t: 'Recebido', r: 1 }, { t: 'Contas pagas', r: 1 }, { t: 'Faturas pagas', r: 1 }, { t: 'Saldo no fim do mês', r: 1 }],
      linhas.filter(x => x.k >= m).slice(0, 13).map(x => '<tr' + (x.k === m ? ' style="font-weight:700;background:rgba(127,127,127,.12)"' : '') + '>' + td(rotMes(x.k)) + td(R$(x.ant), 1) + td('<span style="color:var(--teal)">' + R$(x.r) + '</span>', 1) + td(R$(-x.pg), 1) + td(R$(-x.ft), 1) + td('<b style="color:' + (x.fim < 0 ? '#dc2626' : '#16a34a') + '">' + R$(x.fim) + '</b>', 1) + '</tr>'), 'Sem dados.', true);
    return cabec + cards + '<div style="font-weight:700;margin:14px 0 6px">Mês a mês (pelo que foi baixado)</div>' + tab;
  }
  // ── Efetivado: só o que de fato foi pago/recebido (pela data da baixa); o saldo passa para o mês seguinte ──
  function blocoEfetivado(d, m) {
    const ini = m + '-01', fim = m + '-31', ev = [];
    (d.pagar || []).forEach(it => (it.parcelas || []).forEach(p => { if (p.pago && p.dataPago) ev.push({ k: it.forma === 'cartao' ? 'fat' : 'pag', data: p.dataPago, valor: Number(p.valor) || 0, it, p }); }));
    (d.receber || []).forEach(it => (it.parcelas || []).forEach(p => { if (p.pago && p.dataPago) ev.push({ k: 'rec', data: p.dataPago, valor: Number(p.valor) || 0, it, p }); }));
    const soma = (k, f) => ev.filter(e => e.k === k && f(e.data)).reduce((a, e) => a + cents(e.valor), 0) / 100;
    const noMes = x => x >= ini && x <= fim, antes = x => x < ini;
    const fatM = soma('fat', noMes), pagM = soma('pag', noMes), recM = soma('rec', noMes);
    const ant = (cents(soma('rec', antes)) - cents(soma('pag', antes)) - cents(soma('fat', antes))) / 100, saldo = (cents(ant) + cents(recM) - cents(pagM) - cents(fatM)) / 100;
    const card = (t, v, c, sub) => '<div style="flex:1 1 220px;border:1px solid var(--border);border-radius:10px;padding:10px 14px"><div style="font-size:11.5px;color:var(--slate)">' + t + '</div><div style="font-size:1.15rem;font-weight:700;color:' + c + '">' + R$(v) + '</div>' + (sub ? '<div style="font-size:10.5px;color:var(--slate)">' + sub + '</div>' : '') + '</div>';
    // faturas pagas no mês (uma linha por cartão/fatura)
    const fg = {}; ev.filter(e => e.k === 'fat' && noMes(e.data)).forEach(e => { const key = e.it.cartaoId + '|' + (e.p.fatura || ''); const g = fg[key] = fg[key] || { cartao: (d.cartoes || []).find(c => c.id === e.it.cartaoId), fatura: e.p.fatura || '', venc: e.p.venc || '', data: e.data, valor: 0 }; g.valor += e.valor; if (e.data > g.data) g.data = e.data; });
    const fatLin = Object.values(fg).sort((a, b) => a.data.localeCompare(b.data)).map(g => '<tr>' + td('<span style="display:inline-flex;align-items:center;gap:6px">' + (g.cartao ? emissorLogo(emissorDe(g.cartao), 20) + E(g.cartao.nome) : 'Cartão') + '</span>') + td(g.fatura ? rotMes(g.fatura) : '') + td(br(g.venc)) + td(br(g.data)) + td(R$(g.valor), 1) + '</tr>');
    const bloco = (k, tit, total, quem, sinalPago) => {
      const lin = ev.filter(e => e.k === k && noMes(e.data)).sort((a, b) => a.data.localeCompare(b.data)).map(e => '<tr>' + td(br(e.data)) + td(E(e.it[quem]) + (k === 'pag' ? seloPorQuem(e.it) : '') + (e.it.rec ? ' <span title="recorrente">↻</span>' : '')) + td(e.it.rec ? recRot(it) : (e.it.parcelado ? e.p.n + '/' + e.it.n : 'à vista')) + td(R$(e.valor), 1) + '</tr>');
      return '<div style="flex:1 1 440px;min-width:300px"><div style="font-weight:700;margin-bottom:6px">' + tit + '</div>'
        + '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px;display:flex;justify-content:space-between"><span><b>Total ' + (sinalPago ? 'pago' : 'recebido') + ' no mês</b></span><b style="font-size:15px;color:' + (sinalPago ? '#dc2626' : 'var(--teal)') + '">' + R$(total) + '</b></div>'
        + tabela([{ t: sinalPago ? 'Pago em' : 'Recebido em' }, { t: sinalPago ? 'A quem pago' : 'De quem recebo' }, { t: 'Parcela' }, { t: 'Valor', r: 1 }], lin, sinalPago ? 'Nenhuma conta paga neste mês.' : 'Nada recebido neste mês.') + '</div>';
    };
    return '<div style="border-top:2px solid var(--border);margin:26px 0 10px;padding-top:14px"><div style="font-weight:800;font-size:1.05rem">✅ Efetivado — o que realmente foi pago e recebido</div><div style="font-size:12px;color:var(--slate);margin:2px 0 10px">Conta pela data em que a baixa foi dada. O saldo efetivado do fim do mês passa para o mês seguinte.</div></div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' + card(CARTAO + ' Faturas pagas no mês', fatM, '#dc2626') + card('🧾 Contas pagas no mês', pagM, '#dc2626') + card('💰 Contas recebidas no mês', recM, 'var(--teal)') + card('⚖ Saldo efetivado (acumulado)', saldo, saldo < 0 ? '#dc2626' : '#16a34a', 'saldo anterior ' + R$(ant) + ' + recebido − pago − faturas') + '</div>'
      + '<div style="font-weight:700;margin-bottom:6px">' + CARTAO + ' Cartões de crédito — faturas pagas neste mês</div>' + tabela([{ t: 'Cartão' }, { t: 'Fatura' }, { t: 'Vencimento' }, { t: 'Pago em' }, { t: 'Valor pago', r: 1 }], fatLin, 'Nenhuma fatura paga neste mês.')
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-top:16px">' + bloco('pag', '🧾 Contas pagas (fora do cartão)', pagM, 'fornecedor', true) + bloco('rec', '💰 Contas recebidas', recM, 'cliente', false) + '</div>';
  }


  // ───────────── ações ─────────────
  const K = {
    tela(t) { ST.tela = t; ST.pf = null; render(); },
    exportar() { // backup de tudo do módulo (lista, cadastros universais e os dados de cada pessoa)
      const dados = {}; ['kcbm_pf_lista', 'kcbm_pf_tipos', 'kcbm_pf_terceiros', 'kcbm_pf_porquem', 'kcbm_pf_bandeiras'].forEach(k => { const v = lerChave(k, null); if (v != null) dados[k] = v; });
      lerLista().forEach(p => { const v = lerChave('kcbm_pf_' + p.id, null); if (v != null) dados['kcbm_pf_' + p.id] = v; });
      const blob = new Blob([JSON.stringify({ app: 'kcbm-pf', em: new Date().toISOString(), dados }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pessoa-fisica-backup-' + hoje() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      root.toast('Arquivo baixado (' + Object.keys(dados).length + ' itens).', 'ok');
    },
    novaPessoa() { modal('Nova pessoa física', formPessoa(null), m => { const f = lerFormPessoa(m); if (!f) return false; const l = lerLista(); const p = { id: uid(), criado: Date.now(), ...f }; l.push(p); gravarLista(l); gravarDados(p.id, novoDados()); K.abrir(p.id); root.toast('Pessoa cadastrada.', 'ok'); }); },
    editarPessoa(id) { const p = lerLista().find(x => x.id === id); if (!p) return; modal('Editar pessoa física', formPessoa(p), m => { const f = lerFormPessoa(m); if (!f) return false; gravarLista(lerLista().map(x => x.id === id ? Object.assign({}, x, f) : x)); render(); }); },
    excluirPessoa(id) { const p = lerLista().find(x => x.id === id); if (!p) return; if (!confirm('Excluir "' + p.nome + '" e TODOS os dados dela (contas, extrato, cartões)?\n\nNão dá para desfazer.')) return; if (prompt('Para confirmar, digite o nome da pessoa:') !== p.nome) { root.toast('Nome não confere — nada foi excluído.', 'err'); return; } gravarLista(lerLista().filter(x => x.id !== id)); render(); },
    abrir(id) { ST.pf = id; ST.tela = 'lista'; ST.aba = 'movimentacao'; ST.mesSaldo = null; ST.cartaoSel = null; ST.mesFatura = null; render(); },
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
    porQuemForm(id) {
      const t = id ? lerPorQuem().find(x => x.id === id) : null;
      modal(t ? 'Editar nome' : 'Novo — por quem pago', campo('Nome', inp('kpfNomePQ', t ? t.nome : '', 'text', 'maxlength="80"'), 'Ex.: o nome de uma filha.'), m => {
        const nome = (val(m, 'kpfNomePQ') || '').trim(); if (!nome) { root.toast('Informe o nome.', 'err'); return false; }
        const l = lerPorQuem(); if (l.some(x => x.id !== (t && t.id) && norm(x.nome) === norm(nome))) { root.toast('Já existe esse nome.', 'err'); return false; }
        gravarChave('kcbm_pf_porquem', t ? l.map(x => x.id === t.id ? { id: t.id, nome } : x) : l.concat([{ id: uid(), nome }])); render();
      });
    },
    porQuemExcluir(id) { const t = lerPorQuem().find(x => x.id === id); if (!t) return; if (!confirm('Excluir "' + t.nome + '" da lista? Os lançamentos que já têm esse selinho continuam com ele.')) return; gravarChave('kcbm_pf_porquem', lerPorQuem().filter(x => x.id !== id)); render(); },
    porQuemDefinir(tipo, id) {
      const dd = dadosAtual(), it = (dd[tipo] || []).find(x => x.id === id); if (!it) return;
      modal('Por quem eu pago — ' + E(it[tipo === 'pagar' ? 'fornecedor' : 'cliente']), campo('Nome (deixe vazio para tirar o selinho)', inp('kpfPQ', it.porQuem || '', 'text', 'maxlength="80" list="kpfDLPQ" autocomplete="off"') + datalistPorQuem('kpfDLPQ'), 'Comece a digitar para puxar da lista; se for novo, entra na lista sozinho.'), m => {
        const nome = (val(m, 'kpfPQ') || '').trim(); const d2 = dadosAtual(), x = (d2[tipo] || []).find(y => y.id === id); if (!x) return false;
        if (nome) { x.porQuem = nome; registrarPorQuem(nome); } else delete x.porQuem;
        gravarDados(ST.pf, d2); render();
      });
    },
    tercForm(id) {
      const t = id ? lerTerceiros().find(x => x.id === id) : null;
      modal(t ? 'Editar cadastro' : 'Novo cadastro (a quem pago / de quem recebo)', campo('Nome', inp('kpfNomeF', t ? t.nome : '', 'text', 'maxlength="120"')) + campo('Tipo', sel('kpfTipoF', [['fornecedor', 'A quem pago'], ['cliente', 'De quem recebo'], ['ambos', 'Os dois']], t ? t.tipo : 'fornecedor')) + campo('CPF/CNPJ (opcional)', inp('kpfDocF', t ? t.doc : '', 'text', 'maxlength="20"')), m => {
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
      modal('Lançar no extrato bancário', campo('Data', inp('kpfData', hoje(), 'date')) + (dadosAtual().bancos.length ? campo('Banco', sel('kpfBkSel', dadosAtual().bancos.map(b => [b.id, b.nome]), ST.bancoSel || dadosAtual().bancos[0].id)) : campo('Banco / conta', inp('kpfBanco', '', 'text', 'maxlength="60"'))) + campo('Histórico', inp('kpfHist', '', 'text', 'maxlength="140"')) + campo('Tipo', sel('kpfTipo', [['sai', 'Saída (pagamento)'], ['ent', 'Entrada (recebimento)']], 'sai')) + campo('Valor (R$)', inp('kpfValor', '', 'text', 'inputmode="decimal"')),
        m => { const v = num(val(m, 'kpfValor')); if (!val(m, 'kpfData') || !(v > 0)) { root.toast('Informe a data e um valor maior que zero.', 'err'); return false; } const dd = dadosAtual(); dd.extrato.push({ id: uid(), criado: Date.now(), data: val(m, 'kpfData'), banco: ((dd.bancos.find(b => b.id === val(m, 'kpfBkSel')) || {}).nome || (val(m, 'kpfBanco') || '').trim()), bancoId: val(m, 'kpfBkSel') || '', hist: (val(m, 'kpfHist') || '').trim(), valor: val(m, 'kpfTipo') === 'sai' ? -v : v, baixa: null, classe: null }); const nb0 = baixaAutomatica(dd); if (nb0) root.toast(nb0 + ' baixa(s) automática(s).', 'ok'); gravarDados(ST.pf, dd); render(); });
    },
    async importarPdf() {
      const d0 = dadosAtual(); if (!d0.bancos.length) { root.toast('Adicione um banco antes de importar o extrato.', 'err'); return; } const bk = d0.bancos.find(b => b.id === ST.bancoSel); if (!bk) { root.toast('Clique no cartão do banco (Caixa, Bradesco…) e depois importe o PDF dele.', 'err'); return; }
      const inpf = document.createElement('input'); inpf.type = 'file'; inpf.accept = 'application/pdf,.pdf';
      inpf.onchange = async () => {
        const f = inpf.files && inpf.files[0]; if (!f) return;
        if (typeof pdfjsLib === 'undefined' || typeof _lancctbParsearExtratoGenerico !== 'function') { root.toast('Leitor de PDF indisponível nesta página — recarregue (Ctrl+F5).', 'err'); return; }
        root.toast('Lendo o extrato…', 'info');
        let r = null; try { const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise; r = await _lancctbParsearExtratoGenerico(pdf); } catch (e) { console.warn('PF: leitura do PDF', e); }
        if (!r || !r.lancamentos || !r.lancamentos.length) { modal('Não consegui ler este extrato', '<div style="font-size:13px;line-height:1.6">O leitor só aceita o extrato quando o <b>saldo confere</b> linha a linha — e neste PDF não conferiu (ou o formato ainda não é reconhecido).<br><br>Nada foi importado. <b>Me envie o modelo desse banco (Caixa, Bradesco…)</b> que eu ajusto o leitor. Enquanto isso dá para lançar à mão.</div>', null); return; }
        const dd = dadosAtual(), ja = new Set(dd.extrato.filter(l => l.bancoId === bk.id).map(l => l.data + '|' + cents(l.valor) + '|' + norm(l.hist)));
        const novas = r.lancamentos.map(x => ({ data: x.data, hist: String(x.historico || '').trim(), valor: x.valor_entrada > 0 ? x.valor_entrada : -(x.valor_saida || 0) })).filter(x => x.valor);
        const repetidas = novas.filter(x => ja.has(x.data + '|' + cents(x.valor) + '|' + norm(x.hist))).length;
        const bancos = ['Caixa Econômica', 'Bradesco', 'Itaú', 'Banco do Brasil', 'Santander', 'Nubank', 'Inter', 'C6 Bank', 'Outro'];
        const ent = novas.filter(x => x.valor > 0).reduce((a, x) => a + cents(x.valor), 0) / 100, sai = novas.filter(x => x.valor < 0).reduce((a, x) => a + cents(x.valor), 0) / 100;
        const corpo = '<div style="font-size:12.5px;margin-bottom:8px"><b>' + novas.length + '</b> lançamento(s) lidos · Entradas <b style="color:var(--teal)">' + R$(ent) + '</b> · Saídas <b style="color:#dc2626">' + R$(sai) + '</b>' + (r.observacao ? '<br><span style="color:var(--teal)">' + E(r.observacao) + '</span>' : '') + (repetidas ? '<br><span style="color:#b45309">' + repetidas + ' já existem neste extrato (mesma data, valor e histórico) e não serão repetidos.</span>' : '') + '</div>'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px">' + bancoLogo(bk.tipo, 26) + 'Será importado em <b>' + E(bk.nome) + '</b> (o PDF não é guardado, só as linhas).</div>'
          + '<div style="max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:8px">' + tabela([{ t: 'Data' }, { t: 'Histórico' }, { t: 'Valor', r: 1 }], novas.slice(0, 300).map(x => '<tr>' + td(br(x.data)) + td(E(x.hist)) + '<td style="' + TD + ';text-align:right;color:' + cor(x.valor) + '">' + R$(x.valor) + '</td></tr>'), '') + '</div>' + (novas.length > 300 ? '<div style="font-size:11px;color:var(--slate)">Mostrando as 300 primeiras; todas serão importadas.</div>' : '');
        modal('Importar extrato — conferir', corpo, m => {
          const banco = bk.nome;
          const d2 = dadosAtual(), ja2 = new Set(d2.extrato.filter(l => l.bancoId === bk.id).map(l => l.data + '|' + cents(l.valor) + '|' + norm(l.hist))); let n = 0;
          novas.forEach(x => { const k = x.data + '|' + cents(x.valor) + '|' + norm(x.hist); if (ja2.has(k)) return; ja2.add(k); d2.extrato.push({ id: uid(), criado: Date.now() + n, data: x.data, banco, bancoId: bk.id, hist: x.hist, valor: x.valor, baixa: null, classe: null }); n++; });
          const nb = baixaAutomatica(d2); gravarDados(ST.pf, d2); render(); root.toast(n + ' lançamento(s) importado(s)' + (nb ? ' · ' + nb + ' baixa(s) automática(s)' : '') + '. Agora é só classificar o que sobrou.', 'ok');
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
    extratoExcluir(id) { { const l0 = dadosAtual().extrato.find(x => x.id === id); if (l0 && ((l0.baixa && l0.baixa.length) || l0.classe)) { root.toast('Esta linha do extrato já deu baixa (ou foi classificada). O site não exclui o que já foi pago ou recebido. Use ↩ Desfazer antes.', 'err'); return; } } if (!confirm('Excluir esta linha do extrato? (A baixa feita nela é desfeita.)')) return; K.extratoDesfazer(id, true); const dd = dadosAtual(); dd.extrato = dd.extrato.filter(l => l.id !== id); gravarDados(ST.pf, dd); render(); },
    extratoDesfazer(id, silencioso) {
      const dd = dadosAtual(), l = dd.extrato.find(x => x.id === id); if (!l) return;
      (l.baixa || []).forEach(b => { const it = (dd[b.tipo] || []).find(x => x.id === b.itemId); if (it) (it.parcelas || []).forEach(p => { if (p.n === b.n && p.extratoId === id) { p.pago = false; p.dataPago = null; delete p.extratoId; } }); });
      if (l.classe && l.classe.tipo === 'transferencia') { const par = l.classe.parId && dd.extrato.find(x => x.id === l.classe.parId); if (par && par.classe) { if (par.classe.auto) par.classe = null; else par.classe.parId = null; } }
      else if (l.classe) { const lista = l.valor < 0 ? 'gastos' : 'entradas'; dd[lista] = dd[lista].filter(x => x.extratoId !== id); }
      l.baixa = null; l.classe = null; gravarDados(ST.pf, dd); if (!silencioso) render();
    },
    extratoBaixar(id) {
      const dd = dadosAtual(), l = dd.extrato.find(x => x.id === id); if (!l) return;
      const sai = l.valor < 0, tipo = sai ? 'pagar' : 'receber', abs = Math.abs(l.valor);
      const pend = []; (dd[tipo] || []).forEach(it => (it.parcelas || []).forEach(p => { if (!p.pago) pend.push({ it, p }); })); pend.sort((a, b) => a.p.venc.localeCompare(b.p.venc));
      const linhas = pend.slice(0, 300).map((x, i) => '<label style="display:flex;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid var(--border);font-size:12.5px;cursor:pointer"><input type="checkbox" class="kpfSelP" data-i="' + i + '" data-v="' + cents(x.p.valor) + '"> <span style="flex:1">' + br(x.p.venc) + ' · ' + E(x.it[sai ? 'fornecedor' : 'cliente']) + ' · ' + (x.it.rec ? recRot(it) : (x.it.parcelado ? x.p.n + '/' + x.it.n : 'à vista')) + (x.it.forma === 'cartao' ? ' · ' + CARTAO + ' fatura ' + x.p.fatura : '') + '</span><b>' + R$(x.p.valor) + '</b></label>').join('');
      const corpo = '<div style="font-size:12.5px;margin-bottom:8px"><b>' + br(l.data) + '</b> · ' + E(l.hist) + ' · <b style="color:' + cor(l.valor) + '">' + R$(l.valor) + '</b></div>'
        + '<div style="font-weight:600;font-size:12.5px;margin-bottom:4px">' + (sai ? 'Dar baixa em contas a pagar' : 'Dar baixa em contas a receber') + ' <span id="kpfSoma" style="font-weight:400;color:var(--slate)"></span></div><div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px">' + (linhas || '<div style="padding:14px;color:var(--slate);font-size:12.5px">Nada em aberto.</div>') + '</div>'
        + '<div style="margin:12px 0 4px;font-weight:600;font-size:12.5px">…ou classificar direto como ' + (sai ? 'gasto' : 'entrada') + '</div>' + campo(sai ? 'Tipo de gasto' : 'Tipo de receita', selTipo('kpfCatC', sai ? 'gasto' : 'receita', ''), 'Escolha só se NÃO for dar baixa em uma conta acima.')
        + ((dd.bancos || []).length > 1 ? '<div style="margin:12px 0 4px;font-weight:600;font-size:12.5px">…ou é uma <b>transferência entre contas</b> suas</div>' + campo(sai ? 'Para qual banco foi?' : 'De qual banco veio?', sel('kpfTrBanco', [['', '— não é transferência —']].concat((dd.bancos || []).filter(b => b.id !== l.bancoId).map(b => [b.id, b.nome])), ''), 'Se a linha do outro banco já existir (mesma data e valor), as duas se amarram sozinhas. Se não, fica um aviso no outro banco até você conciliar lá.') : '');
      const m = modal('Baixar / classificar — extrato', corpo, mm => {
        const sel2 = [...mm.querySelectorAll('.kpfSelP:checked')].map(c => pend[+c.dataset.i]), cat = (val(mm, 'kpfCatC') || '').trim(), trB = (val(mm, 'kpfTrBanco') || '');
        const d2 = dadosAtual(), l2 = d2.extrato.find(x => x.id === id);
        if (sel2.length) {
          const soma = sel2.reduce((a, x) => a + cents(x.p.valor), 0);
          if (soma !== cents(abs) && !confirm('A soma marcada (' + R$(soma / 100) + ') é diferente do valor do extrato (' + R$(abs) + '). Dar baixa mesmo assim?')) return false;
          l2.baixa = []; sel2.forEach(x => { const it = d2[tipo].find(y => y.id === x.it.id); const p = it.parcelas.find(q => q.n === x.p.n); p.pago = true; p.dataPago = l2.data; p.extratoId = id; l2.baixa.push({ tipo, itemId: it.id, n: p.n }); });
        } else if (trB && !cat) {
          const ob = (d2.bancos || []).find(b => b.id === trB); if (!ob) { root.toast('Banco não encontrado.', 'err'); return false; }
          l2.classe = { tipo: 'transferencia', contraBancoId: ob.id, contraBanco: ob.nome, categoria: 'Transferência entre contas', parId: null }; parearTransferencias(d2);
          gravarDados(ST.pf, d2); render(); root.toast(l2.classe.parId ? 'Transferência amarrada com a linha do ' + ob.nome + '.' : 'Transferência registrada. Fica como aviso no ' + ob.nome + ' até você conciliar lá.', 'ok'); return;
        } else if (cat) { l2.classe = { categoria: cat }; d2[sai ? 'gastos' : 'entradas'].push({ id: uid(), data: l2.data, descricao: l2.hist, categoria: cat, banco: l2.banco, valor: abs, extratoId: id }); }
        else { root.toast('Marque o que está sendo pago/recebido ou escolha o tipo.', 'err'); return false; }
        gravarDados(ST.pf, d2); render(); root.toast('Lançamento contábil gerado.', 'ok');
      }, 'Gerar lançamento');
      const atual = () => { const s = [...m.querySelectorAll('.kpfSelP:checked')].reduce((a, c) => a + (+c.dataset.v), 0); m.querySelector('#kpfSoma').textContent = s ? '— marcado ' + R$(s / 100) + ' de ' + R$(abs) : ''; };
      m.querySelectorAll('.kpfSelP').forEach(c => c.onchange = atual);
    },
    // ── contas a pagar / receber ──
    tituloForm(tipo, pre) {
      pre = pre || {}; const d = dadosAtual(), pag = tipo === 'pagar';
      const corpo = campo('Data', inp('kpfData', hoje(), 'date')) + campo(pag ? 'A quem pago' : 'De quem recebo', inp('kpfQuem', '', 'text', 'maxlength="100" list="kpfDL" autocomplete="off"') + datalistTerc('kpfDL', pag ? 'fornecedor' : 'cliente'), 'Comece a digitar para puxar do cadastro; se for novo, ele entra no cadastro sozinho.') + (pag ? campo('Por quem eu pago (opcional)', inp('kpfPQ', '', 'text', 'maxlength="80" list="kpfDLPQ" autocomplete="off"') + datalistPorQuem('kpfDLPQ'), 'Se o gasto é de outra pessoa (ex.: filha). Aparece como selinho amarelo ao lado de a quem pago.') : '') + campo(pag ? 'Tipo de gasto' : 'Tipo de receita', selTipo('kpfTipoG', pag ? 'gasto' : 'receita', '')) + campo('Valor (R$)', inp('kpfValor', '', 'text', 'inputmode="decimal"'))
        + campo('Forma de ' + (pag ? 'pagamento' : 'recebimento'), sel('kpfForma', (pag ? [['avista', 'À vista / boleto'], ['cartao', 'Cartão de crédito'], ['carne', 'Carnê'], ['outro', 'Outro']] : [['avista', 'À vista / boleto'], ['carne', 'Carnê'], ['outro', 'Outro']]), (pag && pre.forma) || 'avista'))
        + (pag ? '<div id="kpfCartaoBox" style="display:none">' + campo('Cartão', d.cartoes.length ? sel('kpfCartao', d.cartoes.map(c => [c.id, c.nome + (c.bandeira ? ' — ' + c.bandeira : '')]), (pre.cartaoId && d.cartoes.some(x => x.id === pre.cartaoId)) ? pre.cartaoId : d.cartoes[0].id) : '<div style="font-size:12px;color:#b45309">Nenhum cartão cadastrado — cadastre na aba Cartões de crédito.</div>') + '<div id="kpfFatBox">' + campo('Em qual fatura entra? (1º vencimento)', sel('kpfVencFat', [['', 'Automático']], ''), 'Escolha o vencimento da fatura. Se for parcelado, as demais parcelas vão nos meses seguintes.') + '</div></div>' : '')
        + campo('Repetir?', sel('kpfRep', [['nao', 'Não repete — só uma vez'], ['mensal', 'Todo mês'], ['anual', 'Todo ano'], ['semanal', 'Toda semana']], 'nao'), 'Escolha "Não repete" para lançar uma vez só.')
        + '<div id="kpfNaoRecBox">' + campo('Foi parcelado?', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfParc"> Sim</label>') + '<div id="kpfParcBox" style="display:none">' + campo('Em quantas vezes?', inp('kpfN', '2', 'number', 'min="2" max="60"')) + '</div></div>'
        + '<div id="kpfVencBox">' + campo('<span id="kpfVencRot">Vencimento</span>', inp('kpfVenc1', '', 'date'), 'Vencimento é o dia em que a conta vence, ou seja, quando o dinheiro sai ou entra. Se deixar vazio, vale o mesmo dia da data lá em cima.') + '</div>';
      const m = modal(pag ? 'Registrar compra / conta a pagar' : 'Registrar receita a receber', corpo, mm => {
        const v = num(val(mm, 'kpfValor')), quem = (val(mm, 'kpfQuem') || '').trim(), data = val(mm, 'kpfData'), repSel = val(mm, 'kpfRep') || 'nao', rec = repSel !== 'nao', parc = !rec && chk(mm, 'kpfParc'), n = parc ? Math.floor(num(val(mm, 'kpfN'))) : 1, forma = val(mm, 'kpfForma');
        if (!data || !quem || !(v > 0)) { root.toast('Informe a data, ' + (pag ? 'a quem você paga' : 'de quem você recebe') + ' e o valor.', 'err'); return false; }
        if (parc && !(n >= 2)) { root.toast('Informe em quantas vezes (2 ou mais).', 'err'); return false; }
        const dd = dadosAtual(), cartaoId = (pag && forma === 'cartao') ? val(mm, 'kpfCartao') : null, cartao = cartaoId ? dd.cartoes.find(c => c.id === cartaoId) : null;
        if (pag && forma === 'cartao' && !cartao) { root.toast('Escolha o cartão de crédito.', 'err'); return false; }
        if (cartao && !cartao.mesmoDia && !(cartao.fechamento >= 1 && cartao.vencimento >= 1)) { root.toast('Este cartão ainda não tem fechamento e vencimento. Clique no lápis do cartão e preencha.', 'err'); return false; }
        const vencFat = (cartao && !rec) ? (val(mm, 'kpfVencFat') || '') : '';
        const it = { id: uid(), data, [pag ? 'fornecedor' : 'cliente']: quem, tipo: (val(mm, 'kpfTipoG') || '').trim(), valor: v, parcelado: parc, n, forma, cartaoId, venc1: (forma === 'cartao') ? '' : (val(mm, 'kpfVenc1') || '') };
        if (rec) { const base = (forma === 'cartao' ? '' : it.venc1) || data; it.rec = true; it.freq = repSel; it.diaVenc = +base.slice(8, 10); it.inicio = cartao ? data.slice(0, 7) : base.slice(0, 7); if (repSel === 'semanal') it.inicioData = base; it.parcelas = []; estenderRecorrencia(it, cartao, somaMes(fechMes(), LIMITE_MESES)); } else { if (vencFat) it.vencFat = vencFat; it.parcelas = gerarParcelas(it, cartao); }
        const pq = pag ? (val(mm, 'kpfPQ') || '').trim() : ''; if (pq) { it.porQuem = pq; registrarPorQuem(pq); }
        dd[tipo].push(it); registrarTerceiro(quem, pag ? 'fornecedor' : 'cliente'); gravarDados(ST.pf, dd); render(); root.toast(rec ? 'Repetição criada (' + recRot(it) + '): ' + it.parcelas.length + ' mês(es) projetado(s).' : 'Registrado: ' + it.parcelas.length + ' parcela(s) gerada(s).', 'ok');
      }, 'Salvar', 620);
      const atualizar = () => {
        const rp = val(m, 'kpfRep') || 'nao', rec = rp !== 'nao', cart = pag && val(m, 'kpfForma') === 'cartao', parc = !rec && chk(m, 'kpfParc');
        m.querySelector('#kpfNaoRecBox').style.display = rec ? 'none' : ''; m.querySelector('#kpfParcBox').style.display = parc ? '' : 'none';
        const cb = m.querySelector('#kpfCartaoBox'); if (cb) cb.style.display = cart ? '' : 'none';
        m.querySelector('#kpfVencBox').style.display = cart ? 'none' : '';
        m.querySelector('#kpfVencRot').textContent = rec ? 'Primeiro vencimento' : (parc ? 'Vencimento da 1ª parcela' : 'Vencimento');
      };
      const refazFat = () => { const sl = m.querySelector('#kpfVencFat'); if (!sl) return; const c = d.cartoes.find(x => x.id === val(m, 'kpfCartao')), atual = sl.value; sl.innerHTML = opcoesFatura(c, val(m, 'kpfData')).map(o => '<option value="' + o[0] + '"' + (o[0] === atual ? ' selected' : '') + '>' + E(o[1]) + '</option>').join(''); m.querySelector('#kpfFatBox').style.display = (val(m, 'kpfRep') || 'nao') === 'nao' ? '' : 'none'; };
      ['kpfRep', 'kpfParc', 'kpfForma'].forEach(i => { m.querySelector('#' + i).onchange = () => { atualizar(); refazFat(); }; }); atualizar();
      const cs = m.querySelector('#kpfCartao'); if (cs) cs.onchange = refazFat; m.querySelector('#kpfData').onchange = refazFat; refazFat();
    },
    tituloEditar(tipo, id) {
      const d = dadosAtual(), it = (d[tipo] || []).find(x => x.id === id); if (!it) return; if ((it.parcelas || []).some(q => q.pago)) { root.toast('Já tem parcela paga/recebida. O site não edita o que já foi pago ou recebido. Para mudar o valor de uma ocorrência em aberto use o botão Parcelas; para mexer no resto, desfaça a baixa primeiro.', 'err'); return; } if (it.manual) { K.saldoCartaoEditar(id); return; }
      const pag = tipo === 'pagar', cartao = it.cartaoId ? d.cartoes.find(c => c.id === it.cartaoId) : null, temPago = (it.parcelas || []).some(p => p.pago), travaValor = !!(it.rec || temPago);
      const mvAtual = it.vencFat || ((it.parcelas || [])[0] && (it.parcelas[0].venc || '').slice(0, 7)) || '';
      const corpo = campo('Data da compra / lançamento', inp('kpfEData', it.data || hoje(), 'date')) + campo(pag ? 'A quem pago' : 'De quem recebo', inp('kpfEQuem', it[pag ? 'fornecedor' : 'cliente'] || '', 'text', 'maxlength="100" list="kpfDL" autocomplete="off"') + datalistTerc('kpfDL', pag ? 'fornecedor' : 'cliente'))
        + (pag ? campo('Por quem eu pago (opcional)', inp('kpfEPQ', it.porQuem || '', 'text', 'maxlength="80" list="kpfDLPQ" autocomplete="off"') + datalistPorQuem('kpfDLPQ')) : '')
        + campo(pag ? 'Tipo de gasto' : 'Tipo de receita', selTipo('kpfETipo', pag ? 'gasto' : 'receita', it.tipo || ''))
        + campo('Valor total (R$)', inp('kpfEValor', String(it.valor).replace('.', ','), 'text', 'inputmode="decimal"' + (travaValor ? ' disabled' : '')), travaValor ? (it.rec ? 'Em repetição: para mudar o valor de uma ocorrência use "Parcelas".' : 'Já há parcela baixada: o valor e a fatura não podem mudar aqui. Desfaça a baixa antes.') : (it.parcelado ? 'Será dividido nas ' + it.n + ' parcelas.' : ''))
        + (cartao && !it.rec ? campo('Em qual fatura entra? (1º vencimento)', sel('kpfEFat', opcoesFatura(cartao, it.data).map((o, i) => o).filter(o => true), it.vencFat || ''), temPago ? 'Já há parcela baixada: a fatura não pode mudar.' : 'Mude para jogar a compra em outra fatura. Hoje: ' + (mvAtual ? br(((it.parcelas || [])[0] || {}).venc) : '')) : '')
        + (!cartao && !it.rec && !it.parcelado ? campo('Vencimento', inp('kpfEVenc', ((it.parcelas || [])[0] || {}).venc || '', 'date' + (temPago ? '' : ''), temPago ? 'disabled' : '')) : '');
      const m = modal('Editar — ' + E(it[pag ? 'fornecedor' : 'cliente']), corpo, mm => {
        const quem = (val(mm, 'kpfEQuem') || '').trim(), data = val(mm, 'kpfEData'), v = num(val(mm, 'kpfEValor'));
        if (!quem || !data || (!travaValor && !(v > 0))) { root.toast('Informe a data, o nome e um valor maior que zero.', 'err'); return false; }
        const dd = dadosAtual(), x = dd[tipo].find(y => y.id === id); if (!x) return false;
        x.data = data; x[pag ? 'fornecedor' : 'cliente'] = quem; x.tipo = (val(mm, 'kpfETipo') || '').trim(); if (x.taxaAuto) x.taxaEditada = true;
        if (pag) { const pq = (val(mm, 'kpfEPQ') || '').trim(); if (pq) { x.porQuem = pq; registrarPorQuem(pq); } else delete x.porQuem; }
        if (!travaValor) {
          x.valor = v; const c = x.cartaoId ? dd.cartoes.find(k => k.id === x.cartaoId) : null;
          if (c) { const vf = val(mm, 'kpfEFat') || ''; if (vf) x.vencFat = vf; else delete x.vencFat; }
          else if (!x.parcelado) x.venc1 = val(mm, 'kpfEVenc') || '';
          x.parcelas = gerarParcelas(x, c);
        }
        registrarTerceiro(quem, pag ? 'fornecedor' : 'cliente'); gravarDados(ST.pf, dd); render(); root.toast('Alterado.', 'ok');
      }, 'Salvar', 560);
      const sf = m.querySelector('#kpfEFat'); if (sf) { sf.value = it.vencFat || ''; if (temPago) sf.disabled = true; }
    },
    tituloVer(tipo, id) {
      const d = dadosAtual(), it = d[tipo].find(x => x.id === id); if (!it) return; const pag = tipo === 'pagar';
      const linhas = (it.parcelas || []).map(p => '<tr>' + td(it.rec ? (it.freq === 'semanal' ? br(p.venc) : rotMes(p.mes)) : p.n + '/' + (it.parcelado ? it.n : 1)) + td(br(p.venc) + (p.fatura ? ' <span style="color:var(--slate);font-size:11px">(fatura ' + p.fatura + ')</span>' : '')) + td(R$(p.valor), 1) + td(p.pago ? '<span style="color:var(--teal)">' + (pag ? 'paga' : 'recebida') + ' em ' + br(p.dataPago) + '</span>' : 'em aberto') + '<td style="' + TD + ';text-align:right">' + (p.pago ? '' : B('✏️ valor', "kcbmPf.parcelaValor('" + tipo + "','" + it.id + "'," + p.n + ")")) + '</td></tr>').join('');
      modal((pag ? 'Conta — ' : 'Receita — ') + E(it[pag ? 'fornecedor' : 'cliente']) + seloPorQuem(it), '<div style="font-size:12.5px;margin-bottom:8px">' + br(it.data) + ' · ' + R$(it.valor) + (it.rec ? (it.freq === 'anual' ? ' por ano' : it.freq === 'semanal' ? ' por semana' : ' por mês') : '') + ' · ' + E(it.tipo || '') + (it.rec ? ' · <b>recorrente</b> (' + (it.parcelas || []).length + ' mês(es) projetado(s))' : '') + '</div>' + (it.rec ? '<div style="margin-bottom:8px">' + B('⏹ Encerrar recorrência…', "kcbmPf.recEncerrar('" + tipo + "','" + it.id + "')") + '</div>' : '') + '<div style="max-height:360px;overflow:auto">' + tabela([{ t: it.rec ? (it.freq === 'semanal' ? 'Semana' : (it.freq === 'anual' ? 'Ano' : 'Mês')) : 'Parcela' }, { t: 'Vencimento' }, { t: 'Valor', r: 1 }, { t: 'Situação' }, { t: '' }], [linhas], '') + '</div><div style="font-size:11.5px;color:var(--slate);margin-top:8px">A baixa é feita na aba Extrato bancário (Baixar / classificar).</div>', null, null, 700);
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
    excluirSo(tipo, id, n) {
      const m = document.getElementById('kpfModal'); if (m) m.remove();
      const dd = dadosAtual(), it = (dd[tipo] || []).find(x => x.id === id); if (!it) return; const p = (it.parcelas || []).find(q => q.n === n); if (!p) return;
      if (p.pago) { root.toast('Essa ocorrência já foi paga/recebida: o site não exclui o que já foi pago ou recebido. Desfaça a baixa antes.', 'err'); return; }
      it.puladas = (it.puladas || []).concat([it.freq === 'semanal' ? (p.dia || p.venc) : p.mes]);
      it.parcelas = it.parcelas.filter(q => q !== p); if (!it.parcelas.length) dd[tipo] = dd[tipo].filter(x => x.id !== id);
      gravarDados(ST.pf, dd); render(); root.toast('Só esta ocorrência foi excluída. As outras continuam.', 'ok');
    },
    excluirSeguintes(tipo, id, n) {
      const m = document.getElementById('kpfModal'); if (m) m.remove();
      const dd = dadosAtual(), it = (dd[tipo] || []).find(x => x.id === id); if (!it) return; const p = (it.parcelas || []).find(q => q.n === n); if (!p) return;
      const chave = q => it.freq === 'semanal' ? (q.dia || q.venc) : (q.mes || (q.venc || '').slice(0, 7)), k0 = chave(p), mes0 = (p.mes || (p.venc || '').slice(0, 7));
      if (p.pago) { root.toast('Essa ocorrência já foi paga/recebida: o site não exclui o que já foi pago ou recebido. Desfaça a baixa antes.', 'err'); return; }
      it.fim = mes0; it.parcelas = (it.parcelas || []).filter(q => q.pago || !(chave(q) >= k0));
      if (!it.parcelas.length) dd[tipo] = dd[tipo].filter(x => x.id !== id);
      gravarDados(ST.pf, dd); render(); root.toast('Esta e as seguintes foram excluídas. As anteriores e as que já foram pagas/recebidas continuam.', 'ok');
    },
    excluirTudo(tipo, id) { const m = document.getElementById('kpfModal'); if (m) m.remove(); K.tituloExcluir(tipo, id, null, true); },
    tituloExcluir(tipo, id, n, tudo) { const dd = dadosAtual(), it = dd[tipo].find(x => x.id === id); if (!it) return;
      if (it.rec && n != null && !tudo) { const p = (it.parcelas || []).find(q => q.n === n); if (p && p.pago) { root.toast('Essa ocorrência já foi paga/recebida: o site não exclui o que já foi pago ou recebido. Desfaça a baixa antes.', 'err'); return; } const qual = p ? (it.freq === 'semanal' ? br(p.venc) : rotMes(p.mes || (p.venc || '').slice(0, 7))) : '';
        modal('Excluir — ' + E(it[tipo === 'pagar' ? 'fornecedor' : 'cliente']), '<div style="font-size:13.5px;line-height:1.6;margin-bottom:12px">Este lançamento se repete (' + recRot(it) + '). O que você quer excluir?</div><div style="display:flex;flex-direction:column;gap:8px">' + B('Só esta (' + qual + ')', "kcbmPf.excluirSo('" + tipo + "','" + id + "'," + n + ")", 'bp') + B('Esta e todas as seguintes', "kcbmPf.excluirSeguintes('" + tipo + "','" + id + "'," + n + ")", 'bp') + B('Toda a recorrência (inclusive as anteriores)', "kcbmPf.excluirTudo('" + tipo + "','" + id + "')", 'bo') + '</div>', null, null, 460); return; } if (it.taxaAuto) { const cc = dd.cartoes.find(x => x.id === it.cartaoId); if (cc) cc.taxaIgnorar = (cc.taxaIgnorar || []).concat([it.taxaAuto + '|' + ((it.parcelas || [])[0] || {}).fatura]); } if ((it.parcelas || []).some(p => p.pago)) { root.toast('Já tem parcela paga/recebida. Por segurança o site NÃO exclui nem edita o que já foi pago ou recebido. Se precisar mexer, desfaça a baixa primeiro.', 'err'); return; } if (!confirm('Excluir este registro e todas as suas parcelas' + (it.rec ? ' (e a recorrência)' : '') + '?')) return; dd[tipo] = dd[tipo].filter(x => x.id !== id); dd.extrato.forEach(l => { l.baixa = (l.baixa || []).filter(b => b.itemId !== id); if (l.baixa && !l.baixa.length && !l.classe) l.baixa = null; }); gravarDados(ST.pf, dd); render(); },
    // ── cartões ──
    cartaoForm(id) {
      const d = dadosAtual(), c = id ? d.cartoes.find(x => x.id === id) : null, todas = BANDEIRAS.concat(lerBandeirasProprias().filter(b => BANDEIRAS.indexOf(b) < 0)), atualB = c ? c.bandeira : 'Mastercard';
      const m = modal(c ? 'Editar cartão' : 'Novo cartão de crédito', campo('Administrador do cartão (banco ou loja)', sel('kpfEmis', [['', '— escolha —']].concat(EMISSORES.map(x => [x[0], x[1]])), emissorDe(c)), 'O logo dele aparece no cartão.') + '<div id="kpfEmLogo" style="margin:-4px 0 8px"></div>' + campo('Nome do cartão', inp('kpfNomeC', c ? c.nome : '', 'text', 'maxlength="60" placeholder="Ex.: Nubank, Itaú Platinum"')) + campo('Imagem do cartão (opcional)', '<input type="hidden" id="kpfImg" value="' + E(c && c.imagem || '') + '"><div id="kpfImgPrev" style="margin-bottom:6px"></div><input type="file" id="kpfImgArq" accept="image/*" style="font-size:12px"> <button type="button" id="kpfImgTira" class="btn bo bsm">Remover</button>', 'Foto ou arte do cartão. Fica reduzida e guardada junto com o cartão.') + campo('Bandeira', sel('kpfBand', [['', 'Sem bandeira (cartão de loja)']].concat(todas.map(b => [b, b])).concat([['__outra', '➕ Outra bandeira (criar)…']]), (c && !c.bandeira) ? '' : (todas.indexOf(atualB) >= 0 ? atualB : 'Mastercard'))) + '<div id="kpfBandBox" style="display:none">' + campo('Nome da nova bandeira', inp('kpfBandN', '', 'text', 'maxlength="40"'), 'Fica salva na lista e aparece nos próximos cartões.') + '</div>' + campo('Cor do cartão', '<input type="hidden" id="kpfCor" value="' + E(c && c.cor || '') + '"><div id="kpfCores" style="display:grid;grid-template-columns:repeat(10,1fr);gap:6px">' + '<button type="button" data-cor="" title="Sem cor (branco)" style="height:26px;border-radius:6px;border:2px solid var(--border);background:var(--white);cursor:pointer;font-size:10px;color:var(--slate)">sem</button>' + CORES_CARTAO.map(x => '<button type="button" data-cor="' + x[1] + '" title="' + x[0] + '" style="height:26px;border-radius:6px;border:2px solid transparent;background:' + x[1] + ';cursor:pointer;color:' + (temaCartao(x[1]).fg) + ';font-size:13px;font-weight:700"></button>').join('') + '</div><div id="kpfCorNome" style="font-size:11px;color:var(--slate);margin-top:4px"></div>', 'Escolha uma das 30 cores. Em cores escuras a letra do cartão fica branca sozinha.') + campo('Limite (R$)', inp('kpfLim', c ? String(c.limite).replace('.', ',') : '', 'text', 'inputmode="decimal"')) + campo('Limite unificado com', sel('kpfLimCom', [['', 'Não — limite só deste cartão']].concat(d.cartoes.filter(x => (!c || x.id !== c.id) && !x.limiteCom).map(x => [x.id, x.nome])), c && c.limiteCom || ''), 'Se este cartão divide o limite com outro, escolha o cartão. O limite passa a valer uma vez só (o valor digitado acima é ignorado). Os vencimentos podem ser diferentes.') + campo('Taxa de uso (só quando usa)', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfTUso"' + (c && c.taxaUso ? ' checked' : '') + '> Este cartão cobra uma taxa nos meses em que é usado</label>' + inp('kpfTUsoV', c && c.taxaUsoValor ? String(c.taxaUsoValor).replace('.', ',') : '', 'text', 'inputmode="decimal" placeholder="Valor da taxa (R$)"'), 'Em toda fatura com compras entra, sozinho, o lançamento "Taxa de Utilização de Cartão de Crédito".') + campo('Anuidade / mensalidade (quando NÃO usa)', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfAnu"' + (c && c.anuidade ? ' checked' : '') + '> Este cartão cobra anuidade nos meses sem uso</label>' + inp('kpfAnuV', c && c.anuidadeValor ? String(c.anuidadeValor).replace('.', ',') : '', 'text', 'inputmode="decimal" placeholder="Valor da anuidade (R$)"'), 'Em toda fatura SEM compras entra, sozinho, o lançamento "Anuidade de Cartão de Crédito", para você lembrar que vai cobrar. Pode marcar uma das duas, as duas ou nenhuma.') + campo('Vencimento da fatura', '<label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer"><input type="checkbox" id="kpfMesmo"' + (c && c.mesmoDia ? ' checked' : '') + '> Cartão de loja SEM fechamento: cada compra vence no mesmo dia, no mês seguinte</label>', 'Ex.: compra dia 20/11 em 3x vence 20/12, 20/01 e 20/02. Não tem dia de fechamento nem de vencimento.') + '<div id="kpfFechBox">' + campo('Dia de fechamento da fatura', inp('kpfFech', c ? c.fechamento : '25', 'number', 'min="1" max="31"')) + campo('Dia de vencimento da fatura', inp('kpfVencC', c ? c.vencimento : '5', 'number', 'min="1" max="31"'), 'Compra feita até o dia do fechamento entra na fatura que fecha no mês; depois, na seguinte.') + '</div>',
        m2 => { const nome = (val(m2, 'kpfNomeC') || '').trim(), f = Math.floor(num(val(m2, 'kpfFech'))), v = Math.floor(num(val(m2, 'kpfVencC'))); let band = val(m2, 'kpfBand'); if (band === '__outra') { band = (val(m2, 'kpfBandN') || '').trim(); if (!band) { root.toast('Digite o nome da nova bandeira.', 'err'); return false; } const bp = lerBandeirasProprias(); if (BANDEIRAS.indexOf(band) < 0 && bp.indexOf(band) < 0) gravarChave('kcbm_pf_bandeiras', bp.concat([band])); }
          if (!nome) { root.toast('Informe o nome do cartão.', 'err'); return false; } if ((val(m2, 'kpfFech') && !(f >= 1 && f <= 31)) || (val(m2, 'kpfVencC') && !(v >= 1 && v <= 31))) { root.toast('Fechamento e vencimento são dias de 1 a 31 (ou deixe em branco para preencher depois).', 'err'); return false; } const dd = dadosAtual(); const novo = { id: c ? c.id : uid(), nome, bandeira: band, cor: val(m2, 'kpfCor') || '', limite: num(val(m2, 'kpfLim')), limiteCom: val(m2, 'kpfLimCom') || '', mesmoDia: chk(m2, 'kpfMesmo'), fechamento: (f >= 1 && !chk(m2, 'kpfMesmo')) ? f : 0, vencimento: (v >= 1 && !chk(m2, 'kpfMesmo')) ? v : 0, emissor: val(m2, 'kpfEmis') || '', imagem: val(m2, 'kpfImg') || '', taxaUso: chk(m2, 'kpfTUso') && num(val(m2, 'kpfTUsoV')) > 0, taxaUsoValor: num(val(m2, 'kpfTUsoV')) || 0, anuidade: chk(m2, 'kpfAnu') && num(val(m2, 'kpfAnuV')) > 0, anuidadeValor: num(val(m2, 'kpfAnuV')) || 0, taxaIgnorar: (c && c.taxaIgnorar) || [] }; dd.cartoes = c ? dd.cartoes.map(x => x.id === c.id ? novo : x) : dd.cartoes.concat([novo]); if (!c) ST.cartaoSel = novo.id; gravarDados(ST.pf, dd); render(); });
      const mesmoAt = () => { m.querySelector('#kpfFechBox').style.display = chk(m, 'kpfMesmo') ? 'none' : ''; }; m.querySelector('#kpfMesmo').onchange = mesmoAt; mesmoAt();
      const at = () => { m.querySelector('#kpfBandBox').style.display = val(m, 'kpfBand') === '__outra' ? '' : 'none'; }; m.querySelector('#kpfBand').onchange = at; at();
      const prev = () => { const v = val(m, 'kpfImg') || imagemDe(c); m.querySelector('#kpfImgPrev').innerHTML = v ? '<img src="' + v + '" style="width:150px;border-radius:8px;display:block">' : ''; }; prev();
      m.querySelector('#kpfImgTira').onclick = () => { m.querySelector('#kpfImg').value = ''; m.querySelector('#kpfImgArq').value = ''; prev(); };
      m.querySelector('#kpfImgArq').onchange = ev => { const f = ev.target.files && ev.target.files[0]; if (!f) return; const url = URL.createObjectURL(f), im = new Image(); im.onload = () => { const W = 900, k = Math.min(1, W / im.width), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); let out = cv.toDataURL('image/webp', 0.92); if (out.indexOf('image/webp') < 0) out = cv.toDataURL('image/jpeg', 0.92); URL.revokeObjectURL(url); m.querySelector('#kpfImg').value = out; prev(); }; im.onerror = () => root.toast('Não consegui ler essa imagem.', 'err'); im.src = url; };
      const em = () => { const v = val(m, 'kpfEmis'), x = EMISSORES.find(y => y[0] === v); m.querySelector('#kpfEmLogo').innerHTML = v ? emissorLogo(v, 40) : ''; const nm = m.querySelector('#kpfNomeC'); if (x && v !== 'outro' && (!nm.value.trim() || nm.dataset.auto === '1')) { nm.value = 'Cartão ' + x[1]; nm.dataset.auto = '1'; } };
      m.querySelector('#kpfNomeC').addEventListener('input', e => { e.target.dataset.auto = '0'; }); m.querySelector('#kpfEmis').onchange = em; m.querySelector('#kpfEmLogo').innerHTML = val(m, 'kpfEmis') ? emissorLogo(val(m, 'kpfEmis'), 40) : '';
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
    filtrar(inp) { const t = inp.closest('table'); if (!t) return; const sg = t.getAttribute('data-sig'); (FILTROS[sg] = FILTROS[sg] || {})[inp.getAttribute('data-i')] = inp.value; aplicarFiltroTabela(t); },
    scr(c) { ST.scr[c.id] = c.scrollLeft; },
    faturaAbrir(cid, f) { const k = 'f|' + cid + '|' + f; ST.movAberto[k] = !ST.movAberto[k]; render(); },
    arrastarIni(ev, tipo, id) { ST.drag = { tipo, id }; try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', id); } catch (x) {} const e = ev.currentTarget; setTimeout(() => { if (e) e.style.opacity = '.45'; }, 0); },
    arrastarFim(ev) { ev.currentTarget.style.opacity = ''; document.querySelectorAll('.kpfAlvo').forEach(x => { x.style.outline = ''; x.classList.remove('kpfAlvo'); }); },
    arrastarSobre(ev, tipo) { if (!ST.drag || ST.drag.tipo !== tipo) return; ev.preventDefault(); const e = ev.currentTarget; if (!e.classList.contains('kpfAlvo')) { document.querySelectorAll('.kpfAlvo').forEach(x => { x.style.outline = ''; x.classList.remove('kpfAlvo'); }); e.classList.add('kpfAlvo'); e.style.outline = '3px dashed var(--teal)'; } },
    soltar(ev, tipo, alvoId) {
      ev.preventDefault(); const dr = ST.drag; ST.drag = null; if (!dr || dr.tipo !== tipo || dr.id === alvoId) return;
      const dd = dadosAtual(), arr = tipo === 'cartao' ? dd.cartoes : dd.bancos; if (!arr) return; const i = arr.findIndex(x => x.id === dr.id), j = arr.findIndex(x => x.id === alvoId); if (i < 0 || j < 0) return;
      const [x] = arr.splice(i, 1); arr.splice(j, 0, x); gravarDados(ST.pf, dd); render();
    },
    rolar(id, dir) { const c = document.getElementById(id); if (c) c.scrollBy({ left: dir * 300, behavior: 'smooth' }); },
    dreAbrir(k) { ST.dreAberto[k] = !ST.dreAberto[k]; render(); },
    dreModo(m) { ST.dreModo = m; render(); },
    contratoForm(tipo) {
      if (tipo === 'parcelamento') { K.contratoFormParc(); return; }
      const d = dadosAtual(), cfg = CONTRATO[tipo], emp = tipo === 'emprestimo';
      const bancosOpts = [['', '— não informar —']].concat((d.bancos || []).map(b => [b.id, b.nome]));
      const corpo = campo(emp ? 'De quem peguei emprestado' : (tipo === 'financiamento' ? 'Credor / instituição' : 'Credor / descrição'), inp('kpfCtCred', '', 'text', 'maxlength="100" list="kpfDLC" autocomplete="off"') + (emp ? datalistCred('kpfDLC', d) : datalistTerc('kpfDLC', 'fornecedor')), emp ? 'Escolha um dos seus cartões de crédito ou contas correntes (as parcelas vão para a fatura do cartão), ou digite o nome de quem emprestou.' : 'Comece a digitar para puxar do cadastro; se for novo, ele entra no cadastro sozinho.')
        + (tipo !== 'emprestimo' ? campo('Descrição (opcional)', inp('kpfCtDesc', '', 'text', 'maxlength="100" placeholder="Ex.: Honda Civic, apartamento…"')) : '')
        + (emp ? campo('Valor recebido (R$)', inp('kpfCtPrinc', '', 'text', 'inputmode="decimal"'), 'O dinheiro que entrou na sua conta.') + campo('Dia em que entra na conta corrente', inp('kpfCtEntrada', hoje(), 'date')) + campo('Onde entra (conta corrente)', sel('kpfCtBanco', bancosOpts, '')) + campo('Tipo de receita', selTipo('kpfCtTipoRec', 'receita', ''), 'Como o valor recebido aparece nas suas receitas.') : '')
        + campo(emp ? 'Total a pagar (R$)' : 'Valor total (R$)', inp('kpfCtTotal', '', 'text', 'inputmode="decimal"'), emp ? 'Com juros: é o valor somado de todas as parcelas.' : 'É dividido igualmente nas parcelas.')
        + campo(tipo === 'financiamento' ? 'Tipo do financiamento (tipo de gasto)' : 'Tipo de gasto das parcelas', selTipo('kpfCtTipoGasto', 'gasto', ''), tipo === 'financiamento' ? 'Escolha um tipo de gasto cadastrado, por exemplo "Financiamento de carro".' : 'Se deixar em branco, usa "' + (emp ? 'Empréstimo' : 'Parcelamento') + '".')
        + campo('Quantas parcelas', inp('kpfCtN', '12', 'number', 'min="1" max="480"'))
        + campo('Vencimento da 1ª parcela', inp('kpfCtV1', '', 'date'), 'As demais vencem nos meses seguintes, no mesmo dia.')
        + '<div id="kpfFormaBox">' + campo('Forma de pagamento', sel('kpfCtForma', FORMAS_PAG, 'Boleto')) + '</div>';
      const mo = modal('Adicionar ' + cfg.un, corpo, mm => {
        const credor = (val(mm, 'kpfCtCred') || '').trim(), total = num(val(mm, 'kpfCtTotal')), n = Math.floor(num(val(mm, 'kpfCtN'))), v1 = val(mm, 'kpfCtV1'), principal = emp ? num(val(mm, 'kpfCtPrinc')) : 0, entrada = emp ? val(mm, 'kpfCtEntrada') : '';
        if (!credor || !(total > 0) || !(n >= 1) || !v1) { root.toast('Informe ' + (emp ? 'de quem pegou, o total a pagar, ' : 'o credor, o valor total, ') + 'quantas parcelas e o vencimento da 1ª.', 'err'); return false; }
        if (emp && (!(principal > 0) || !entrada)) { root.toast('Informe o valor recebido e o dia em que ele entra na conta.', 'err'); return false; }
        const tipoRec = emp ? (val(mm, 'kpfCtTipoRec') || '').trim() : '', tipoGasto = (val(mm, 'kpfCtTipoGasto') || '').trim() || (emp ? 'Empréstimo' : 'Parcelamento'), formaTxt = val(mm, 'kpfCtForma') || 'Boleto';
        if (tipo === 'financiamento' && !(val(mm, 'kpfCtTipoGasto') || '').trim()) { root.toast('Escolha o tipo do financiamento (tipo de gasto).', 'err'); return false; }
        const dd = dadosAtual(); dd.contratos = dd.contratos || []; const cid = uid();
        const cartaoCt = emp ? ((dd.cartoes || []).find(c => norm(c.nome) === norm(credor)) || null) : null, base = { parcelado: n > 1, n, cartaoId: cartaoCt ? cartaoCt.id : null, forma: cartaoCt ? 'cartao' : (formaTxt === 'Carnê' ? 'carne' : 'avista'), contratoId: cid, contratoTipo: tipo };
        const pagar = Object.assign({ id: uid(), data: emp ? entrada : v1, fornecedor: credor, tipo: tipoGasto, valor: total, venc1: v1 }, base); if (cartaoCt) pagar.vencFat = v1.slice(0, 7); pagar.parcelas = gerarParcelas(pagar, cartaoCt);
        const c = { id: cid, tipo, credor, desc: (val(mm, 'kpfCtDesc') || '').trim(), total, n, venc1: v1, tipoGasto, formaTxt: cartaoCt ? 'Cartão ' + cartaoCt.nome : formaTxt, cartaoId: cartaoCt ? cartaoCt.id : null, principal, dataEntrada: entrada, bancoId: emp ? (val(mm, 'kpfCtBanco') || '') : '', tipoReceita: tipoRec, pagarId: pagar.id, criado: Date.now() };
        dd.pagar.push(pagar);
        if (emp) { const rec = { id: uid(), data: entrada, cliente: credor, tipo: tipoRec, valor: principal, parcelado: false, n: 1, cartaoId: null, forma: 'avista', venc1: entrada, contratoId: cid, contratoTipo: tipo }; rec.parcelas = gerarParcelas(rec, null); dd.receber.push(rec); c.receberId = rec.id; }
        dd.contratos.push(c); registrarTerceiro(credor, 'ambos'); gravarDados(ST.pf, dd); render(); root.toast(cfg.un.charAt(0).toUpperCase() + cfg.un.slice(1) + ' criado: ' + n + ' parcela(s) em contas a pagar' + (emp ? ' e o valor recebido em contas a receber' : '') + '.', 'ok');
      }, 'Salvar', 620); K.ligaCred(mo, 'kpfCtCred', emp);
    },
    ligaCred(m, id, on) { if (!on || !m) return; const d = dadosAtual(), inp = m.querySelector('#' + id), box = m.querySelector('#kpfFormaBox'); if (!inp || !box) return;
      const fn = () => { const hit = (d.cartoes || []).some(c => norm(c.nome) === norm((inp.value || '').trim())); box.style.display = hit ? 'none' : ''; }; inp.addEventListener('input', fn); inp.addEventListener('change', fn); fn(); },
    // Parcelamento: quita (anula) dívidas já lançadas — faturas de cartão, impostos, contas — e gera as parcelas + juros + IOF como despesas novas.
    contratoFormParc() {
      const d = dadosAtual(), dividas = [];
      (d.cartoes || []).forEach(c => faturasDoCartao(d, c.id).filter(f => f.aberto > 0.004).forEach(f => dividas.push({ k: 'F|' + c.id + '|' + f.fatura, v: f.aberto, t: c.nome + ' — fatura de ' + rotMes(f.fatura) + ' (vence ' + br(f.venc) + ')', o: f.venc })));
      (d.pagar || []).forEach(it => { if (it.forma === 'cartao' || it.contratoTipo === 'parcelamento' && it.quitaDivida === undefined && false) return; (it.parcelas || []).forEach(p => { if (!p.pago) dividas.push({ k: 'P|' + it.id + '|' + p.n, v: p.valor, t: it.fornecedor + ' — ' + (it.tipo || 'conta') + ' (vence ' + br(p.venc) + ')', o: p.venc }); }); });
      dividas.sort((a, b) => a.o.localeCompare(b.o));
      const tipos = tiposDe('gasto'), acha = re => (tipos.find(t => re.test(norm(t.nome))) || {}).nome || '';
      const lista = dividas.length ? '<div style="max-height:230px;overflow:auto;border:1px solid var(--border);border-radius:8px">' + dividas.map(x => '<label style="display:flex;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--border);font-size:12.5px;cursor:pointer"><input type="checkbox" class="kpfPcSel" data-k="' + E(x.k) + '" data-v="' + cents(x.v) + '"> <span style="flex:1">' + E(x.t) + '</span><b>' + R$(x.v) + '</b></label>').join('') + '</div>' : '<div style="padding:10px;color:var(--slate);font-size:12.5px">Nenhuma dívida em aberto para quitar.</div>';
      const corpo = campo('A quem pago (credor do parcelamento)', inp('kpfPcCred', '', 'text', 'maxlength="100" list="kpfDLC" autocomplete="off"') + datalistCred('kpfDLC', d), 'Escolha um dos seus cartões de crédito ou contas correntes (as parcelas vão para a fatura do cartão), ou digite o nome do credor.')
        + campo('Parcelamento do quê?', inp('kpfPcDesc', '', 'text', 'maxlength="100" placeholder="Ex.: faturas do cartão, DARF, IPTU…"'))
        + campo('Dívidas que este parcelamento quita <span id="kpfPcSoma" style="font-weight:400"></span>', lista, 'Marque tudo o que entra no parcelamento. Essas linhas deixam de contar na conta (ficam na Movimentação, marcadas como "quitada por parcelamento").')
        + campo('Valor total do parcelamento (R$)', inp('kpfPcTotal', '', 'text', 'inputmode="decimal"'), 'Soma de todas as parcelas, com juros e IOF.')
        + campo('IOF (R$)', inp('kpfPcIof', '', 'text', 'inputmode="decimal" placeholder="0,00"')) + '<div id="kpfPcJuros" style="font-size:12.5px;margin:-4px 0 10px;color:var(--slate)"></div>'
        + campo('Tipo de gasto das parcelas (a dívida paga)', selTipo('kpfPcTipoP', 'gasto', acha(/^(?!.*(juros|iof)).*parcelamento/)), 'Se deixar em branco, usa "Parcelamento".')
        + campo('Tipo de gasto dos juros', selTipo('kpfPcTipoJ', 'gasto', acha(/juros.*parcel|juros/)), 'Ex.: "Juros sobre parcelamentos". Se deixar em branco, usa "Juros sobre parcelamento".')
        + campo('Tipo de gasto do IOF', selTipo('kpfPcTipoI', 'gasto', acha(/iof/)), 'Se deixar em branco, usa "IOF".')
        + campo('Quantas parcelas', inp('kpfPcN', '12', 'number', 'min="1" max="480"')) + campo('Vencimento da 1ª parcela', inp('kpfPcV1', '', 'date'), 'As demais vencem nos meses seguintes, no mesmo dia.')
        + campo('Data do parcelamento', inp('kpfPcData', hoje(), 'date'), 'As dívidas marcadas ficam quitadas nesta data.') + '<div id="kpfFormaBox">' + campo('Forma de pagamento', sel('kpfPcForma', FORMAS_PAG, 'Boleto')) + '</div>';
      const m = modal('Adicionar parcelamento', corpo, mm => {
        const credor = (val(mm, 'kpfPcCred') || '').trim(), total = num(val(mm, 'kpfPcTotal')), iof = num(val(mm, 'kpfPcIof')) || 0, n = Math.floor(num(val(mm, 'kpfPcN'))), v1 = val(mm, 'kpfPcV1'), dataP = val(mm, 'kpfPcData') || hoje();
        const sel2 = [...mm.querySelectorAll('.kpfPcSel:checked')].map(c => c.dataset.k), divida = [...mm.querySelectorAll('.kpfPcSel:checked')].reduce((a, c) => a + (+c.dataset.v), 0) / 100;
        if (!credor || !(total > 0) || !(n >= 1) || !v1) { root.toast('Informe o credor, o valor total, quantas parcelas e o vencimento da 1ª.', 'err'); return false; }
        if (!sel2.length) { root.toast('Marque pelo menos uma dívida que este parcelamento quita.', 'err'); return false; }
        const juros = Math.round((total - divida - iof) * 100) / 100;
        if (juros < -0.005) { root.toast('O total (' + R$(total) + ') é menor que a dívida quitada (' + R$(divida) + ') mais o IOF.', 'err'); return false; }
        const tP = (val(mm, 'kpfPcTipoP') || '').trim() || 'Parcelamento', tJ = (val(mm, 'kpfPcTipoJ') || '').trim() || 'Juros sobre parcelamento', tI = (val(mm, 'kpfPcTipoI') || '').trim() || 'IOF', formaTxt = val(mm, 'kpfPcForma') || 'Boleto';
        const dd = dadosAtual(); dd.contratos = dd.contratos || []; const cid = uid(), cartaoPc = (dd.cartoes || []).find(c => norm(c.nome) === norm(credor)) || null, forma = cartaoPc ? 'cartao' : (formaTxt === 'Carnê' ? 'carne' : 'avista');
        // 1) quita (anula) as dívidas marcadas
        sel2.forEach(k => { const [t, a, b] = k.split('|'); const marca = p => { if (p.pago) return; p.pago = true; p.dataPago = dataP; p.via = 'parcelamento'; p.parcelamentoId = cid; };
          if (t === 'F') { const f = faturasDoCartao(dd, a).find(x => x.fatura === b); if (f) f.linhas.forEach(x => marca(x.p)); } else { const it = dd.pagar.find(x => x.id === a), p = it && (it.parcelas || []).find(q => q.n === +b); if (p) marca(p); } });
        // 2) as parcelas novas: a parte da dívida (não conta como despesa nova), os juros e o IOF (despesas novas)
        const mk = (valor, tipo, parte, quita) => { const it = { id: uid(), data: dataP, fornecedor: credor, tipo, valor, parcelado: n > 1, n, cartaoId: cartaoPc ? cartaoPc.id : null, forma, venc1: v1, contratoId: cid, contratoTipo: 'parcelamento', parte }; if (cartaoPc) it.vencFat = v1.slice(0, 7); if (quita) it.quitaDivida = true; it.parcelas = gerarParcelas(it, cartaoPc); dd.pagar.push(it); return it.id; };
        const pagarId = mk(divida, tP, 'principal', true), jurosId = juros > 0.004 ? mk(juros, tJ, 'juros', false) : '', iofId = iof > 0.004 ? mk(iof, tI, 'iof', false) : '';
        dd.contratos.push({ id: cid, tipo: 'parcelamento', credor, desc: (val(mm, 'kpfPcDesc') || '').trim(), total, n, venc1: v1, divida, iof, juros: Math.max(0, juros), tipoGasto: tP, tipoJuros: tJ, tipoIof: tI, formaTxt: cartaoPc ? 'Cartão ' + cartaoPc.nome : formaTxt, cartaoId: cartaoPc ? cartaoPc.id : null, dataParc: dataP, pagarId, jurosId, iofId, criado: Date.now() });
        registrarTerceiro(credor, 'fornecedor'); gravarDados(ST.pf, dd); render(); root.toast('Parcelamento criado: ' + sel2.length + ' dívida(s) quitada(s), ' + n + ' parcela(s)' + (juros > 0.004 ? ' + juros de ' + R$(juros) : '') + (iof > 0.004 ? ' + IOF de ' + R$(iof) : '') + '.', 'ok');
      }, 'Salvar', 660); K.ligaCred(m, 'kpfPcCred', true);
      const atual = () => { const divida = [...m.querySelectorAll('.kpfPcSel:checked')].reduce((a, c) => a + (+c.dataset.v), 0) / 100, total = num(val(m, 'kpfPcTotal')) || 0, iof = num(val(m, 'kpfPcIof')) || 0, juros = total - divida - iof;
        m.querySelector('#kpfPcSoma').textContent = divida ? '— marcado ' + R$(divida) : '';
        m.querySelector('#kpfPcJuros').innerHTML = total > 0 ? 'Dívida quitada <b>' + R$(divida) + '</b> + IOF <b>' + R$(iof) + '</b> + juros <b style="color:' + (juros < -0.005 ? '#dc2626' : 'var(--ink)') + '">' + R$(Math.max(juros, 0)) + '</b> = total <b>' + R$(total) + '</b>' + (juros < -0.005 ? ' <span style="color:#dc2626">(o total está menor que a dívida + IOF)</span>' : '') : ''; };
      m.querySelectorAll('.kpfPcSel').forEach(c => c.onchange = atual); ['kpfPcTotal', 'kpfPcIof'].forEach(i => { m.querySelector('#' + i).oninput = atual; });
    },
    contratoExcluir(id) {
      const dd = dadosAtual(), c = (dd.contratos || []).find(x => x.id === id); if (!c) return;
      const ids = [c.pagarId, c.jurosId, c.iofId].filter(Boolean), itens = dd.pagar.filter(x => ids.indexOf(x.id) >= 0).concat((dd.receber || []).filter(x => x.id === c.receberId));
      if (itens.some(it => (it.parcelas || []).some(p => p.pago))) { root.toast('Já tem parcela paga/recebida. O site não exclui o que já foi pago ou recebido. Desfaça a baixa primeiro.', 'err'); return; }
      if (!confirm('Excluir este ' + CONTRATO[c.tipo].un + ' (' + c.credor + ') e todas as parcelas?' + (c.tipo === 'parcelamento' ? ' As dívidas que ele quitou voltam a ficar em aberto.' : '') + ' Isso não pode ser desfeito.')) return;
      dd.pagar.forEach(x => (x.parcelas || []).forEach(p => { if (p.parcelamentoId === id) { p.pago = false; p.dataPago = null; delete p.via; delete p.parcelamentoId; } }));
      dd.pagar = dd.pagar.filter(x => ids.indexOf(x.id) < 0); dd.receber = (dd.receber || []).filter(x => x.id !== c.receberId); dd.contratos = dd.contratos.filter(x => x.id !== id);
      gravarDados(ST.pf, dd); render(); root.toast('Excluído.', 'ok');
    },
    acumAbrir(k) { ST.acumAberto[k] = !ST.acumAberto[k]; render(); },
    movAbrir(key) { ST.movAberto[key] = !ST.movAberto[key]; render(); },
    notaAbrir(id) { ST.notaAberta = ST.notaAberta || {}; ST.notaAberta[id] = !ST.notaAberta[id]; render(); },
    notaItemExcluir(id, ix) { const d = dadosAtual(), n = (d.notas || []).find(x => x.id === id), it = n && n.itens[ix]; if (!it) return; if (!confirm('Excluir só o produto "' + it.desc + '" (' + R$(it.vt) + ') desta nota? O total da nota (' + R$(n.total) + ') e o pagamento não mudam.')) return; n.itens.splice(ix, 1); gravarDados(ST.pf, d); render(); },
    listaAbrir(id) { ST.listaAberta = id; const d = dadosAtual(), P = pqBase(d), L = (P.listas || []).find(x => x.id === id); if (L) { let mu = false; (L.itens || []).forEach(it => { if (it.ref === undefined) { const pr = it.prodId && P.produtos.find(x => x.id === it.prodId); it.ref = pr ? pqRef(P, pr) : null; mu = true; } }); if (mu) gravarDados(ST.pf, d); } render(); setTimeout(() => K.listaCalc(), 30); },
    listaFechar() { ST.listaAberta = null; render(); },
    listaNova() { const d = dadosAtual(), P = pqBase(d); P.listas = P.listas || []; const mes = ST.pesqMes || fechMes();
      modal('Nova lista de mercado — ' + rotMes(mes), campo('Nome da lista', inp('kpfLNome', 'Compra de ' + rotMes(mes).split(' de ')[0].toLowerCase() + ' — ' + pqAgora(), 'text', 'maxlength="80"')) + campo('Mercado', sel('kpfLMerc', [['', '— escolha depois —']].concat(P.mercados.map(m => [m.id, m.nome])), '')), mm => { const L = { id: uid(), mes, nome: (val(mm, 'kpfLNome') || '').trim() || 'Lista — ' + pqAgora(), mercadoId: val(mm, 'kpfLMerc') || '', itens: [], criado: Date.now() }; P.listas.push(L); gravarDados(ST.pf, d); ST.listaAberta = L.id; render(); }, 'Criar', 440); },
    listaExcluir(id) { const d = dadosAtual(), P = pqBase(d), L = (P.listas || []).find(x => x.id === id); if (!L || !confirm('Excluir a lista "' + L.nome + '" (' + (L.itens || []).length + ' itens)?' + (L.notaId ? ' A nota já enviada para a aba Notas NÃO é apagada.' : ''))) return; P.listas = P.listas.filter(x => x.id !== id); gravarDados(ST.pf, d); render(); },
    listaRenomear(id, v) { const d = dadosAtual(), L = (pqBase(d).listas || []).find(x => x.id === id); if (!L) return; L.nome = (v || '').trim() || L.nome; gravarDados(ST.pf, d); },
    listaMercado(id, v) { const d = dadosAtual(), L = (pqBase(d).listas || []).find(x => x.id === id); if (!L) return; L.mercadoId = v; gravarDados(ST.pf, d); render(); },
    listaAdd(id) { const d = dadosAtual(), P = pqBase(d), L = (P.listas || []).find(x => x.id === id); if (!L) return; const ja = new Set((L.itens || []).map(i => i.prodId));
      let gA = ''; const corpo = '<input id="kpfLBusca" placeholder="Buscar produto…" style="' + IN + ';margin-bottom:8px"><div id="kpfLLista" style="max-height:52vh;overflow:auto;border:1px solid var(--border);border-radius:8px">' + pqOrd(P).map(p => { const g = pqGr(p); let h = ''; if (g !== gA) { gA = g; h = '<div class="pqGH" style="padding:5px 8px;font-weight:800;background:' + pqGBg(P, g) + '">' + E(g) + '</div>'; } return h + '<label class="pqLI" data-t="' + E(normP(pqNomeP(p))) + '" style="display:flex;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer"><input type="checkbox" class="pqCk" data-p="' + p.id + '"' + (ja.has(p.id) ? ' disabled checked' : '') + '> <span style="flex:1">' + E(pqNomeP(p)) + ' <span style="color:var(--slate);font-size:11.5px">' + E((p.qtd || '') + ' ' + (p.un || '')) + '</span></span></label>'; }).join('') + '</div>';
      const m = modal('Adicionar produtos à lista', corpo, mm => { const novos = [...mm.querySelectorAll('.pqCk:checked:not(:disabled)')].map(c => c.dataset.p); const d2 = dadosAtual(), L2 = (pqBase(d2).listas || []).find(x => x.id === id); novos.forEach(pid => { const p = pqBase(d2).produtos.find(x => x.id === pid); if (p) L2.itens.push({ id: uid(), prodId: pid, nome: pqNomeP(p), qtd: 1, pu: 0, ref: pqRef(pqBase(d2), p) }); }); gravarDados(ST.pf, d2); render(); }, 'Adicionar', 560);
      m.querySelector('#kpfLBusca').oninput = ev => { const q = normP(ev.target.value); m.querySelectorAll('.pqLI').forEach(l => { l.style.display = !q || l.dataset.t.indexOf(q) >= 0 ? '' : 'none'; }); }; },
    listaAvulso(id) { modal('Item avulso', campo('Produto', inp('kpfLAv', '', 'text', 'maxlength="80" placeholder="Ex.: Pilha AA"')), mm => { const nm = (val(mm, 'kpfLAv') || '').trim(); if (!nm) return false; const d = dadosAtual(), P = pqBase(d), L = (P.listas || []).find(x => x.id === id); let pr = P.produtos.find(x => norm(x.produto) === norm(nm) && !x.marca); if (!pr) { pr = { id: uid(), produto: nm, grupo: '', marca: '', qtd: 0, un: 'un', precos: {}, compra: {} }; P.produtos.push(pr); } L.itens.push({ id: uid(), prodId: pr.id, nome: pqNomeP(pr), qtd: 1, pu: 0, ref: pqRef(P, pr) }); gravarDados(ST.pf, d); render(); root.toast('"' + nm + '" entrou na lista e também na lista padrão (grupo automático; mude no ✏️ de lá).', 'ok'); }, 'Adicionar', 400); },
    listaItemDel(lid, iid) { const d = dadosAtual(), L = (pqBase(d).listas || []).find(x => x.id === lid); if (!L) return; L.itens = L.itens.filter(i => i.id !== iid); if (L.vinc) delete L.vinc[iid]; gravarDados(ST.pf, d); render(); },
    listaCalc() { let t = 0, n = 0, rt = 0, df = 0, tem = 0; document.querySelectorAll('.pqIt').forEach(r => { const q = num(r.querySelector('.pqQ').value) || 0, p = num(r.querySelector('.pqP').value) || 0; r.querySelector('.pqT').textContent = R$(q * p); t += q * p; n++; const cm = r.querySelector('.pqCmp'); if (cm) { const rf = +cm.dataset.ref; rt += q * rf; if (p) { df += q * (p - rf); tem++; } if (!p) cm.innerHTML = ''; else if (p > rf * 1.005) cm.innerHTML = '<span style="color:#dc2626">⚠ ' + Math.round((p / rf - 1) * 100) + '% acima do menor preço (' + R$(p - rf) + ' a mais por unidade)</span>'; else cm.innerHTML = '<span style="color:var(--teal)">✓ no menor preço pesquisado ou abaixo</span>'; } }); const e = document.getElementById('pqTotal'); if (e) e.textContent = R$(t); const er = document.getElementById('pqRefTot'); if (er) er.textContent = R$(rt); const ed = document.getElementById('pqDif'); if (ed) ed.innerHTML = !tem ? '—' : Math.abs(df) < 0.005 ? '<span style="color:var(--teal)">R$ 0,00 — igual ao menor preço</span>' : df > 0 ? '<span style="color:#dc2626">+' + R$(df) + ' · você pagou a mais</span>' : '<span style="color:var(--teal)">−' + R$(-df) + ' · você pagou a menos</span>'; const e2 = document.getElementById('pqNIt'); if (e2) e2.textContent = n; },
    listaSalvaItem(lid, iid) { const d = dadosAtual(), L = (pqBase(d).listas || []).find(x => x.id === lid), it = L && L.itens.find(i => i.id === iid), r = document.querySelector('.pqIt[data-iid="' + iid + '"]'); if (!it || !r) return; it.qtd = num(r.querySelector('.pqQ').value) || 0; it.pu = num(r.querySelector('.pqP').value) || 0; gravarDados(ST.pf, d); },
    listaNota(id) {
      const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.xml,.pdf,image/*'; fi.onchange = async () => { const f = fi.files && fi.files[0]; if (!f) return; let n = null;
        try { if (/\.xml$/i.test(f.name)) n = nfLerXml(await f.text()); else if (/\.pdf$/i.test(f.name)) n = await nfLerPdf(await f.arrayBuffer()); else { root.toast('Lendo a imagem (OCR)…', 'ok'); n = await nfLerImg(f); } } catch (e) { console.warn('nota', e); }
        if (!n || !(n.itens || []).length) { root.toast('Não consegui ler os produtos dessa nota. Anexe o XML ou o PDF (ou me mande o modelo).', 'err'); return; }
        const d = dadosAtual(), P = pqBase(d), L = (P.listas || []).find(x => x.id === id); if (!L) return; L.nota = n; L.vinc = {}; const usados = new Set();
        (L.itens || []).forEach(it => { let best = -1, bs = 0.5; n.itens.forEach((x, i) => { if (usados.has(i)) return; const sc = Math.max(pqSim(it.nome, x.desc), pqSim(it.nome, prodDe(d, x.desc) || '')); if (sc > bs) { bs = sc; best = i; } }); if (best >= 0) { usados.add(best); L.vinc[it.id] = best; } });
        gravarDados(ST.pf, d); render(); root.toast('Nota lida: ' + n.itens.length + ' itens. Confira a comparação abaixo da lista.', 'ok'); }; fi.click();
    },
    listaVincula(lid, iid, v) { const d = dadosAtual(), L = (pqBase(d).listas || []).find(x => x.id === lid); if (!L) return; L.vinc = L.vinc || {}; const i = +v; Object.keys(L.vinc).forEach(k => { if (i >= 0 && L.vinc[k] === i && k !== iid) delete L.vinc[k]; }); if (i >= 0) L.vinc[iid] = i; else delete L.vinc[iid]; gravarDados(ST.pf, d); render(); },
    listaNotaTira(id) { const d = dadosAtual(), L = (pqBase(d).listas || []).find(x => x.id === id); if (!L || !confirm('Remover a nota desta lista? (A nota já enviada para a aba Notas não é apagada.)')) return; delete L.nota; delete L.vinc; gravarDados(ST.pf, d); render(); },
    listaEnviar(id) { const d = dadosAtual(), P = pqBase(d), L = (P.listas || []).find(x => x.id === id); if (!L || !L.nota) return; const mc = P.mercados.find(m => m.id === L.mercadoId), N = L.nota;
      if (L.notaId && (d.notas || []).some(x => x.id === L.notaId) && !confirm('Esta lista já enviou a nota para a aba Notas. Enviar outra cópia?')) return;
      ST.listaAberta = null; ST.notasVis = 'notas'; K.aba('notas'); K.notaEditar(null, { data: N.data, fornecedor: N.fornecedor || (mc ? mc.nome : ''), razao: N.razao, cnpj: N.cnpj, chave: '', total: N.total, desconto: N.desconto || 0, itens: N.itens.map(x => Object.assign({}, x)), origem: N.origem, listaId: L.id }); },
    pesqMarcas(id) { const d = dadosAtual(), P = pqBase(d), p = P.produtos.find(x => x.id === id); if (!p) return; const ja = P.produtos.filter(x => norm(x.produto) === norm(p.produto) && x.marca).map(x => x.marca);
      modal('Marcas de preferência — ' + p.produto, '<div style="font-size:12.5px;margin-bottom:8px">Digite até <b>5 marcas</b>, separadas por vírgula. Cada marca vira uma linha na lista (' + E(p.produto) + ' — marca) e a pesquisa de preço passa a ser feita nessas marcas. Sem marca, a pesquisa pega o mais barato de qualquer marca.</div>' + campo('Marcas', inp('kpfPqMarcas', ja.join(', '), 'text', 'placeholder="Ex.: Camil, Tio João, Namorado"')), mm => {
        const ms = [...new Set((val(mm, 'kpfPqMarcas') || '').split(',').map(x => x.trim()).filter(Boolean))].slice(0, 5); if (!ms.length) { root.toast('Digite pelo menos uma marca.', 'err'); return false; }
        let n = 0; ms.forEach(mr => { if (!P.produtos.some(x => norm(x.produto) === norm(p.produto) && norm(x.marca || '') === norm(mr))) { P.produtos.push({ id: uid(), produto: p.produto, grupo: p.grupo || '', marca: mr, qtd: p.qtd, un: p.un, precos: {}, compra: {} }); n++; } });
        if (!p.marca && n && confirm('Remover a linha "' + p.produto + '" sem marca, já que agora há marcas escolhidas? (Os preços dela se perdem.)')) P.produtos = P.produtos.filter(x => x.id !== p.id);
        gravarDados(ST.pf, d); render(); root.toast(n + ' marca(s) adicionada(s). Peça ao Claude para pesquisar os preços delas.', 'ok'); }, 'Salvar', 480); },
    pesqGrupos() { const d = dadosAtual(), P = pqBase(d), gl = pqGrupos(P).map(g => ({ nome: g.nome, cor: g.cor || '' }));
      const lin = g => '<div class="pqGE" data-old="' + E(g.nome) + '" style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input class="pqGN" value="' + E(g.nome) + '" placeholder="Nome do grupo" style="' + IN + ';flex:1"><input type="color" class="pqGC" value="' + (g.cor || '#888888') + '" title="Cor do grupo" style="width:38px;height:34px;padding:0;border:1px solid var(--border);border-radius:6px;background:transparent"><label style="font-size:11px;white-space:nowrap"><input type="checkbox" class="pqGS"' + (g.cor ? '' : ' checked') + '> sem cor</label><button type="button" class="btn bo bsm pqGX" title="Excluir grupo">🗑</button></div>';
      const m = modal('Grupos de produtos', '<div style="font-size:12.5px;margin-bottom:8px">Renomeie, escolha a cor, crie ou exclua grupos. Os produtos de um grupo excluído vão para "Outros".</div><div id="pqGL">' + gl.map(lin).join('') + '</div><button type="button" class="btn bp bsm" id="pqGAdd">+ Novo grupo</button>', mm => {
        const rows = [...mm.querySelectorAll('.pqGE')].map(r => ({ old: r.dataset.old, nome: r.querySelector('.pqGN').value.trim(), cor: r.querySelector('.pqGS').checked ? '' : r.querySelector('.pqGC').value })), nomes = rows.map(r => norm(r.nome));
        if (rows.some(r => !r.nome) || new Set(nomes).size !== nomes.length) { root.toast('Cada grupo precisa de um nome diferente.', 'err'); return false; }
        const d2 = dadosAtual(), P2 = pqBase(d2); P2.produtos.forEach(p => { p.grupo = pqGr(p); });
        const mapa = {}; rows.forEach(r => { if (r.old) mapa[r.old] = r.nome; }); const apagados = gl.filter(g => !(g.nome in mapa));
        const orfaos = P2.produtos.filter(p => apagados.some(g => g.nome === p.grupo)); if (orfaos.length && !confirm(orfaos.length + ' produto(s) dos grupos excluídos vão para "Outros". Continuar?')) return false;
        let lista = rows.map(r => ({ nome: r.nome, cor: r.cor })); if (orfaos.length && !lista.some(g => norm(g.nome) === 'outros')) lista.push({ nome: 'Outros', cor: '' });
        P2.produtos.forEach(p => { if (mapa[p.grupo]) p.grupo = mapa[p.grupo]; else if (apagados.some(g => g.nome === p.grupo)) p.grupo = (lista.find(g => norm(g.nome) === 'outros') || {}).nome; });
        P2.grupos = lista; gravarDados(ST.pf, d2); render(); root.toast('Grupos salvos.', 'ok'); }, 'Salvar', 520);
      const lig = () => { m.querySelectorAll('.pqGX').forEach(b => { b.onclick = () => b.closest('.pqGE').remove(); }); m.querySelectorAll('.pqGC').forEach(c => { c.oninput = () => { c.closest('.pqGE').querySelector('.pqGS').checked = false; }; }); };
      m.querySelector('#pqGAdd').onclick = () => { m.querySelector('#pqGL').insertAdjacentHTML('beforeend', lin({ nome: '', cor: '' })); lig(); const ns = m.querySelectorAll('.pqGN'); ns[ns.length - 1].focus(); }; lig(); },
    pesqVerTodos() { ST.pesqTodosMerc = !ST.pesqTodosMerc; render(); },
    pesqMes(v) { if (v) { ST.pesqMes = v; render(); } },
    pesqEscolha(pid, mid) { const d = dadosAtual(), p = pqBase(d).produtos.find(x => x.id === pid); if (!p) return; const mes = ST.pesqMes || fechMes(); p.compra = p.compra || {}; if (mid) p.compra[mes] = { mercado: mid, qtd: (p.compra[mes] || {}).qtd || 1 }; else delete p.compra[mes]; gravarDados(ST.pf, d); render(); },
    pesqQtd(pid, v) { const d = dadosAtual(), p = pqBase(d).produtos.find(x => x.id === pid), mes = ST.pesqMes || fechMes(); if (!p || !(p.compra || {})[mes]) return; p.compra[mes].qtd = num(v) || 1; gravarDados(ST.pf, d); render(); },
    pesqPreco(pid, mid) { const d = dadosAtual(), P = pqBase(d), p = P.produtos.find(x => x.id === pid), mc = P.mercados.find(x => x.id === mid); if (!p || !mc) return; const x = (p.precos || {})[mid] || {};
      modal('Preço — ' + p.produto + (p.marca ? ' ' + p.marca : '') + ' no ' + mc.nome, campo('Preço da embalagem (R$)', inp('kpfPqPreco', x.preco ? String(x.preco).replace('.', ',') : '', 'text', 'inputmode="decimal"'), 'Deixe vazio para limpar.') + campo('Data da pesquisa', inp('kpfPqData', x.data || hoje(), 'date')), mm => { const v = num(val(mm, 'kpfPqPreco')); p.precos = p.precos || {}; if (v > 0) p.precos[mid] = { preco: v, data: val(mm, 'kpfPqData') || hoje() }; else delete p.precos[mid]; gravarDados(ST.pf, d); render(); }, 'Salvar', 420); },
    pesqProdutoForm(id) { const d = dadosAtual(), P = pqBase(d), p = id ? P.produtos.find(x => x.id === id) : null;
      modal(p ? 'Editar produto' : 'Novo produto / marca', campo('Produto', inp('kpfPqNome', p ? p.produto : '', 'text', 'maxlength="80" placeholder="Ex.: Arroz"')) + campo('Marca (opcional)', inp('kpfPqMarca', p ? p.marca : '', 'text', 'maxlength="60" placeholder="Ex.: Camil"')) + campo('Grupo', sel('kpfPqGr', [['', '(automático)']].concat(pqGrupos(P).map(g => [g.nome, g.nome])), p ? (p.grupo || '') : ''), 'Organiza a lista (carnes, mercearia, limpeza…).') + '<div style="display:flex;gap:10px"><div style="flex:1">' + campo('Quantidade da embalagem', inp('kpfPqQtd', p ? p.qtd : '', 'text', 'inputmode="decimal" placeholder="5"')) + '</div><div style="flex:1">' + campo('Unidade', sel('kpfPqUn', [['kg', 'kg'], ['g', 'g'], ['L', 'L'], ['ml', 'ml'], ['un', 'unidade']], p ? p.un : 'kg')) + '</div></div>', mm => { const nome = (val(mm, 'kpfPqNome') || '').trim(); if (!nome) { root.toast('Informe o produto.', 'err'); return false; } const o = { produto: nome, grupo: val(mm, 'kpfPqGr') || '', marca: (val(mm, 'kpfPqMarca') || '').trim(), qtd: num(val(mm, 'kpfPqQtd')) || 0, un: val(mm, 'kpfPqUn') }; if (p) Object.assign(p, o); else P.produtos.push(Object.assign({ id: uid(), precos: {}, compra: {} }, o)); gravarDados(ST.pf, d); render(); }, 'Salvar', 460); },
    pesqProdutoExcluir(id) { const d = dadosAtual(), P = pqBase(d), p = P.produtos.find(x => x.id === id); if (!p || !confirm('Excluir "' + p.produto + (p.marca ? ' ' + p.marca : '') + '" da lista (com os preços pesquisados)?')) return; P.produtos = P.produtos.filter(x => x.id !== id); gravarDados(ST.pf, d); render(); },
    pesqMercadoForm(id) { const d = dadosAtual(), P = pqBase(d), m0 = id ? P.mercados.find(x => x.id === id) : null;
      modal(m0 ? 'Editar mercado' : 'Novo mercado', campo('Nome do mercado', inp('kpfPqMNome', m0 ? m0.nome : '', 'text', 'maxlength="60"')) + campo('Link do site (para o Claude pesquisar os preços)', inp('kpfPqMUrl', m0 ? m0.url : '', 'text', 'placeholder="https://…"')) + campo('Loja / cidade em que você compra', inp('kpfPqMLoja', m0 ? m0.loja : '', 'text', 'maxlength="80" placeholder="Ex.: Assaí Cidade Tiradentes (São Paulo)"'), 'Alguns sites só mostram o preço depois de escolher a loja. O Claude usa esta informação para escolher a loja certa.'), mm => { const nome = (val(mm, 'kpfPqMNome') || '').trim(); if (!nome) { root.toast('Informe o nome.', 'err'); return false; } const lj = (val(mm, 'kpfPqMLoja') || '').trim(); if (m0) { m0.nome = nome; m0.url = (val(mm, 'kpfPqMUrl') || '').trim(); m0.loja = lj; } else P.mercados.push({ id: uid(), nome, url: (val(mm, 'kpfPqMUrl') || '').trim(), loja: lj }); gravarDados(ST.pf, d); render(); }, 'Salvar', 460); },
    pesqLista() { const d = dadosAtual(), P = pqBase(d); let n = 0; [['Assaí', 'https://www.assai.com.br/ofertas/sao-paulo/assai-cidade-tiradentes', 'Assaí Cidade Tiradentes (São Paulo)'], ['Negreiros', 'https://www.supermercadosnegreiros.com.br/', ''], ['Bem Barato', 'https://grupobembarato.com.br/ofertas/', 'Folheto de ofertas da semana (só itens em promoção)'], ['Carrefour', 'https://mercado.carrefour.com.br/', 'Loja online — busca: /busca/produto (o preço pode variar com o CEP/loja: informe o seu)'], ['Extra Mercado', 'https://www.extramercado.com.br/', 'Loja online — busca: /busca?terms=produto (região São Paulo Capital e Grande SP)']].forEach(([nm, url, lj]) => { if (!P.mercados.some(m => norm(m.nome) === norm(nm))) P.mercados.push({ id: uid(), nome: nm, url, loja: lj }); }); PQ_SEMENTE.forEach(([g, q, u]) => { if (!P.produtos.some(p => norm(p.produto) === norm(g) && !p.marca)) { P.produtos.push({ id: uid(), produto: g, marca: '', qtd: q, un: u, precos: {}, compra: {} }); n++; } }); gravarDados(ST.pf, d); render(); root.toast(n ? n + ' itens da lista inicial adicionados (sem marca). Agora escolha as marcas.' : 'A lista inicial já está montada.', n ? 'ok' : 'err'); },
    pesqTrazer() { const d = dadosAtual(), P = pqBase(d); d.produtos = d.produtos || {}; const nomes = [...new Set(Object.values(d.produtos).filter(Boolean))]; let n = 0; nomes.forEach(nm => { if (!P.produtos.some(p => norm(p.produto) === norm(nm))) { P.produtos.push({ id: uid(), produto: nm, marca: '', qtd: 0, un: 'un', precos: {}, compra: {} }); n++; } }); gravarDados(ST.pf, d); render(); root.toast(n ? n + ' produto(s) trazido(s) das notas. Edite para informar marca e embalagem.' : 'Nenhum produto novo nas notas (dê nome aos produtos na tela da nota: coluna "Produto").', n ? 'ok' : 'err'); },
    pesqPedir() { const d = dadosAtual(), P = pqBase(d), p = (lerLista() || []).find(x => x.id === ST.pf) || {};
      const txt = '[FLUXO PF — app de FLUXO DE CAIXA de pessoa física (pasta C:\\fluxo-pf, site kleydsoncontador-svg.github.io/fluxo-pf). NÃO é o JJR nem o KCBM.]\n'
        + 'Aba: Notas fiscais > Pesquisa de mercado (lista padrão). Pessoa: ' + (p.nome || ST.pf) + ' (id ' + ST.pf + ').\n'
        + 'PEDIDO: pesquise os preços atuais dos produtos abaixo nos sites dos mercados abaixo e preencha a lista padrão direto no site, ao vivo (navegador embutido, já logado), com a data de hoje. Preço = valor da embalagem informada. Produto COM marca: pesquise exatamente aquela marca. Produto SEM marca (marca "qualquer"): use o mais barato do tamanho certo, de qualquer marca. Se um mercado não tiver o produto ou eu não conseguir ler o preço, deixe vazio e me avise. Não altere mais nada.\n'
        + 'MERCADOS (id | nome | link | loja em que compro — o site pode exigir escolher estado/cidade/loja para mostrar preço):\n' + (P.mercados.map(m => '- ' + m.id + ' | ' + m.nome + ' | ' + (m.url || 'sem link') + ' | loja: ' + (m.loja || 'não informada')).join('\n') || '(nenhum cadastrado)')
        + '\nPRODUTOS (id | produto | marca | embalagem):\n' + (P.produtos.map(x => '- ' + x.id + ' | ' + x.produto + ' | ' + (x.marca || 'qualquer') + ' | ' + (x.qtd || '') + ' ' + (x.un || '')).join('\n') || '(nenhum cadastrado)')
        + '\nDADOS: gravar em dados.pesq.produtos[].precos[idDoMercado] = {preco, data} na chave kcbm_pf_' + ST.pf + '.';
      const copiar = () => { try { return navigator.clipboard.writeText(txt); } catch (e) { return Promise.reject(e); } };
      copiar().then(() => root.toast('Pedido copiado! Cole na conversa do Claude (Fluxo PF) e envie.', 'ok'), () => { modal('Copie este pedido e cole no Claude', '<textarea readonly style="width:100%;height:300px;' + IN + '">' + E(txt) + '</textarea>', null, null, 640); });
    },
    mercadoVis(v) { ST.mercadoVis = v; ST.listaAberta = null; render(); },
    notasVis(v) { ST.notasVis = v; render(); },
    notasAno(a) { ST.notasAno = a; render(); },
    notasBusca(v) { ST.notasBusca = v; clearTimeout(ST.ntT); ST.ntT = setTimeout(() => { const el0 = document.getElementById('kpfNtBusca'), pos = el0 ? el0.selectionStart : 0; render(); const e2 = document.getElementById('kpfNtBusca'); if (e2) { e2.focus(); try { e2.setSelectionRange(pos, pos); } catch (e) {} } }, 350); },
    notaAnexar() {
      const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.xml,.pdf,image/*'; fi.onchange = async () => {
        const f = fi.files && fi.files[0]; if (!f) return; let n = null;
        try { if (/\.xml$/i.test(f.name)) n = nfLerXml(await f.text()); else if (/\.pdf$/i.test(f.name)) n = await nfLerPdf(await f.arrayBuffer()); else { root.toast('Lendo a imagem (OCR)… pode levar alguns segundos.', 'ok'); n = await nfLerImg(f); if (!n || !(n.itens || []).length) root.toast('Não consegui ler os produtos da imagem. Confira e complete na tela; me mande esse modelo para eu aprender.', 'err'); } } catch (e) { console.warn('nota', e); }
        if (!n) n = { data: hoje(), fornecedor: '', cnpj: '', chave: '', total: 0, itens: [], origem: 'manual' };
        if (n.chave && (dadosAtual().notas || []).some(x => x.chave === n.chave)) { root.toast('Esta nota já foi anexada.', 'err'); return; }
        K.notaEditar(null, n); }; fi.click();
    },
    notaEditar(id, novaN) {
      const d = dadosAtual(); d.notas = d.notas || []; d.produtos = d.produtos || {}; d.produtosTipo = d.produtosTipo || {};
      const n = novaN || d.notas.find(x => x.id === id); if (!n) return;
      d.fornCnpj = d.fornCnpj || {}; d.fornRegra = d.fornRegra || {}; const cn0 = String(n.cnpj || '').replace(/\D/g, ''), reconhecido = !!(novaN && cn0 && d.fornCnpj[cn0]); if (reconhecido) { n.razao = n.razao || n.fornecedor; n.fornecedor = d.fornCnpj[cn0]; }
      const rg0 = novaN ? d.fornRegra[chaveForn(n)] : null; if (rg0) (n.itens || []).forEach(it => { if (!it.tipo && !d.produtosTipo[normP(it.desc)] && rg0.tipo) it.tipo = rg0.tipo; if (!it.grupo && rg0.produto) it.grupo = rg0.produto; });
      const optsTp = it => '<option value="">(padrão da nota)</option>' + tiposDe('gasto').map(t => '<option value="' + E(t.nome) + '"' + (t.nome === (it.tipo || d.produtosTipo[normP(it.desc)] || '') ? ' selected' : '') + '>' + E(t.nome) + '</option>').join('');
      const linha = it => '<tr class="kpfNfIt"><td><input class="nfD" value="' + E(it.desc || '') + '" style="' + IN + '"></td><td><input class="nfG" list="kpfDLP" value="' + E(it.grupo || prodDe(d, it.desc) || '') + '" placeholder="Ex.: Arroz" style="' + IN + '"></td><td><select class="nfTp" style="' + IN + ';min-width:130px">' + optsTp(it) + '</select></td><td style="text-align:center"><input type="checkbox" class="nfR" title="Marque para lembrar este tipo de gasto para este produto nas próximas notas (sem marcar, vale só para esta nota)"></td><td><input class="nfQ" value="' + E(it.qtd || '') + '" inputmode="decimal" style="' + IN + ';width:62px"></td><td><input class="nfU" value="' + E(it.un || '') + '" style="' + IN + ';width:48px"></td><td><input class="nfV" value="' + E(it.vu ? String(it.vu).replace('.', ',') : '') + '" inputmode="decimal" style="' + IN + ';width:76px"></td><td><input class="nfT" value="' + E(it.vt ? String(it.vt).replace('.', ',') : '') + '" inputmode="decimal" style="' + IN + ';width:80px"></td><td><button type="button" class="btn bo bsm nfX">🗑</button></td></tr>';
      const conhecidos = '<datalist id="kpfDLP">' + [...new Set(Object.values(d.produtos).filter(Boolean))].sort().map(x => '<option value="' + E(x) + '">').join('') + '</datalist>';
      const corpo = campo('Fornecedor (nome na nota)', inp('kpfNfForn', n.fornecedor || '', 'text', 'maxlength="100" list="kpfDLF" autocomplete="off"') + datalistTerc('kpfDLF', 'fornecedor'), 'Se já estiver no cadastro, escolha na lista para amarrar. Se for novo, ele entra no cadastro sozinho.') + '<div id="kpfNfFornInfo" style="font-size:11.5px;margin:-4px 0 8px"></div>'
        + campo('CNPJ do estabelecimento', inp('kpfNfCnpj', fmtCnpjNf(n.cnpj), 'text', 'inputmode="numeric" maxlength="18"')) + '<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:150px">' + campo('Data da emissão (compra)', inp('kpfNfData', n.data || hoje(), 'date')) + '</div><div style="flex:1;min-width:120px">' + campo('Desconto (R$)', inp('kpfNfDesc', n.desconto ? String(n.desconto).replace('.', ',') : '', 'text', 'inputmode="decimal" placeholder="0,00"')) + '</div><div style="flex:1;min-width:150px">' + campo('Total a pagar (R$) — já com desconto', inp('kpfNfTot', n.total ? String(n.total).replace('.', ',') : '', 'text', 'inputmode="decimal"')) + '</div></div><div id="kpfNfConta" style="font-size:11.5px;margin:-4px 0 8px;color:var(--slate)"></div>'
        + '<div style="border:1px dashed var(--border);border-radius:8px;padding:8px 10px;margin:4px 0 8px"><div style="font-size:12px;font-weight:600;margin-bottom:4px">Para TODOS os itens desta nota (e dos próximos deste fornecedor)</div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div style="flex:1;min-width:160px">' + campo('Tipo de gasto', '<select id="kpfNfTodosTp" style="' + IN + '">' + optsTp({ tipo: ((d.fornRegra || {})[chaveForn(n)] || {}).tipo || '' }) + '</select>') + '</div><div style="flex:1;min-width:160px">' + campo('Produto (seu nome)', inp('kpfNfTodosPr', ((d.fornRegra || {})[chaveForn(n)] || {}).produto || '', 'text', 'maxlength="60" placeholder="Ex.: Brinquedos"')) + '</div><label style="font-size:12px;display:flex;gap:6px;align-items:center;margin-bottom:12px"><input type="checkbox" id="kpfNfLembra"' + (((d.fornRegra || {})[chaveForn(n)]) ? ' checked' : '') + '> lembrar para este fornecedor</label></div></div>'
        + '<div style="font-size:12px;font-weight:600;margin:6px 0 4px">Produtos <span style="font-weight:400;color:var(--slate)">— em "Produto" dê o nome que quer ver nos relatórios (ex.: "Arroz"); eu guardo para as próximas notas.</span></div><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th align="left">Descrição na nota</th><th align="left">Produto (seu nome)</th><th align="left">Tipo de gasto</th><th>Regra</th><th>Qtd</th><th>Un.</th><th>Unit.</th><th>Total</th><th></th></tr></thead><tbody id="kpfNfBody">' + (n.itens || []).map(linha).join('') + '</tbody></table></div><div style="margin-top:6px">' + B('+ Produto', '', 'bo') + '</div>' + conhecidos;
      const m = modal(novaN ? 'Nova nota fiscal' : 'Editar nota fiscal', corpo, mm => {
        const forn = (val(mm, 'kpfNfForn') || '').trim(), data = val(mm, 'kpfNfData'), total = num(val(mm, 'kpfNfTot'));
        const itens = [...mm.querySelectorAll('.kpfNfIt')].map(r => ({ desc: r.querySelector('.nfD').value.trim(), grupo: r.querySelector('.nfG').value.trim(), tipo: r.querySelector('.nfTp').value, regra: r.querySelector('.nfR').checked, qtd: num(r.querySelector('.nfQ').value) || 0, un: r.querySelector('.nfU').value.trim(), vu: num(r.querySelector('.nfV').value) || 0, vt: num(r.querySelector('.nfT').value) || 0 })).filter(x => x.desc || x.vt);
        if (!forn || !data || !(total > 0)) { root.toast('Informe o fornecedor, a data e o total da nota.', 'err'); return false; }
        itens.forEach(it => { if (!it.vt && it.qtd && it.vu) it.vt = num2(it.qtd * it.vu); if (!it.vu && it.qtd && it.vt) it.vu = num2(it.vt / it.qtd); if (it.grupo) d.produtos[normP(it.desc)] = it.grupo; if (it.regra && it.tipo) d.produtosTipo[normP(it.desc)] = it.tipo; delete it.regra; });
        const desc = num(val(mm, 'kpfNfDesc')) || 0, todosTp = val(mm, 'kpfNfTodosTp') || '', todosPr = (val(mm, 'kpfNfTodosPr') || '').trim();
        itens.forEach(it => { if (todosTp && !it.tipo) it.tipo = todosTp; if (todosPr && !it.grupo) { it.grupo = todosPr; d.produtos[normP(it.desc)] = todosPr; } });
        const soma = num2(itens.reduce((a, x) => a + x.vt, 0)); if (itens.length && Math.abs(soma - desc - total) > 0.05 && !confirm('Produtos (' + R$(soma) + ') − desconto (' + R$(desc) + ') = ' + R$(soma - desc) + ', diferente do total a pagar (' + R$(total) + '). Salvar mesmo assim?')) return false;
        const nn = Object.assign(n, { fornecedor: forn, cnpj: (val(mm, 'kpfNfCnpj') || '').replace(/\D/g, ''), data, total, desconto: desc, itens }); { const ck = chaveForn(nn); d.fornRegra = d.fornRegra || {}; if (chk(mm, 'kpfNfLembra') && (todosTp || todosPr)) d.fornRegra[ck] = { tipo: todosTp, produto: todosPr }; else if (!chk(mm, 'kpfNfLembra')) delete d.fornRegra[ck]; } if (nn.cnpj.length === 14) { d.fornCnpj = d.fornCnpj || {}; d.fornCnpj[nn.cnpj] = forn; } if (!nn.id) { nn.id = uid(); nn.criado = Date.now(); d.notas.push(nn); } if (nn.listaId) { const Ls = ((d.pesq || {}).listas || []).find(x => x.id === nn.listaId); if (Ls) Ls.notaId = nn.id; }
        registrarTerceiro(forn, 'fornecedor'); gravarDados(ST.pf, d); render(); root.toast('Nota salva. Agora informe como foi paga.', 'ok');
      }, 'Salvar', 1040);
      const bind = () => { m.querySelectorAll('.nfX').forEach(b => b.onclick = () => b.closest('tr').remove()); };
      const bAdd = [...m.querySelectorAll('button')].find(b => b.textContent === '+ Produto'); if (bAdd) bAdd.onclick = () => { m.querySelector('#kpfNfBody').insertAdjacentHTML('beforeend', linha({})); bind(); };
      m.querySelector('#kpfNfBody').addEventListener('change', ev => { const r = ev.target.closest('tr'); if (!r) return; if (ev.target.classList.contains('nfD')) { const g = r.querySelector('.nfG'); if (!g.value) g.value = prodDe(d, ev.target.value); const t = r.querySelector('.nfTp'); if (!t.value) t.value = d.produtosTipo[normP(ev.target.value)] || ''; } });
      const inf = () => { const v = norm(val(m, 'kpfNfForn')); m.querySelector('#kpfNfFornInfo').innerHTML = !v ? '' : reconhecido && norm(n.fornecedor) === v ? '<span style="color:var(--teal)">✓ reconhecido pelo CNPJ (nome que você já tinha dado a esse estabelecimento)</span>' : (lerTerceiros().some(t => norm(t.nome) === v) ? '<span style="color:var(--teal)">✓ já está no cadastro de fornecedores</span>' : '<span style="color:var(--slate)">novo fornecedor — será criado ao salvar</span>'); };
      m.querySelector('#kpfNfForn').oninput = inf; inf(); bind();
      const conta = () => { const soma = [...m.querySelectorAll('.nfT')].reduce((a, i) => a + (num(i.value) || 0), 0), ds = num(val(m, 'kpfNfDesc')) || 0, tt = num(val(m, 'kpfNfTot')) || 0; m.querySelector('#kpfNfConta').innerHTML = 'Produtos ' + R$(soma) + (ds ? ' − desconto ' + R$(ds) : '') + ' = <b>' + R$(soma - ds) + '</b>' + (tt && Math.abs(soma - ds - tt) > 0.05 ? ' <span style="color:#dc2626">(diferente do total a pagar ' + R$(tt) + ')</span>' : ' <span style="color:var(--teal)">✓ confere</span>'); };
      ['kpfNfDesc', 'kpfNfTot'].forEach(i => { m.querySelector('#' + i).oninput = conta; }); m.querySelector('#kpfNfBody').addEventListener('input', conta); conta();
      m.querySelector('#kpfNfTodosTp').onchange = () => { const v = val(m, 'kpfNfTodosTp'); if (v) m.querySelectorAll('.nfTp').forEach(s2 => { s2.value = v; }); };
      m.querySelector('#kpfNfTodosPr').oninput = () => { const v = (val(m, 'kpfNfTodosPr') || '').trim(); if (v) m.querySelectorAll('.nfG').forEach(g => { g.value = v; }); };
    },
    notaExcluir(id) { const d = dadosAtual(), n = (d.notas || []).find(x => x.id === id); if (!n) return;
      // compras que a PRÓPRIA nota criou no cartão (não as que só foram vinculadas a um lançamento que já existia): saem junto com a nota
      const g = n.pg || {}, criadas = (!g.ref && Array.isArray(g.pagarIds)) ? (d.pagar || []).filter(x => g.pagarIds.indexOf(x.id) >= 0 && x.notaId === id) : [];
      if (criadas.some(x => (x.parcelas || []).some(p => p.pago))) { root.toast('A compra lançada no cartão por esta nota já tem parcela paga. O site não exclui o que já foi pago: desfaça a baixa antes de excluir a nota.', 'err'); return; }
      const totC = criadas.reduce((a, x) => a + (x.valor || 0), 0);
      if (!confirm('Excluir esta nota (' + n.fornecedor + ', ' + R$(n.total) + ')?' + (criadas.length ? '\n\nA compra lançada no cartão por ela (' + R$(totC) + (criadas[0].n > 1 ? ' em ' + criadas[0].n + ' parcelas' : '') + ') também será EXCLUÍDA da fatura.' : '\n\nO lançamento no cartão ou no extrato, se existir, NÃO é apagado: só deixa de estar ligado à nota.'))) return;
      const ids = criadas.map(x => x.id); d.pagar = (d.pagar || []).filter(x => ids.indexOf(x.id) < 0);
      (d.pagar || []).forEach(x => { if (x.notaId === id) delete x.notaId; }); (d.extrato || []).forEach(x => { if (x.notaId === id) delete x.notaId; }); d.notas = d.notas.filter(x => x.id !== id); gravarDados(ST.pf, d); render(); root.toast(criadas.length ? 'Nota e compra no cartão excluídas.' : 'Nota excluída.', 'ok'); },
    notaPagar(id) {
      const d = dadosAtual(), n = (d.notas || []).find(x => x.id === id); if (!n) return;
      const cand = []; (d.pagar || []).forEach(it => { if (it.taxaAuto) return; const v = (it.parcelas || []).reduce((a, p) => a + p.valor, 0); if (Math.abs(v - n.total) <= 0.02 || Math.abs(it.valor - n.total) <= 0.02) cand.push({ k: 'P|' + it.id, o: Math.abs(new Date(it.data) - new Date(n.data)), t: br(it.data) + ' — ' + E(it.fornecedor || '') + (it.forma === 'cartao' ? ' (' + E(((d.cartoes || []).find(c => c.id === it.cartaoId) || {}).nome || 'cartão') + ')' : ' (conta a pagar)') + ' — ' + R$(it.valor) + (it.notaId && it.notaId !== id ? ' · já ligada a outra nota' : '') }); });
      (d.extrato || []).forEach(l => { if (Math.abs(Math.abs(l.valor) - n.total) <= 0.02) cand.push({ k: 'E|' + l.id, o: Math.abs(new Date(l.data) - new Date(n.data)), t: br(l.data) + ' — extrato ' + E(l.banco || '') + ': ' + E((l.hist || '').slice(0, 50)) + ' — ' + R$(l.valor) + (l.notaId && l.notaId !== id ? ' · já ligada a outra nota' : '') }); });
      cand.sort((a, b) => a.o - b.o);
      const lista = cand.length ? '<div style="max-height:200px;overflow:auto;border:1px solid var(--border);border-radius:8px">' + cand.map((x, i) => '<label style="display:flex;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12.5px;cursor:pointer"><input type="radio" name="kpfNpV" value="' + E(x.k) + '"' + (i === 0 && n.pg && n.pg.ref === x.k ? ' checked' : '') + '> <span>' + x.t + '</span></label>').join('') + '</div>' : '<div style="padding:8px;color:var(--slate);font-size:12.5px">Nenhum lançamento com o valor ' + R$(n.total) + ' encontrado.</div>';
      const tipoGasto = (tiposDe('gasto').find(t => /aliment|mercado/.test(norm(t.nome))) || {}).nome || '';
      const corpo = '<div style="font-size:13px;margin-bottom:8px"><b>' + E(n.fornecedor) + '</b> · ' + br(n.data) + ' · <b>' + R$(n.total) + '</b></div>'
        + campo('Como foi paga?', sel('kpfNpTipo', [['cartao', '💳 Cartão de crédito — lançar a compra na fatura'], ['vinc', '🔗 Vincular a um lançamento que já existe (cartão, conta ou extrato)'], ['dinheiro', '💵 Dinheiro / outro (só registrar)']], (n.pg && n.pg.tipo === 'cartao') ? 'cartao' : 'cartao'))
        + '<div id="kpfNpCartao">' + campo('Cartão', sel('kpfNpCard', (d.cartoes || []).map(c => [c.id, c.nome]), n.pg && n.pg.cartaoId || '')) + campo('Parcelas', inp('kpfNpN', '1', 'number', 'min="1" max="48"')) + campo('Tipo de gasto padrão (para os produtos sem tipo)', selTipo('kpfNpTipoG', 'gasto', tipoGasto), 'Na tela principal a compra fica nesse tipo (ex.: Alimentação). Produtos com outro tipo (ex.: Confraternização) viram uma despesa separada, na mesma fatura. Os produtos aparecem detalhados só aqui.') + '</div>'
        + '<div id="kpfNpVinc" style="display:none">' + campo('Lançamentos com o mesmo valor', lista, 'Escolha o lançamento que corresponde a esta nota.') + '</div>';
      const m = modal('Pagamento da nota', corpo, mm => {
        const tp = val(mm, 'kpfNpTipo'), dd = dadosAtual(), nn = (dd.notas || []).find(x => x.id === id); if (!nn) return;
        if (tp === 'cartao') { const cart = (dd.cartoes || []).find(c => c.id === val(mm, 'kpfNpCard')); if (!cart) { root.toast('Escolha o cartão.', 'err'); return false; } if (!cart.mesmoDia && !(cart.fechamento >= 1 && cart.vencimento >= 1)) { root.toast('Este cartão não tem fechamento e vencimento. Edite o cartão primeiro.', 'err'); return false; }
          const nP = Math.max(1, Math.floor(num(val(mm, 'kpfNpN'))) || 1), tg = (val(mm, 'kpfNpTipoG') || '').trim();
          const grp = {}; (nn.itens || []).forEach(x => { const t = x.tipo || tg; grp[t] = num2((grp[t] || 0) + x.vt); }); let somaG = num2(Object.keys(grp).reduce((a, k) => a + grp[k], 0)); if (nn.desconto > 0 && somaG > 0) { Object.keys(grp).forEach(k => { grp[k] = num2(grp[k] * (1 - nn.desconto / somaG)); }); somaG = num2(Object.keys(grp).reduce((a, k) => a + grp[k], 0)); }
          if (!Object.keys(grp).length) grp[tg] = nn.total; else { const dif = num2(nn.total - somaG), maior = Object.keys(grp).sort((a, b) => grp[b] - grp[a])[0]; if (Math.abs(dif) > 0.004) grp[maior] = num2(grp[maior] + dif); }
          const ids = []; Object.keys(grp).forEach(t => { const it = { id: uid(), data: nn.data, fornecedor: nn.fornecedor, tipo: t, valor: grp[t], parcelado: nP > 1, n: nP, forma: 'cartao', cartaoId: cart.id, venc1: '', notaId: nn.id }; it.parcelas = gerarParcelas(it, cart); dd.pagar.push(it); ids.push(it.id); });
          nn.pg = { tipo: 'cartao', cartaoId: cart.id, pagarId: ids[0], pagarIds: ids }; }
        else if (tp === 'vinc') { const r = (mm.querySelector('input[name=kpfNpV]:checked') || {}).value; if (!r) { root.toast('Escolha o lançamento.', 'err'); return false; } const [k, rid] = r.split('|');
          if (k === 'P') { const it = dd.pagar.find(x => x.id === rid); if (it) { it.notaId = nn.id; nn.pg = { tipo: it.forma === 'cartao' ? 'cartao' : 'vinculo', cartaoId: it.cartaoId || '', pagarId: rid, ref: r }; } } else { const l = dd.extrato.find(x => x.id === rid); if (l) { l.notaId = nn.id; nn.pg = { tipo: 'extrato', extratoId: rid, ref: r }; } } }
        else nn.pg = { tipo: 'dinheiro' };
        gravarDados(ST.pf, dd); render(); root.toast('Pagamento da nota registrado.', 'ok');
      }, 'Salvar', 620);
      const at = () => { const t = val(m, 'kpfNpTipo'); m.querySelector('#kpfNpCartao').style.display = t === 'cartao' ? '' : 'none'; m.querySelector('#kpfNpVinc').style.display = t === 'vinc' ? '' : 'none'; }; m.querySelector('#kpfNpTipo').onchange = at; at();
    },
    movSelTodos(box) { document.querySelectorAll('.kpfMovChk').forEach(c => { const tr = c.closest('tr'); if (!tr || tr.style.display !== 'none') c.checked = box.checked; }); K.movSelCalc(); },
    movSelCalc() {
      const el0 = document.getElementById('kpfMovTot'); if (!el0) return;
      const todas = [...document.querySelectorAll('.kpfMovChk')].filter(c => { const tr = c.closest('tr'); return !tr || tr.style.display !== 'none'; }), marc = todas.filter(c => c.checked);
      const base = marc.length ? marc : todas.filter(c => c.dataset.ab === '1'), t = base.reduce((a, c) => a + (+c.dataset.v), 0) / 100;
      el0.innerHTML = (marc.length ? '☑ ' + marc.length + ' selecionada(s): ' : 'Em aberto (receber − pagar): ') + '<span style="color:' + (t < 0 ? '#dc2626' : 'var(--teal)') + '">' + R$(t) + '</span>';
    },
    movFiltro(f) { ST.movFiltro = f; render(); },
    movAtras() { ST.movAtras = !ST.movAtras; render(); },
    movMesesAbrir() {
      const mes = fechMes(); let ano = +mes.slice(0, 4); const sel = new Set(ST.movMeses && ST.movMeses.length ? ST.movMeses : [mes]);
      const m = modal('Escolher meses', '<div id="kpfMM"></div>', () => { const v = [...sel].sort(); if (!v.length) { root.toast('Marque pelo menos um mês.', 'err'); return false; } ST.movMeses = v.length === 1 && v[0] === mes ? null : v; ST.movMesesRef = mes; render(); }, 'Aplicar', 420);
      const NM = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const desenha = () => { const cx = m.querySelector('#kpfMM'); const ms = i => ano + '-' + String(i + 1).padStart(2, '0'); const todos = NM.every((_, i) => sel.has(ms(i)));
        cx.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:10px"><button class="btn bo bsm" id="kpfMMa">‹</button><b style="font-size:1.1rem">' + ano + '</b><button class="btn bo bsm" id="kpfMMp">›</button></div>'
          + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' + NM.map((n, i) => '<button class="btn ' + (sel.has(ms(i)) ? 'bp' : 'bo') + '" data-m="' + ms(i) + '">' + n + '</button>').join('') + '</div>'
          + '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn ' + (todos ? 'bp' : 'bo') + ' bsm" id="kpfMMt">' + (todos ? '✓ ' : '') + 'Ano inteiro</button><button class="btn bo bsm" id="kpfMMl">Só o mês do topo</button></div><div style="font-size:11.5px;color:var(--slate);margin-top:8px">Clique nos meses para marcar ou desmarcar. Pode misturar meses de anos diferentes.</div>';
        cx.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { sel.has(b.dataset.m) ? sel.delete(b.dataset.m) : sel.add(b.dataset.m); desenha(); });
        cx.querySelector('#kpfMMa').onclick = () => { ano--; desenha(); }; cx.querySelector('#kpfMMp').onclick = () => { ano++; desenha(); };
        cx.querySelector('#kpfMMt').onclick = () => { NM.forEach((_, i) => todos ? sel.delete(ms(i)) : sel.add(ms(i))); desenha(); };
        cx.querySelector('#kpfMMl').onclick = () => { sel.clear(); sel.add(mes); ano = +mes.slice(0, 4); desenha(); }; };
      desenha();
    },
    parcelaBaixa(tipo, itemId, n) {
      let v = prompt('Data em que foi ' + (tipo === 'pagar' ? 'paga' : 'recebida') + ' (AAAA-MM-DD ou DD/MM/AAAA):', hoje()); if (v == null) return; v = v.trim();
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (m) v = m[3] + '-' + m[2] + '-' + m[1]; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { root.toast('Data inválida.', 'err'); return; }
      const dd = dadosAtual(), it = dd[tipo].find(x => x.id === itemId), p = it && it.parcelas.find(q => q.n === n); if (!p || p.pago) return; p.pago = true; p.dataPago = v; p.baixaManual = true; gravarDados(ST.pf, dd); render();
    },
    parcelaDesfaz(tipo, itemId, n) {
      const dd = dadosAtual(), it = dd[tipo].find(x => x.id === itemId), p = it && it.parcelas.find(q => q.n === n); if (!p || !p.pago || p.extratoId) return; p.pago = false; p.dataPago = null; delete p.baixaManual; gravarDados(ST.pf, dd); render();
    },
    baixaAuto() { const dd = dadosAtual(), n = baixaAutomatica(dd); if (n) { gravarDados(ST.pf, dd); render(); } root.toast(n ? n + ' linha(s) do extrato baixaram contas sozinhas.' : 'Nenhuma linha pendente bate exatamente com um vencimento.', n ? 'ok' : 'info'); },
    bancoSel(id) { ST.bancoSel = id || ''; render(); },
    bancoForm(id) {
      const d = dadosAtual(), b = id ? d.bancos.find(x => x.id === id) : null;
      const m = modal(b ? 'Editar banco' : 'Adicionar banco', campo('Banco', sel('kpfBkTipo', BANCOS_TIPOS, b ? b.tipo : 'caixa')) + '<div id="kpfBkLogo" style="margin:-4px 0 8px"></div>' + campo('Nome (como aparece no cartão)', inp('kpfBkNome', b ? b.nome : 'Caixa Econômica', 'text', 'maxlength="60"')) + campo('Agência (opcional)', inp('kpfBkAg', b ? b.agencia : '', 'text', 'maxlength="20"')) + campo('Conta (opcional)', inp('kpfBkCc', b ? b.conta : '', 'text', 'maxlength="40"')) + campo('Saldo inicial (R$)', inp('kpfBkSi', b ? String(b.saldoIni || 0).replace('.', ',') : '0', 'text', 'inputmode="decimal"'), 'Quanto havia na conta na data abaixo. O saldo do cartão = saldo inicial + os lançamentos do extrato depois dessa data.') + campo('Data do saldo inicial', inp('kpfBkSd', b ? b.saldoIniData : '', 'date'), 'Deixe em branco para somar todos os lançamentos do extrato.')
        + (b ? '<div style="margin-top:10px">' + B('🗑 Excluir este banco', "kcbmPf.bancoExcluir('" + b.id + "')") + '</div>' : ''), mm => {
        const nome = (val(mm, 'kpfBkNome') || '').trim(); if (!nome) { root.toast('Informe o nome do banco.', 'err'); return false; }
        const dd = dadosAtual(), novo = { id: b ? b.id : uid(), tipo: val(mm, 'kpfBkTipo') || 'outro', nome, agencia: (val(mm, 'kpfBkAg') || '').trim(), conta: (val(mm, 'kpfBkCc') || '').trim(), saldoIni: num(val(mm, 'kpfBkSi')) || 0, saldoIniData: val(mm, 'kpfBkSd') || '' };
        dd.bancos = b ? dd.bancos.map(x => x.id === b.id ? novo : x) : dd.bancos.concat([novo]); dd.extrato.forEach(l => { if (b && l.bancoId === b.id) l.banco = nome; }); if (!b) ST.bancoSel = novo.id; gravarDados(ST.pf, dd); render();
      });
      const lg = () => { m.querySelector('#kpfBkLogo').innerHTML = bancoLogo(val(m, 'kpfBkTipo'), 44); }; lg();
      m.querySelector('#kpfBkTipo').onchange = () => { lg(); if (!b) { const t = BANCOS_TIPOS.find(x => x[0] === val(m, 'kpfBkTipo')); if (t && t[0] !== 'outro') m.querySelector('#kpfBkNome').value = t[1]; } };
    },
    bancoExcluir(id) {
      const dd = dadosAtual(), n = dd.extrato.filter(l => l.bancoId === id).length;
      if (n) { root.toast('Este banco tem ' + n + ' lançamento(s) no extrato. Exclua os lançamentos antes (nada é apagado por engano).', 'err'); return; }
      if (!confirm('Excluir este banco?')) return; dd.bancos = dd.bancos.filter(b => b.id !== id); if (ST.bancoSel === id) ST.bancoSel = ''; gravarDados(ST.pf, dd); document.getElementById('kpfX') && document.getElementById('kpfX').click(); render();
    },
    saldoCartaoEditar(itemId) {
      const d0 = dadosAtual(), it = d0.pagar.find(x => x.id === itemId); if (!it || !it.parcelas || !it.parcelas[0]) return; if (it.parcelas.some(q => q.pago)) { root.toast('Essa fatura já foi paga. O site não edita o que já foi pago ou recebido. Desfaça a baixa primeiro.', 'err'); return; } const p0 = it.parcelas[0], c0 = d0.cartoes.find(x => x.id === it.cartaoId); if (!c0) return;
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
  function render() { if (!el()) return; if (ST.pf) telaPessoa(); else if (ST.tela === 'tipos') telaTipos(); else if (ST.tela === 'terceiros') telaTerceiros(); else if (ST.tela === 'porquem') telaPorQuem(); else telaLista(); rotularTabelas(); aplicarFiltros(); restaurarCarrosseis(); }

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
