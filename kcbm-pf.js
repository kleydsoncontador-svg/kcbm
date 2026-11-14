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
  const datalistPorQuem = id => '<datalist id="' + id + '">' + lerPorQuem().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(t => '<option value="' + E(t.nome) + '">').join('') + '</datalist>';
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
    const m = dataCompra.slice(0, 7), dia = +dataCompra.slice(8, 10), fech = +cartao.fechamento || 31, venc = +cartao.vencimento || 10;
    const mesFecha = dia <= fech ? m : somaMes(m, 1);
    const mesVenc = venc > fech ? mesFecha : somaMes(mesFecha, 1);
    return { fatura: mesFecha, venc: diaNoMes(mesVenc, venc) };
  }
  // Opções de vencimento de fatura para o cartão: do mês anterior ao automático até 8 meses depois. Ex.: 10/11/2026 (fatura de novembro).
  function opcoesFatura(cartao, data) {
    if (!cartao || !(cartao.fechamento >= 1 && cartao.vencimento >= 1)) return [['', 'Cartão sem fechamento/vencimento']];
    const f0 = faturaDaCompra(data || hoje(), cartao), m0 = f0.venc.slice(0, 7), out = [['', 'Automático — pela data da compra (vence ' + br(f0.venc) + ')']];
    for (let i = -1; i <= 8; i++) { const mv = somaMes(m0, i), v = diaNoMes(mv, +cartao.vencimento), fm = (+cartao.vencimento > +cartao.fechamento) ? mv : somaMes(mv, -1); out.push([mv, br(v) + ' — fatura de ' + rotMes(fm)]); }
    return out;
  }
  function gerarParcelas(item, cartao) { // compra (única ou parcelada)
    const n = item.parcelado ? Math.max(1, Math.floor(item.n) || 1) : 1, vals = dividir(item.valor, n), out = [];
    if (item.forma === 'cartao' && cartao) {
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
  const ST = { bancoSel: '', pf: null, aba: 'movimentacao', movFiltro: 'todos', movAberto: {}, acumAberto: {}, scr: {}, dreAberto: {}, dreModo: 'ano', mesSaldo: null, mesLista: hoje().slice(0, 7), cartaoSel: null, mesFatura: null, tela: 'lista' };
  const el = () => document.getElementById('page-kcbm-pf');
  const CARTAO = '<svg width="18" height="14" viewBox="0 0 18 14" style="vertical-align:-2px"><defs><linearGradient id="pfPrata" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9ced6"/><stop offset=".55" stop-color="#f4f6f8"/><stop offset=".8" stop-color="#9aa1ab"/><stop offset="1" stop-color="#dfe3e8"/></linearGradient></defs><rect x="0.5" y="0.5" width="17" height="13" rx="2" fill="url(#pfPrata)" stroke="#8b929c"/><rect x="0.5" y="3" width="17" height="2.6" fill="#6b727c"/><rect x="2.5" y="9" width="5" height="1.6" rx=".8" fill="#8b929c"/></svg>';
  const ICO_DOIS = '<svg width="18" height="16" viewBox="0 0 24 20" style="vertical-align:-3px;color:var(--ink);filter:drop-shadow(0 0 2.5px currentColor)"><circle cx="8" cy="6" r="4" fill="currentColor"/><path d="M0 19c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/><circle cx="17" cy="7" r="3.3" fill="currentColor" opacity=".75"/><path d="M13.5 12.4c.9-.3 2-.4 3.5-.4 4 0 7 2.2 7 6.5v.5h-8.6c0-2.6-.8-5-1.9-6.6z" fill="currentColor" opacity=".75"/><ellipse cx="6.7" cy="4.6" rx="1.5" ry="1" fill="#fff" opacity=".45"/></svg>', ICO_UM = '<svg width="16" height="16" viewBox="0 0 20 20" style="vertical-align:-3px;color:var(--ink);filter:drop-shadow(0 0 2.5px currentColor)"><circle cx="10" cy="5.5" r="4.5" fill="currentColor"/><path d="M1 19c0-5 4-8 9-8s9 3 9 8z" fill="currentColor"/><ellipse cx="8.3" cy="3.8" rx="1.7" ry="1.1" fill="#fff" opacity=".45"/></svg>';
  const ICO_MOV = '<svg width="17" height="17" viewBox="0 0 24 24" style="vertical-align:-3px;filter:drop-shadow(0 0 3px #ffc400)" fill="none" stroke="#ffc400" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V9a3 3 0 0 1 3-3h11"/><path d="M15 2.5L18.5 6 15 9.5"/><path d="M20 13v2a3 3 0 0 1-3 3H6"/><path d="M9 21.5L5.5 18 9 14.5"/></svg>';
  const ABAS = [['movimentacao', ICO_MOV, 'Movimentação', 'Movim.'], ['extrato', '🏦', 'Extrato bancário', 'Extrato'], ['cartoes', CARTAO, 'Cartões de crédito', 'Cartões'], ['saldo', '⚖', 'Saldo', 'Saldo'], ['caixa', '💵', 'Saldo por caixa', 'Caixa'], ['acumulado', '📈', 'Acumulado', 'Acumul.'], ['dre', '📑', 'DRE', 'DRE']];
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
    el().innerHTML = '<div style="padding:16px 22px 40px"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + B('← Pessoas físicas', 'kcbmPf.voltar()') + '<div style="font-size:1.25rem;font-weight:700">' + E(p.nome) + '</div><div style="font-size:12px;color:var(--slate)">' + E(fmtCpf(p.cpf)) + '</div></div>'
      + '<div class="kpfTabs" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;border-bottom:1px solid var(--border)">' + abas + '</div><div id="kpfAba">' + telaAba() + '</div></div>';
  }
  function telaAba() {
    const d = dadosAtual();
    return ({ entradas: () => abaMov(d, 'entradas'), gastos: () => abaMov(d, 'gastos'), extrato: () => abaExtrato(d), movimentacao: () => abaMovimentacao(d), pagar: () => abaTitulos(d, 'pagar'), receber: () => abaTitulos(d, 'receber'), saldo: () => abaSaldo(d), cartoes: () => abaCartoes(d), acumulado: () => abaAcumulado(d), caixa: () => abaSaldoCaixa(d), dre: () => abaDRE(d) }[ST.aba] || (() => ''))();
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
      if (!p.venc) return; out.push({ data: p.venc, rec: tipo === 'receber', tipo: String(it.tipo || '').trim() || 'Sem tipo', porQuem: it.porQuem || '', nome: String(it[campo] || '') + (it.parcelado ? ' (' + p.n + '/' + it.n + ')' : '') + (it.forma === 'cartao' ? ' · cartão' : ''), valor: Number(p.valor) || 0, pago: !!p.pago });
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
  function abaMovimentacao(d) {
    const mes = fechMes(), fl = ST.movFiltro || 'todos', rows = [];
    ['pagar', 'receber'].forEach(tipo => (d[tipo] || []).forEach(it => { if (it.forma === 'cartao') return; (it.parcelas || []).forEach(p => { const vm = p.venc.slice(0, 7); if (vm === mes || (!p.pago && vm < mes)) rows.push({ tipo, venc: p.venc, it, p, atras: vm < mes }); }); }));
    (d.cartoes || []).forEach(c => faturasDoCartao(d, c.id).forEach(f => { const vm = f.venc.slice(0, 7); if (vm === mes || (f.aberto > 0.004 && vm < mes)) rows.push({ tipo: 'pagar', venc: f.venc, fat: { c, f }, atras: vm < mes }); }));
    rows.sort((a, b) => a.venc.localeCompare(b.venc));
    let aPagar = 0, aReceber = 0, pagoT = 0, recebT = 0;
    const html = rows.filter(r => fl === 'todos' || r.tipo === fl).map(r => {
      const pag = r.tipo === 'pagar', badge = '<span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px;border:1px solid ' + (pag ? '#dc2626' : 'var(--teal)') + ';color:' + (pag ? '#dc2626' : 'var(--teal)') + '">' + (pag ? 'A pagar' : 'A receber') + '</span>';
      if (r.fat) {
        const { c, f } = r.fat, key = c.id + '|' + f.fatura, aberta = !!ST.movAberto[key], quit = f.aberto <= 0.004;
        if (quit) pagoT += f.total; else aPagar += f.aberto;
        const sit = quit ? '<span style="color:var(--teal)">paga</span>' : (r.atras ? '<span style="color:#dc2626">atrasada</span>' : 'em aberto');
        const acao = quit ? (f.linhas.some(x => x.p.baixaFatura) ? B('↩ Desfazer', "kcbmPf.faturaDesfazBaixa('" + c.id + "','" + f.fatura + "')") : '') : B('✔ Dar baixa', "kcbmPf.faturaBaixa('" + c.id + "','" + f.fatura + "')", 'bp');
        let h = '<tr style="cursor:pointer' + (quit ? ';background:rgba(59,130,246,.16)' : '') + '" onclick="kcbmPf.movAbrir(\'' + key + '\')">' + td(br(f.venc)) + td(badge) + td('<span style="display:inline-flex;align-items:center;gap:6px"><span style="font-size:11px">' + (aberta ? '▼' : '▶') + '</span>' + emissorLogo(emissorDe(c), 20) + '<b>' + E(c.nome) + '</b> <span style="color:var(--slate);font-size:11.5px">fatura de ' + rotMes(f.fatura) + ' · ' + f.linhas.length + ' lançamento(s)</span></span>') + td('Cartão de crédito') + td('<span style="color:#dc2626">' + R$(-f.total) + '</span>', 1) + td(sit) + '<td style="' + TD + ';text-align:right;white-space:nowrap" onclick="event.stopPropagation()">' + acao + '</td></tr>';
        if (aberta) h += '<tr><td colspan="7" style="padding:0;background:rgba(127,127,127,.07)"><div style="padding:6px 12px 10px 38px"><table style="width:100%;border-collapse:collapse">' + f.linhas.map(x => '<tr>' + td(br(x.item.data)) + td(E(x.item.fornecedor) + seloPorQuem(x.item)) + td(x.item.rec ? '↻ ' + recRot(x.item) : (x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista')) + td(E(x.item.tipo || '')) + td(R$(-x.p.valor), 1) + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + B('✏️', "kcbmPf.tituloEditar('pagar','" + x.item.id + "')", 'bo', 'Editar esta compra') + ' ' + B('🗑', "kcbmPf.tituloExcluir('pagar','" + x.item.id + "'" + ',' + x.p.n + ")", 'bo', 'Excluir esta compra') + '</td></tr>').join('') + '</table></div></td></tr>';
        return h;
      }
      const { it, p } = r, v = pag ? -p.valor : p.valor; if (p.pago) { if (pag) pagoT += p.valor; else recebT += p.valor; } else if (pag) aPagar += p.valor; else aReceber += p.valor;
      const sit = p.pago ? '<span style="color:var(--teal)">' + (pag ? 'paga' : 'recebida') + ' em ' + br(p.dataPago) + (p.extratoId ? ' · extrato' : '') + '</span>' : (r.atras ? '<span style="color:#dc2626">atrasada</span>' : 'em aberto');
      const acao = p.pago ? (p.extratoId ? '' : B('↩ Desfazer', "kcbmPf.parcelaDesfaz('" + r.tipo + "','" + it.id + "'," + p.n + ")")) : B(pag ? '✔ Pagar' : '✔ Receber', "kcbmPf.parcelaBaixa('" + r.tipo + "','" + it.id + "'," + p.n + ")", 'bp');
      return '<tr' + (p.pago ? ' style="background:' + (pag ? 'rgba(59,130,246,.16)' : 'rgba(34,197,94,.17)') + '"' : '') + '>' + td(br(r.venc)) + td(badge) + td(E(it[pag ? 'fornecedor' : 'cliente']) + seloPorQuem(it) + (it.rec ? ' ↻' : '') + (it.parcelado ? ' <span style="color:var(--slate);font-size:11.5px">' + p.n + '/' + it.n + '</span>' : '')) + td(E(it.tipo || '')) + td('<span style="color:' + cor(v) + '">' + R$(v) + '</span>', 1) + td(sit) + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + acao + ' ' + B('✏️', "kcbmPf.tituloEditar('" + r.tipo + "','" + it.id + "')", 'bo', 'Editar') + ' ' + B('Parcelas', "kcbmPf.tituloVer('" + r.tipo + "','" + it.id + "')") + (pag ? ' ' + B(ICO_UM, "kcbmPf.porQuemDefinir('" + r.tipo + "','" + it.id + "')") : '') + ' ' + B('🗑', "kcbmPf.tituloExcluir('" + r.tipo + "','" + it.id + "'" + ',' + p.n + ")") + '</td></tr>';
    });
    const chip = (k, t) => '<button class="btn ' + (fl === k ? 'bp' : 'bo') + ' bsm" onclick="kcbmPf.movFiltro(\'' + k + '\')">' + t + '</button>';
    return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes) + chip('todos', 'Tudo') + chip('pagar', 'A pagar') + chip('receber', 'A receber') + '<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">' + B('+ Conta a pagar', "kcbmPf.tituloForm('pagar')", 'bp') + B('+ Conta a receber', "kcbmPf.tituloForm('receber')", 'bp') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:8px">Tudo que vence no mês do topo (e o que ficou atrasado de meses anteriores). Compras no cartão aparecem somadas na fatura: clique na linha do cartão para abrir ou fechar o que compõe o valor. A baixa também é feita sozinha quando o extrato paga exatamente o valor no dia do vencimento.</div>'
      + tabela([{ t: 'Vencimento' }, { t: 'Movimento' }, { t: 'Descrição' }, { t: 'Tipo' }, { t: 'Valor', r: 1 }, { t: 'Situação' }, { t: '' }], html, 'Nada vence neste mês.')
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
        + '<div style="font-size:11px;color:' + tm.mut + ';margin:3px 0">fecha dia ' + (c.fechamento || '—') + ' · vence dia ' + (c.vencimento || '—') + (c.fechamento >= 1 ? ' · melhor dia de compra: ' + (c.fechamento >= 31 ? 1 : +c.fechamento + 1) : '') + '</div><div style="font-size:11px;line-height:1.5">' + (unif ? '<span style="font-size:11px;color:' + tm.mut + '">Limite unificado: ' + gr.membros.map(x => E(x.nome)).join(' + ') + '</span><br>' : '') + 'Limite <b>' + R$(limG) + '</b><br>Em uso' + (unif ? ' (grupo)' : '') + ' em ' + fechMes().slice(5, 7) + '/' + fechMes().slice(0, 4) + ' <b style="color:' + tm.neg + '">' + R$(usado) + '</b><br>Disponível <b style="color:' + (disp < 0 ? tm.neg : tm.pos) + '">' + R$(disp) + '</b></div>' + (c.bandeira && !imagemDe(c) ? '<span title=\"' + E(c.bandeira) + '\" style=\"position:absolute;right:12px;bottom:10px;line-height:0\">' + bandeiraSvg(c.bandeira, 22) + '</span>' : '') + '</div>';
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
    (d.pagar || []).forEach(it => { if (it.forma === 'cartao') return; (it.parcelas || []).forEach(p => { const k = mk(p.venc); pag[k] = (pag[k] || 0) + cents(p.valor); }); });
    (d.cartoes || []).forEach(c => faturasDoCartao(d, c.id).forEach(f => { const k = mk(f.venc); fat[k] = (fat[k] || 0) + cents(f.total); }));
    const bancosIni = (d.bancos || []).reduce((a, b) => a + cents(b.saldoIni || 0), 0); // saldo das contas correntes (inicial): positivo abate o negativo, negativo aumenta
    const ini0 = cents((d.saldoIni || {}).receber || 0) - cents((d.saldoIni || {}).pagar || 0) + bancosIni;
    const linhas = []; let acum = ini0;
    for (let k = mesIni; k <= somaMes(m, 12) && k <= mesMax; k = somaMes(k, 1)) {
      const r = rec[k] || 0, pg = pag[k] || 0, ft = fat[k] || 0, ant = acum; acum = ant + r - pg - ft;
      linhas.push({ k, ant: ant / 100, r: r / 100, pg: pg / 100, ft: ft / 100, fim: acum / 100 });
    }
    const L = linhas.find(x => x.k === m) || { ant: 0, r: 0, pg: 0, ft: 0, fim: 0 };
    const card = (t, v, c, sub, grande) => '<div style="flex:0 1 ' + (grande ? 215 : 160) + 'px;min-width:140px;border:' + (grande ? '2px solid var(--ink)' : '1px solid var(--border)') + ';border-radius:10px;padding:8px 12px"><div style="font-size:11.5px;color:var(--slate)">' + t + '</div><div style="font-size:' + (grande ? '1.3rem' : '1.05rem') + ';font-weight:800;color:' + c + '">' + R$(v) + '</div>' + (sub ? '<div style="font-size:11px;color:var(--slate);margin-top:2px">' + sub + '</div>' : '') + '</div>';
    const cabec = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><b style="font-size:1.1rem" title="O mês vem da data lá em cima, no topo do site">' + rotMes(m) + '</b>' + (fechMes() < mesIni ? '<span style="font-size:11.5px;color:var(--slate)">(o mês do topo é anterior ao mês inicial dos saldos)</span>' : '') + '<div style="margin-left:auto">' + B('⚙ Saldos iniciais', 'kcbmPf.saldoIniForm()') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:12px">Tudo o que já está cadastrado conta no mês em que vence, tenha sido pago ou não. O saldo começa com o saldo das suas contas correntes (se estiverem negativas, o saldo final fica ainda mais negativo; se positivas, abatem o negativo). O saldo do fim de um mês é o saldo com que o mês seguinte começa. Mude o mês pelas setas lá em cima.</div>';
    const cards = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
      + ((d.bancos || []).length ? card('Saldo em conta corrente', bancosIni / 100, bancosIni < 0 ? '#dc2626' : 'var(--teal)', (d.bancos || []).map(b => E(b.nome) + ' ' + R$(b.saldoIni || 0)).join(' · ') + ' — já entra no saldo do primeiro mês') : '')
      + card('Saldo do mês anterior', L.ant, L.ant < 0 ? '#dc2626' : 'var(--ink)', 'com que ' + rotMes(m) + ' começa')
      + card('(+) Contas a receber', L.r, 'var(--teal)', 'receitas que vencem no mês')
      + card('(−) Contas a pagar', L.pg, '#dc2626', 'fora do cartão')
      + card('(−) Faturas de cartão', L.ft, '#dc2626', 'faturas que vencem no mês')
      + card('Saldo no fim do mês', L.fim, L.fim < 0 ? '#dc2626' : '#16a34a', 'passa para o mês seguinte', true) + '</div>';
    const tab = tabela([{ t: 'Mês' }, { t: 'Saldo anterior', r: 1 }, { t: 'A receber', r: 1 }, { t: 'Contas a pagar', r: 1 }, { t: 'Faturas', r: 1 }, { t: 'Saldo no fim do mês', r: 1 }],
      linhas.filter(x => x.k >= m).slice(0, 13).map(x => '<tr' + (x.k === m ? ' style="font-weight:700;background:rgba(127,127,127,.12)"' : '') + '>' + td(rotMes(x.k)) + td(R$(x.ant), 1) + td('<span style="color:var(--teal)">' + R$(x.r) + '</span>', 1) + td(R$(-x.pg), 1) + td(R$(-x.ft), 1) + td('<b style="color:' + (x.fim < 0 ? '#dc2626' : '#16a34a') + '">' + R$(x.fim) + '</b>', 1) + '</tr>'), 'Sem dados.', true);
    return cabec + cards + '<div style="font-weight:700;margin:14px 0 6px">Como fica nos próximos meses</div>' + tab;
  }

  // ── Saldo por caixa: só o que EFETIVAMENTE aconteceu (baixas dadas), mês a mês.
  // Começa com o saldo dos bancos (saldo inicial de cada um); depois soma o recebido e tira o que foi pago em contas e em faturas de cartão.
  function abaSaldoCaixa(d) {
    const bancos = d.bancos || [], ev = { rec: {}, pag: {}, fat: {} }, abre = {};
    const add = (tipo, data, v) => { const k = String(data || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(k)) ev[tipo][k] = (ev[tipo][k] || 0) + cents(v); };
    (d.receber || []).forEach(it => (it.parcelas || []).forEach(p => { if (p.pago && p.dataPago) add('rec', p.dataPago, p.valor); }));
    (d.pagar || []).forEach(it => (it.parcelas || []).forEach(p => { if (p.pago && p.dataPago) add(it.forma === 'cartao' ? 'fat' : 'pag', p.dataPago, p.valor); }));
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
        if (cartao && !(cartao.fechamento >= 1 && cartao.vencimento >= 1)) { root.toast('Este cartão ainda não tem fechamento e vencimento. Clique no lápis do cartão e preencha.', 'err'); return false; }
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
      const m = modal(c ? 'Editar cartão' : 'Novo cartão de crédito', campo('Administrador do cartão (banco ou loja)', sel('kpfEmis', [['', '— escolha —']].concat(EMISSORES.map(x => [x[0], x[1]])), emissorDe(c)), 'O logo dele aparece no cartão.') + '<div id="kpfEmLogo" style="margin:-4px 0 8px"></div>' + campo('Nome do cartão', inp('kpfNomeC', c ? c.nome : '', 'text', 'maxlength="60" placeholder="Ex.: Nubank, Itaú Platinum"')) + campo('Imagem do cartão (opcional)', '<input type="hidden" id="kpfImg" value="' + E(c && c.imagem || '') + '"><div id="kpfImgPrev" style="margin-bottom:6px"></div><input type="file" id="kpfImgArq" accept="image/*" style="font-size:12px"> <button type="button" id="kpfImgTira" class="btn bo bsm">Remover</button>', 'Foto ou arte do cartão. Fica reduzida e guardada junto com o cartão.') + campo('Bandeira', sel('kpfBand', [['', 'Sem bandeira (cartão de loja)']].concat(todas.map(b => [b, b])).concat([['__outra', '➕ Outra bandeira (criar)…']]), (c && !c.bandeira) ? '' : (todas.indexOf(atualB) >= 0 ? atualB : 'Mastercard'))) + '<div id="kpfBandBox" style="display:none">' + campo('Nome da nova bandeira', inp('kpfBandN', '', 'text', 'maxlength="40"'), 'Fica salva na lista e aparece nos próximos cartões.') + '</div>' + campo('Cor do cartão', '<input type="hidden" id="kpfCor" value="' + E(c && c.cor || '') + '"><div id="kpfCores" style="display:grid;grid-template-columns:repeat(10,1fr);gap:6px">' + '<button type="button" data-cor="" title="Sem cor (branco)" style="height:26px;border-radius:6px;border:2px solid var(--border);background:var(--white);cursor:pointer;font-size:10px;color:var(--slate)">sem</button>' + CORES_CARTAO.map(x => '<button type="button" data-cor="' + x[1] + '" title="' + x[0] + '" style="height:26px;border-radius:6px;border:2px solid transparent;background:' + x[1] + ';cursor:pointer;color:' + (temaCartao(x[1]).fg) + ';font-size:13px;font-weight:700"></button>').join('') + '</div><div id="kpfCorNome" style="font-size:11px;color:var(--slate);margin-top:4px"></div>', 'Escolha uma das 30 cores. Em cores escuras a letra do cartão fica branca sozinha.') + campo('Limite (R$)', inp('kpfLim', c ? String(c.limite).replace('.', ',') : '', 'text', 'inputmode="decimal"')) + campo('Limite unificado com', sel('kpfLimCom', [['', 'Não — limite só deste cartão']].concat(d.cartoes.filter(x => (!c || x.id !== c.id) && !x.limiteCom).map(x => [x.id, x.nome])), c && c.limiteCom || ''), 'Se este cartão divide o limite com outro, escolha o cartão. O limite passa a valer uma vez só (o valor digitado acima é ignorado). Os vencimentos podem ser diferentes.') + campo('Taxa de uso (só quando usa)', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfTUso"' + (c && c.taxaUso ? ' checked' : '') + '> Este cartão cobra uma taxa nos meses em que é usado</label>' + inp('kpfTUsoV', c && c.taxaUsoValor ? String(c.taxaUsoValor).replace('.', ',') : '', 'text', 'inputmode="decimal" placeholder="Valor da taxa (R$)"'), 'Em toda fatura com compras entra, sozinho, o lançamento "Taxa de Utilização de Cartão de Crédito".') + campo('Anuidade / mensalidade (quando NÃO usa)', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfAnu"' + (c && c.anuidade ? ' checked' : '') + '> Este cartão cobra anuidade nos meses sem uso</label>' + inp('kpfAnuV', c && c.anuidadeValor ? String(c.anuidadeValor).replace('.', ',') : '', 'text', 'inputmode="decimal" placeholder="Valor da anuidade (R$)"'), 'Em toda fatura SEM compras entra, sozinho, o lançamento "Anuidade de Cartão de Crédito", para você lembrar que vai cobrar. Pode marcar uma das duas, as duas ou nenhuma.') + campo('Dia de fechamento da fatura', inp('kpfFech', c ? c.fechamento : '25', 'number', 'min="1" max="31"')) + campo('Dia de vencimento da fatura', inp('kpfVencC', c ? c.vencimento : '5', 'number', 'min="1" max="31"'), 'Compra feita até o dia do fechamento entra na fatura que fecha no mês; depois, na seguinte.'),
        m2 => { const nome = (val(m2, 'kpfNomeC') || '').trim(), f = Math.floor(num(val(m2, 'kpfFech'))), v = Math.floor(num(val(m2, 'kpfVencC'))); let band = val(m2, 'kpfBand'); if (band === '__outra') { band = (val(m2, 'kpfBandN') || '').trim(); if (!band) { root.toast('Digite o nome da nova bandeira.', 'err'); return false; } const bp = lerBandeirasProprias(); if (BANDEIRAS.indexOf(band) < 0 && bp.indexOf(band) < 0) gravarChave('kcbm_pf_bandeiras', bp.concat([band])); }
          if (!nome) { root.toast('Informe o nome do cartão.', 'err'); return false; } if ((val(m2, 'kpfFech') && !(f >= 1 && f <= 31)) || (val(m2, 'kpfVencC') && !(v >= 1 && v <= 31))) { root.toast('Fechamento e vencimento são dias de 1 a 31 (ou deixe em branco para preencher depois).', 'err'); return false; } const dd = dadosAtual(); const novo = { id: c ? c.id : uid(), nome, bandeira: band, cor: val(m2, 'kpfCor') || '', limite: num(val(m2, 'kpfLim')), limiteCom: val(m2, 'kpfLimCom') || '', fechamento: f >= 1 ? f : 0, vencimento: v >= 1 ? v : 0, emissor: val(m2, 'kpfEmis') || '', imagem: val(m2, 'kpfImg') || '', taxaUso: chk(m2, 'kpfTUso') && num(val(m2, 'kpfTUsoV')) > 0, taxaUsoValor: num(val(m2, 'kpfTUsoV')) || 0, anuidade: chk(m2, 'kpfAnu') && num(val(m2, 'kpfAnuV')) > 0, anuidadeValor: num(val(m2, 'kpfAnuV')) || 0, taxaIgnorar: (c && c.taxaIgnorar) || [] }; dd.cartoes = c ? dd.cartoes.map(x => x.id === c.id ? novo : x) : dd.cartoes.concat([novo]); if (!c) ST.cartaoSel = novo.id; gravarDados(ST.pf, dd); render(); });
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
    acumAbrir(k) { ST.acumAberto[k] = !ST.acumAberto[k]; render(); },
    movAbrir(key) { ST.movAberto[key] = !ST.movAberto[key]; render(); },
    movFiltro(f) { ST.movFiltro = f; render(); },
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
