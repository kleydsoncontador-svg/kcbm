/* KCBM — módulo PESSOA FÍSICA (só existe no KCBM; o JJR Controle não tem nem recebe este arquivo).
   Lista de pessoas físicas; ao abrir uma, as abas: Entradas · Gastos · Extrato Bancário · Contas a Pagar · Contas a Receber · Saldo · Cartões.
   Dados guardados no próprio banco do KCBM (S.g/S.s): kcbm_pf_lista (lista) e kcbm_pf_<id> (dados de cada pessoa). Nada é apagado sem confirmar. */
(function (root) {
  'use strict';
  // ───────────── utilidades ─────────────
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = n => String(n).padStart(2, '0');
  const cents = v => Math.round((Number(v) || 0) * 100);
  const R$ = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = t => { let s = String(t == null ? '' : t).trim(); if (!s) return 0; s = s.replace(/[^\d.,-]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); const x = parseFloat(s); return isNaN(x) ? 0 : x; };
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
  function cpfValido(c) {
    c = dig(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +c[t]) return false; }
    return true;
  }
  const fmtCpf = c => { c = dig(c); return c.length === 11 ? c.slice(0, 3) + '.' + c.slice(3, 6) + '.' + c.slice(6, 9) + '-' + c.slice(9) : c; };
  const S_ = () => root.S;
  const lerLista = () => { try { const v = S_().g('kcbm_pf_lista'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const gravarLista = l => { try { S_().s('kcbm_pf_lista', l); } catch (e) { console.warn('PF: lista não salvou', e); } };
  const novoDados = () => ({ saldoIni: { mes: '2026-11', pagar: 0, receber: 0 }, cartoes: [], pagar: [], receber: [], entradas: [], gastos: [], extrato: [] });
  const lerDados = id => { try { const v = S_().g('kcbm_pf_' + id); return (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) ? Object.assign(novoDados(), v) : novoDados(); } catch (e) { return novoDados(); } };
  const gravarDados = (id, d) => { try { S_().s('kcbm_pf_' + id, d); } catch (e) { console.warn('PF: dados não salvos', e); if (root.toast) root.toast('Não consegui salvar — tente de novo.', 'err'); } };

  // ───────────── regras de negócio (puras, testáveis) ─────────────
  // Divide o valor em n parcelas de centavos exatos (a diferença vai na última).
  function dividir(valor, n) {
    n = Math.max(1, Math.floor(n) || 1); const t = cents(valor), base = Math.floor(t / n), out = [];
    for (let i = 0; i < n; i++) out.push((i === n - 1 ? t - base * (n - 1) : base) / 100);
    return out;
  }
  // Fatura do cartão: compra até o dia de fechamento entra na fatura que fecha no mesmo mês; depois, na do mês seguinte.
  // Vencimento: se o dia de vencimento é maior que o de fechamento, vence no mês do fechamento; senão, no mês seguinte.
  function faturaDaCompra(dataCompra, cartao) {
    const m = dataCompra.slice(0, 7), dia = +dataCompra.slice(8, 10), fech = +cartao.fechamento || 31, venc = +cartao.vencimento || 10;
    const mesFecha = dia <= fech ? m : somaMes(m, 1);
    const mesVenc = venc > fech ? mesFecha : somaMes(mesFecha, 1);
    return { fatura: mesFecha, venc: diaNoMes(mesVenc, venc) };
  }
  // Gera as parcelas de uma compra (cartão: uma por fatura; outras formas: de mês em mês a partir do 1º vencimento).
  function gerarParcelas(item, cartao) {
    const n = item.parcelado ? Math.max(1, Math.floor(item.n) || 1) : 1, vals = dividir(item.valor, n), out = [];
    if (item.forma === 'cartao' && cartao) {
      const f0 = faturaDaCompra(item.data, cartao);
      for (let i = 0; i < n; i++) { const fat = somaMes(f0.fatura, i), mesV = somaMes(f0.venc.slice(0, 7), i); out.push({ n: i + 1, fatura: fat, venc: diaNoMes(mesV, +f0.venc.slice(8, 10)), valor: vals[i], pago: false, dataPago: null }); }
    } else {
      const v0 = item.venc1 || somaDias(item.data, 30);
      for (let i = 0; i < n; i++) out.push({ n: i + 1, venc: diaNoMes(somaMes(v0.slice(0, 7), i), +v0.slice(8, 10)), valor: vals[i], pago: false, dataPago: null });
    }
    return out;
  }
  // Saldo acumulado de contas a pagar / a receber no fim de um mês: saldo inicial + vencimentos até o mês − pagamentos até o mês.
  function saldoMes(dados, tipo, mes) {
    const itens = dados[tipo] || [], fim = fimMes(mes), ini = Number((dados.saldoIni || {})[tipo]) || 0;
    let venceAteAntes = 0, pagoAteAntes = 0, novos = 0, pagos = 0, aVencer = 0; const abertas = [];
    const ant = fimMes(somaMes(mes, -1));
    itens.forEach(it => (it.parcelas || []).forEach(p => {
      const v = cents(p.valor);
      if (p.venc <= ant) venceAteAntes += v; else if (p.venc <= fim) novos += v; else aVencer += v;
      if (p.pago && p.dataPago) { if (p.dataPago <= ant) pagoAteAntes += v; else if (p.dataPago <= fim) pagos += v; }
      const pagaAteFim = p.pago && p.dataPago && p.dataPago <= fim;
      if (p.venc <= fim && !pagaAteFim) abertas.push({ item: it, p });
    }));
    // saldo anterior = saldo inicial informado + o que venceu antes do mês − o que já foi pago antes do mês (vale também para o mês inicial)
    const ant2 = cents(ini) + venceAteAntes - pagoAteAntes;
    return { anterior: ant2 / 100, novos: novos / 100, pagos: pagos / 100, final: (ant2 + novos - pagos) / 100, aVencer: aVencer / 100, abertas, saldoIni: ini };
  }
  // Faturas de um cartão: agrupa as parcelas por fatura.
  function faturasDoCartao(dados, cartaoId) {
    const mapa = {};
    (dados.pagar || []).forEach(it => { if (it.forma !== 'cartao' || it.cartaoId !== cartaoId) return; (it.parcelas || []).forEach(p => { const k = p.fatura; (mapa[k] = mapa[k] || { fatura: k, venc: p.venc, total: 0, pago: 0, linhas: [] }); mapa[k].total += cents(p.valor); if (p.pago) mapa[k].pago += cents(p.valor); mapa[k].linhas.push({ item: it, p }); }); });
    return Object.keys(mapa).sort().map(k => { const f = mapa[k]; return { fatura: f.fatura, venc: f.venc, total: f.total / 100, pago: f.pago / 100, aberto: (f.total - f.pago) / 100, linhas: f.linhas }; });
  }
  const limiteUsado = (dados, cartaoId) => faturasDoCartao(dados, cartaoId).reduce((a, f) => a + f.aberto, 0);
  // Texto do lançamento contábil gerado por uma linha do extrato.
  function lancamentoTexto(l, banco) {
    banco = banco || 'Banco';
    if (l.baixa && l.baixa.length) return l.valor < 0 ? 'D Fornecedores (contas a pagar) · C ' + banco : 'D ' + banco + ' · C Clientes (contas a receber)';
    if (l.classe) return l.valor < 0 ? 'D Despesa — ' + (l.classe.categoria || 'Gastos') + ' · C ' + banco : 'D ' + banco + ' · C Receita — ' + (l.classe.categoria || 'Entradas');
    return '';
  }
  root.__kcbmPfTeste = { dividir, faturaDaCompra, gerarParcelas, saldoMes, faturasDoCartao, limiteUsado, lancamentoTexto, cpfValido, somaMes, num };

  // ───────────── estado e tela ─────────────
  const ST = { pf: null, aba: 'entradas', mesSaldo: null, mesLista: hoje().slice(0, 7), cartaoSel: null, mesFatura: null };
  const el = () => document.getElementById('page-kcbm-pf');
  const ABAS = [['entradas', '⬇ Entradas'], ['gastos', '⬆ Gastos'], ['extrato', '🏦 Extrato bancário'], ['pagar', '🧾 Contas a pagar'], ['receber', '💰 Contas a receber'], ['saldo', '⚖ Saldo a pagar / a receber'], ['cartoes', '💳 Cartões de crédito']];
  const B = (txt, on, cls, ttl) => '<button class="btn ' + (cls || 'bo') + ' bsm" ' + (ttl ? 'title="' + E(ttl) + '" ' : '') + 'onclick="' + on + '">' + txt + '</button>';
  const IN = 'width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--white);color:var(--ink);font:inherit;font-size:13px';
  const TH = 'padding:7px 9px;text-align:left;font-size:11.5px;white-space:nowrap;background:var(--ink2);color:#fff';
  const TD = 'padding:6px 9px;border-bottom:1px solid var(--border);font-size:12.5px;vertical-align:top';
  const dadosAtual = () => lerDados(ST.pf);
  const pfAtual = () => lerLista().find(x => x.id === ST.pf);
  function tabela(cols, linhas, vazio) {
    return '<div style="overflow:auto;border:1px solid var(--border);border-radius:8px"><table style="width:100%;border-collapse:collapse"><thead><tr>' + cols.map(c => '<th style="' + TH + (c.r ? ';text-align:right' : '') + '">' + c.t + '</th>').join('') + '</tr></thead><tbody>'
      + (linhas.length ? linhas.join('') : '<tr><td colspan="' + cols.length + '" style="padding:22px;text-align:center;color:var(--slate)">' + (vazio || 'Nada por aqui ainda.') + '</td></tr>') + '</tbody></table></div>';
  }
  const td = (v, r) => '<td style="' + TD + (r ? ';text-align:right;white-space:nowrap' : '') + '">' + v + '</td>';
  const cor = v => v < 0 ? '#dc2626' : 'var(--teal)';

  // ── janelinha de formulário genérica ──
  function modal(titulo, corpoHtml, aoSalvar, rotSalvar) {
    let m = document.getElementById('kpfModal'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'kpfModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;padding:6vh 12px;overflow:auto';
    m.innerHTML = '<div style="background:var(--white);color:var(--ink);border:1px solid var(--border);border-radius:12px;width:100%;max-width:560px;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.5)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:15px">' + titulo + '</b><button id="kpfX" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--slate)">✕</button></div><div id="kpfCorpo">' + corpoHtml + '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn bo" id="kpfCancel">Cancelar</button>' + (aoSalvar ? '<button class="btn bp" id="kpfOk">' + (rotSalvar || 'Salvar') + '</button>' : '') + '</div></div>';
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

  // ───────────── lista de pessoas ─────────────
  function telaLista() {
    const lista = lerLista();
    const linhas = lista.map(p => {
      const d = lerDados(p.id), m = hoje().slice(0, 7) < (d.saldoIni.mes || '2026-11') ? d.saldoIni.mes : hoje().slice(0, 7);
      const sp = saldoMes(d, 'pagar', m), sr = saldoMes(d, 'receber', m);
      return '<tr style="cursor:pointer" onclick="kcbmPf.abrir(\'' + p.id + '\')"><td style="' + TD + ';font-weight:600">' + E(p.nome) + '</td>' + td(E(fmtCpf(p.cpf)) || '—') + td(R$(sp.final), 1) + td(R$(sr.final), 1)
        + '<td style="' + TD + ';text-align:right;white-space:nowrap" onclick="event.stopPropagation()">' + B('Abrir', "kcbmPf.abrir('" + p.id + "')", 'bp') + ' ' + B('✏️', "kcbmPf.editarPessoa('" + p.id + "')", 'bo', 'Editar nome/CPF') + ' ' + B('🗑', "kcbmPf.excluirPessoa('" + p.id + "')", 'bo', 'Excluir esta pessoa e todos os dados dela (pede confirmação)') + '</td></tr>';
    });
    el().innerHTML = '<div style="padding:18px 22px 40px"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px"><span style="font-size:1.5rem">👤</span><div style="font-size:1.3rem;font-weight:700">Pessoa Física</div><div style="margin-left:auto">' + B('+ Nova pessoa física', 'kcbmPf.novaPessoa()', 'bp') + '</div></div>'
      + '<div style="font-size:12.5px;color:var(--slate);margin-bottom:10px">Cadastre a pessoa e abra para lançar entradas, gastos, extrato, contas a pagar/receber e cartões. Os saldos mostrados são os do mês atual.</div>'
      + tabela([{ t: 'Pessoa' }, { t: 'CPF' }, { t: 'A pagar (saldo)', r: 1 }, { t: 'A receber (saldo)', r: 1 }, { t: '' }], linhas, 'Nenhuma pessoa física cadastrada. Clique em "+ Nova pessoa física".') + '</div>';
  }
  function formPessoa(p) {
    return campo('Nome *', inp('kpfNome', p ? p.nome : '', 'text', 'maxlength="120"')) + campo('CPF', inp('kpfCpf', p ? fmtCpf(p.cpf) : '', 'text', 'inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')) + campo('Observação', inp('kpfObs', p ? p.obs : '', 'text', 'maxlength="200"'));
  }
  function lerFormPessoa(m) {
    const nome = (val(m, 'kpfNome') || '').trim(); if (!nome) { root.toast('Informe o nome.', 'err'); return null; }
    const cpf = dig(val(m, 'kpfCpf'));
    if (cpf && !cpfValido(cpf) && !confirm('Esse CPF não parece válido. Salvar mesmo assim?')) return null;
    return { nome, cpf, obs: (val(m, 'kpfObs') || '').trim() };
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
    switch (ST.aba) {
      case 'entradas': return abaMov(d, 'entradas');
      case 'gastos': return abaMov(d, 'gastos');
      case 'extrato': return abaExtrato(d);
      case 'pagar': return abaTitulos(d, 'pagar');
      case 'receber': return abaTitulos(d, 'receber');
      case 'saldo': return abaSaldo(d);
      case 'cartoes': return abaCartoes(d);
    }
    return '';
  }
  const navMes = (mes, onclickPref, rot) => '<div style="display:flex;align-items:center;gap:6px">' + B('‹', onclickPref + '(-1)') + '<b style="min-width:150px;text-align:center">' + rotMes(mes) + '</b>' + B('›', onclickPref + '(1)') + (rot || '') + '</div>';

  // ── Entradas / Gastos ──
  function abaMov(d, tipo) {
    const ent = tipo === 'entradas', mes = ST.mesLista, itens = (d[tipo] || []).filter(x => x.data.slice(0, 7) === mes).sort((a, b) => a.data.localeCompare(b.data));
    const total = itens.reduce((a, x) => a + cents(x.valor), 0) / 100;
    const linhas = itens.map(x => '<tr>' + td(br(x.data)) + td(E(x.descricao)) + td(E(x.categoria || '')) + td(E(x.banco || '')) + td(R$(x.valor), 1) + td(x.extratoId ? '<span title="Veio do extrato">🏦</span>' : '') + '<td style="' + TD + ';text-align:right">' + B('✏️', "kcbmPf.movForm('" + tipo + "','" + x.id + "')") + ' ' + B('🗑', "kcbmPf.movExcluir('" + tipo + "','" + x.id + "')") + '</td></tr>');
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes, 'kcbmPf.mesLista') + '<div style="margin-left:auto">' + B(ent ? '+ Nova entrada' : '+ Novo gasto', "kcbmPf.movForm('" + tipo + "')", 'bp') + '</div></div>'
      + tabela([{ t: 'Data' }, { t: 'Descrição' }, { t: 'Categoria' }, { t: 'Banco' }, { t: 'Valor', r: 1 }, { t: '' }, { t: '' }], linhas, ent ? 'Nenhuma entrada neste mês.' : 'Nenhum gasto neste mês.')
      + '<div style="text-align:right;font-weight:700;margin-top:8px">Total do mês: <span style="color:' + (ent ? 'var(--teal)' : '#dc2626') + '">' + R$(total) + '</span></div>';
  }

  // ── Extrato bancário ──
  function abaExtrato(d) {
    const mes = ST.mesLista, itens = (d.extrato || []).filter(x => x.data.slice(0, 7) === mes).sort((a, b) => a.data.localeCompare(b.data) || (a.criado || 0) - (b.criado || 0));
    const ent = itens.filter(x => x.valor > 0).reduce((a, x) => a + cents(x.valor), 0) / 100, sai = itens.filter(x => x.valor < 0).reduce((a, x) => a + cents(x.valor), 0) / 100;
    const linhas = itens.map(x => {
      const lanc = lancamentoTexto(x, x.banco), pend = !lanc;
      return '<tr>' + td(br(x.data)) + td(E(x.banco || '')) + td(E(x.hist)) + '<td style="' + TD + ';text-align:right;white-space:nowrap;color:' + cor(x.valor) + '">' + R$(x.valor) + '</td>'
        + td(pend ? '<span style="color:#b45309">— pendente —</span>' : '<span style="font-size:11.5px">' + E(lanc) + '</span>') + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + (pend ? B('Baixar / classificar', "kcbmPf.extratoBaixar('" + x.id + "')", 'bp') : B('↩ Desfazer', "kcbmPf.extratoDesfazer('" + x.id + "')")) + ' ' + B('🗑', "kcbmPf.extratoExcluir('" + x.id + "')") + '</td></tr>';
    });
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + navMes(mes, 'kcbmPf.mesLista') + '<div style="margin-left:auto;display:flex;gap:6px">' + B('+ Lançar no extrato', 'kcbmPf.extratoForm()', 'bp') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:8px">Cada linha do extrato forma um <b>lançamento contábil</b>: dar baixa numa conta a pagar/receber, ou classificar como gasto/entrada. Valor positivo = entrada; negativo = saída.</div>'
      + tabela([{ t: 'Data' }, { t: 'Banco' }, { t: 'Histórico' }, { t: 'Valor', r: 1 }, { t: 'Lançamento contábil' }, { t: '' }], linhas, 'Nenhuma linha de extrato neste mês.')
      + '<div style="text-align:right;margin-top:8px;font-size:13px">Entradas <b style="color:var(--teal)">' + R$(ent) + '</b> · Saídas <b style="color:#dc2626">' + R$(sai) + '</b> · Resultado <b>' + R$(ent + sai) + '</b></div>';
  }

  // ── Contas a pagar / receber ──
  function abaTitulos(d, tipo) {
    const pag = tipo === 'pagar', itens = (d[tipo] || []).slice().sort((a, b) => b.data.localeCompare(a.data));
    const linhas = itens.map(it => {
      const ps = it.parcelas || [], abertas = ps.filter(p => !p.pago).length, forma = it.forma === 'cartao' ? '💳 ' + E((d.cartoes.find(c => c.id === it.cartaoId) || {}).nome || 'cartão') : E({ avista: 'À vista / boleto', carne: 'Carnê', outro: 'Outro' }[it.forma] || '');
      return '<tr>' + td(br(it.data)) + td(E(it[pag ? 'fornecedor' : 'cliente'])) + td(E(it.tipo || '')) + td(R$(it.valor), 1) + td(it.parcelado ? it.n + 'x' : 'à vista') + td(forma) + td((ps.length - abertas) + ' de ' + ps.length + ' ' + (pag ? 'pagas' : 'recebidas'))
        + '<td style="' + TD + ';text-align:right;white-space:nowrap">' + B('Parcelas', "kcbmPf.tituloVer('" + tipo + "','" + it.id + "')") + ' ' + B('🗑', "kcbmPf.tituloExcluir('" + tipo + "','" + it.id + "')") + '</td></tr>';
    });
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><div style="font-weight:700">' + (pag ? 'Compras a prazo e contas a pagar' : 'Receitas a prazo e contas a receber') + '</div><div style="margin-left:auto">' + B(pag ? '+ Registrar compra' : '+ Registrar receita', "kcbmPf.tituloForm('" + tipo + "')", 'bp') + '</div></div>'
      + tabela([{ t: 'Data' }, { t: pag ? 'Fornecedor' : 'Cliente' }, { t: pag ? 'Tipo de gasto' : 'Tipo de receita' }, { t: 'Valor bruto', r: 1 }, { t: 'Parcelas' }, { t: 'Forma' }, { t: 'Situação' }, { t: '' }], linhas, pag ? 'Nenhuma compra registrada.' : 'Nenhuma receita a receber registrada.');
  }

  // ── Saldo a pagar / a receber ──
  function abaSaldo(d) {
    const mesIni = d.saldoIni.mes || '2026-11', mes = ST.mesSaldo && ST.mesSaldo >= mesIni ? ST.mesSaldo : mesIni; ST.mesSaldo = mes;
    const bloco = (tipo, tit) => {
      const s = saldoMes(d, tipo, mes), pag = tipo === 'pagar';
      const abertas = s.abertas.sort((a, b) => a.p.venc.localeCompare(b.p.venc)).map(x => '<tr>' + td(br(x.p.venc)) + td(E(x.item[pag ? 'fornecedor' : 'cliente'])) + td(x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista') + td(x.p.venc < mes + '-01' ? '<span style="color:#dc2626">acumulada de meses anteriores</span>' : 'do mês') + td(R$(x.p.valor), 1) + '</tr>');
      return '<div style="flex:1 1 440px;min-width:300px"><div style="font-weight:700;margin-bottom:6px">' + tit + '</div>'
        + '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:13px;line-height:1.7"><div style="display:flex;justify-content:space-between"><span>Saldo anterior</span><b>' + R$(s.anterior) + '</b></div><div style="display:flex;justify-content:space-between"><span>(+) Vencimentos do mês</span><b>' + R$(s.novos) + '</b></div><div style="display:flex;justify-content:space-between"><span>(−) ' + (pag ? 'Pagos' : 'Recebidos') + ' no mês</span><b>' + R$(s.pagos) + '</b></div><div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);margin-top:4px;padding-top:4px"><span><b>Saldo no fim do mês</b></span><b style="font-size:15px;color:' + (pag ? '#dc2626' : 'var(--teal)') + '">' + R$(s.final) + '</b></div><div style="display:flex;justify-content:space-between;color:var(--slate);font-size:12px"><span>A vencer depois deste mês</span><span>' + R$(s.aVencer) + '</span></div></div>'
        + tabela([{ t: 'Vencimento' }, { t: pag ? 'Fornecedor' : 'Cliente' }, { t: 'Parcela' }, { t: 'Situação' }, { t: 'Valor', r: 1 }], abertas, 'Nada em aberto até o fim deste mês.') + '</div>';
    };
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">' + '<div style="display:flex;align-items:center;gap:6px">' + (mes > mesIni ? B('‹', 'kcbmPf.mesSaldo(-1)') : '<button class="btn bo bsm" disabled style="opacity:.35">‹</button>') + '<b style="min-width:150px;text-align:center">' + rotMes(mes) + '</b>' + B('›', 'kcbmPf.mesSaldo(1)') + '</div>'
      + '<div style="margin-left:auto">' + B('⚙ Saldos iniciais', 'kcbmPf.saldoIniForm()') + '</div></div>'
      + '<div style="font-size:12px;color:var(--slate);margin-bottom:10px">O que não foi baixado no extrato continua acumulando nos meses seguintes. Começa em ' + rotMes(mesIni) + ' (mês dos saldos iniciais).</div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">' + bloco('pagar', '🧾 Contas a pagar') + bloco('receber', '💰 Contas a receber') + '</div>';
  }

  // ── Cartões ──
  function abaCartoes(d) {
    const cards = d.cartoes.map(c => {
      const usado = limiteUsado(d, c.id), disp = (Number(c.limite) || 0) - usado, sel = ST.cartaoSel === c.id;
      return '<div onclick="kcbmPf.cartaoSel(\'' + c.id + '\')" style="cursor:pointer;min-width:230px;flex:0 1 270px;border:2px solid ' + (sel ? 'var(--teal)' : 'var(--border)') + ';border-radius:12px;padding:12px 14px;background:var(--white)"><div style="display:flex;justify-content:space-between;align-items:center"><b>💳 ' + E(c.nome) + '</b><span onclick="event.stopPropagation()">' + B('✏️', "kcbmPf.cartaoForm('" + c.id + "')") + '</span></div>'
        + '<div style="font-size:12px;color:var(--slate);margin:4px 0">Fecha dia ' + c.fechamento + ' · vence dia ' + c.vencimento + '</div><div style="font-size:12.5px;line-height:1.6">Limite <b>' + R$(c.limite) + '</b><br>Em uso <b style="color:#dc2626">' + R$(usado) + '</b><br>Disponível <b style="color:' + (disp < 0 ? '#dc2626' : 'var(--teal)') + '">' + R$(disp) + '</b></div></div>';
    }).join('');
    let det = '';
    const c = d.cartoes.find(x => x.id === ST.cartaoSel);
    if (c) {
      const fats = faturasDoCartao(d, c.id), hojeM = hoje().slice(0, 7);
      const aberta = fats.filter(f => f.aberto > 0.004), prox = aberta[0];
      const linhas = fats.map(f => '<tr style="' + (ST.mesFatura === f.fatura ? 'background:rgba(20,184,166,.12)' : '') + ';cursor:pointer" onclick="kcbmPf.faturaSel(\'' + f.fatura + '\')">' + td('<b>' + rotMes(f.fatura) + '</b>') + td(br(f.venc)) + td(R$(f.total), 1) + td(R$(f.pago), 1) + td('<b style="color:' + (f.aberto > 0.004 ? '#dc2626' : 'var(--teal)') + '">' + R$(f.aberto) + '</b>', 1) + '</tr>');
      const fs = fats.find(f => f.fatura === ST.mesFatura);
      const compras = fs ? tabela([{ t: 'Compra' }, { t: 'Fornecedor' }, { t: 'Parcela' }, { t: 'Valor', r: 1 }, { t: 'Situação' }], fs.linhas.map(x => '<tr>' + td(br(x.item.data)) + td(E(x.item.fornecedor)) + td(x.item.parcelado ? x.p.n + '/' + x.item.n : 'à vista') + td(R$(x.p.valor), 1) + td(x.p.pago ? '<span style="color:var(--teal)">paga em ' + br(x.p.dataPago) + '</span>' : 'em aberto') + '</tr>'), '') : '';
      det = '<div style="margin-top:16px"><div style="font-weight:700;margin-bottom:6px">Faturas — ' + E(c.nome) + (prox ? ' <span style="font-weight:400;color:var(--slate)">· próxima a pagar: ' + rotMes(prox.fatura) + ', vence ' + br(prox.venc) + ', <b style="color:#dc2626">' + R$(prox.aberto) + '</b></span>' : '') + '</div>'
        + tabela([{ t: 'Fatura (fechamento)' }, { t: 'Vencimento' }, { t: 'Total', r: 1 }, { t: 'Pago', r: 1 }, { t: 'Em aberto', r: 1 }], linhas, 'Nenhuma compra neste cartão ainda.') + (fs ? '<div style="margin-top:12px;font-weight:700">Compras da fatura de ' + rotMes(fs.fatura) + '</div>' + compras : '<div style="font-size:12px;color:var(--slate);margin-top:6px">Clique numa fatura para ver as compras dela.</div>') + '</div>';
    }
    return '<div style="display:flex;align-items:center;margin-bottom:10px"><div style="font-weight:700">Cartões de crédito</div><div style="margin-left:auto">' + B('+ Novo cartão', 'kcbmPf.cartaoForm()', 'bp') + '</div></div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap">' + (cards || '<div style="color:var(--slate);padding:16px">Nenhum cartão cadastrado. Cadastre para escolher na compra parcelada.</div>') + '</div>' + det;
  }

  // ───────────── ações ─────────────
  const K = {
    abrirModulo() { root.kcbmPfAbrir(); },
    novaPessoa() { modal('Nova pessoa física', formPessoa(null), m => { const f = lerFormPessoa(m); if (!f) return false; const l = lerLista(); const p = { id: uid(), criado: Date.now(), ...f }; l.push(p); gravarLista(l); gravarDados(p.id, novoDados()); K.abrir(p.id); root.toast('Pessoa cadastrada.', 'ok'); }); },
    editarPessoa(id) { const p = lerLista().find(x => x.id === id); if (!p) return; modal('Editar pessoa física', formPessoa(p), m => { const f = lerFormPessoa(m); if (!f) return false; gravarLista(lerLista().map(x => x.id === id ? Object.assign({}, x, f) : x)); render(); }); },
    excluirPessoa(id) { const p = lerLista().find(x => x.id === id); if (!p) return; if (!confirm('Excluir "' + p.nome + '" e TODOS os dados dela (entradas, gastos, extrato, contas, cartões)?\n\nNão dá para desfazer.')) return; if (prompt('Para confirmar, digite o nome da pessoa:') !== p.nome) { root.toast('Nome não confere — nada foi excluído.', 'err'); return; } gravarLista(lerLista().filter(x => x.id !== id)); render(); },
    abrir(id) { ST.pf = id; ST.aba = 'entradas'; ST.mesSaldo = null; ST.cartaoSel = null; ST.mesFatura = null; render(); },
    voltar() { ST.pf = null; render(); },
    aba(a) { ST.aba = a; ST.mesFatura = null; render(); },
    mesLista(n) { ST.mesLista = somaMes(ST.mesLista, n); render(); },
    mesSaldo(n) { ST.mesSaldo = somaMes(ST.mesSaldo || dadosAtual().saldoIni.mes, n); render(); },
    cartaoSel(id) { ST.cartaoSel = ST.cartaoSel === id ? null : id; ST.mesFatura = null; render(); },
    faturaSel(f) { ST.mesFatura = ST.mesFatura === f ? null : f; render(); },
    // saldos iniciais
    saldoIniForm() { const d = dadosAtual(); modal('Saldos iniciais', campo('Mês inicial', inp('kpfMesIni', d.saldoIni.mes, 'month'), 'O saldo começa neste mês (o calendário do Saldo não volta antes dele).') + campo('Saldo inicial de contas a pagar (R$)', inp('kpfSIP', String(d.saldoIni.pagar || 0).replace('.', ','), 'text', 'inputmode="decimal"')) + campo('Saldo inicial de contas a receber (R$)', inp('kpfSIR', String(d.saldoIni.receber || 0).replace('.', ','), 'text', 'inputmode="decimal"')), m => { const mes = val(m, 'kpfMesIni'); if (!/^\d{4}-\d{2}$/.test(mes)) { root.toast('Escolha o mês inicial.', 'err'); return false; } const dd = dadosAtual(); dd.saldoIni = { mes, pagar: num(val(m, 'kpfSIP')), receber: num(val(m, 'kpfSIR')) }; gravarDados(ST.pf, dd); ST.mesSaldo = mes; render(); root.toast('Saldos iniciais salvos.', 'ok'); }); },
    // entradas / gastos
    movForm(tipo, id) {
      const d = dadosAtual(), x = id ? d[tipo].find(y => y.id === id) : null, ent = tipo === 'entradas';
      modal((x ? 'Editar ' : 'Nova ') + (ent ? 'entrada' : 'gasto'), campo('Data', inp('kpfData', x ? x.data : hoje(), 'date')) + campo('Descrição', inp('kpfDesc', x ? x.descricao : '', 'text', 'maxlength="120"')) + campo(ent ? 'Categoria (tipo de receita)' : 'Categoria (tipo de gasto)', inp('kpfCat', x ? x.categoria : '', 'text', 'maxlength="60"')) + campo('Banco / conta', inp('kpfBanco', x ? x.banco : '', 'text', 'maxlength="60"')) + campo('Valor (R$)', inp('kpfValor', x ? String(x.valor).replace('.', ',') : '', 'text', 'inputmode="decimal"')),
        m => { const v = num(val(m, 'kpfValor')); if (!val(m, 'kpfData') || !(v > 0)) { root.toast('Informe a data e um valor maior que zero.', 'err'); return false; } const dd = dadosAtual(); const novo = { id: x ? x.id : uid(), data: val(m, 'kpfData'), descricao: (val(m, 'kpfDesc') || '').trim(), categoria: (val(m, 'kpfCat') || '').trim(), banco: (val(m, 'kpfBanco') || '').trim(), valor: v, extratoId: x ? x.extratoId : undefined }; dd[tipo] = x ? dd[tipo].map(y => y.id === x.id ? novo : y) : dd[tipo].concat([novo]); gravarDados(ST.pf, dd); ST.mesLista = novo.data.slice(0, 7); render(); });
    },
    movExcluir(tipo, id) { if (!confirm('Excluir este lançamento?')) return; const dd = dadosAtual(); const x = dd[tipo].find(y => y.id === id); dd[tipo] = dd[tipo].filter(y => y.id !== id); if (x && x.extratoId) dd.extrato = dd.extrato.map(l => l.id === x.extratoId ? Object.assign({}, l, { classe: null }) : l); gravarDados(ST.pf, dd); render(); },
    // extrato
    extratoForm() {
      modal('Lançar no extrato bancário', campo('Data', inp('kpfData', hoje(), 'date')) + campo('Banco / conta', inp('kpfBanco', '', 'text', 'maxlength="60" placeholder="Ex.: Nubank, Itaú..."')) + campo('Histórico', inp('kpfHist', '', 'text', 'maxlength="140"')) + campo('Tipo', sel('kpfTipo', [['sai', 'Saída (pagamento)'], ['ent', 'Entrada (recebimento)']], 'sai')) + campo('Valor (R$)', inp('kpfValor', '', 'text', 'inputmode="decimal"')),
        m => { const v = num(val(m, 'kpfValor')); if (!val(m, 'kpfData') || !(v > 0)) { root.toast('Informe a data e um valor maior que zero.', 'err'); return false; } const dd = dadosAtual(); dd.extrato.push({ id: uid(), criado: Date.now(), data: val(m, 'kpfData'), banco: (val(m, 'kpfBanco') || '').trim(), hist: (val(m, 'kpfHist') || '').trim(), valor: val(m, 'kpfTipo') === 'sai' ? -v : v, baixa: null, classe: null }); gravarDados(ST.pf, dd); ST.mesLista = val(m, 'kpfData').slice(0, 7); render(); });
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
      const linhas = pend.map((x, i) => '<label style="display:flex;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid var(--border);font-size:12.5px;cursor:pointer"><input type="checkbox" class="kpfSelP" data-i="' + i + '" data-v="' + cents(x.p.valor) + '"> <span style="flex:1">' + br(x.p.venc) + ' · ' + E(x.it[sai ? 'fornecedor' : 'cliente']) + ' · ' + (x.it.parcelado ? x.p.n + '/' + x.it.n : 'à vista') + (x.it.forma === 'cartao' ? ' · 💳 fatura ' + x.p.fatura : '') + '</span><b>' + R$(x.p.valor) + '</b></label>').join('');
      const corpo = '<div style="font-size:12.5px;margin-bottom:8px"><b>' + br(l.data) + '</b> · ' + E(l.hist) + ' · <b style="color:' + cor(l.valor) + '">' + R$(l.valor) + '</b></div>'
        + '<div style="font-weight:600;font-size:12.5px;margin-bottom:4px">' + (sai ? 'Dar baixa em contas a pagar' : 'Dar baixa em contas a receber') + ' <span id="kpfSoma" style="font-weight:400;color:var(--slate)"></span></div><div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px">' + (linhas || '<div style="padding:14px;color:var(--slate);font-size:12.5px">Nada em aberto.</div>') + '</div>'
        + '<div style="margin:12px 0 4px;font-weight:600;font-size:12.5px">…ou classificar direto como ' + (sai ? 'gasto' : 'entrada') + '</div>' + campo('Categoria', inp('kpfCatC', '', 'text', 'maxlength="60" placeholder="Ex.: ' + (sai ? 'Alimentação, Moradia...' : 'Salário, Aluguel recebido...') + '"'), 'Preencha só se NÃO for dar baixa em uma conta acima.');
      const m = modal('Baixar / classificar — extrato', corpo, mm => {
        const sel = [...mm.querySelectorAll('.kpfSelP:checked')].map(c => pend[+c.dataset.i]), cat = (val(mm, 'kpfCatC') || '').trim();
        const d2 = dadosAtual(), l2 = d2.extrato.find(x => x.id === id);
        if (sel.length) {
          const soma = sel.reduce((a, x) => a + cents(x.p.valor), 0);
          if (soma !== cents(abs) && !confirm('A soma marcada (' + R$(soma / 100) + ') é diferente do valor do extrato (' + R$(abs) + '). Dar baixa mesmo assim?')) return false;
          l2.baixa = []; sel.forEach(x => { const it = d2[tipo].find(y => y.id === x.it.id); const p = it.parcelas.find(q => q.n === x.p.n); p.pago = true; p.dataPago = l2.data; p.extratoId = id; l2.baixa.push({ tipo, itemId: it.id, n: p.n }); });
        } else if (cat) {
          l2.classe = { categoria: cat }; const lista = sai ? 'gastos' : 'entradas'; d2[lista].push({ id: uid(), data: l2.data, descricao: l2.hist, categoria: cat, banco: l2.banco, valor: abs, extratoId: id });
        } else { root.toast('Marque o que está sendo pago/recebido ou informe a categoria.', 'err'); return false; }
        gravarDados(ST.pf, d2); render(); root.toast('Lançamento contábil gerado.', 'ok');
      }, 'Gerar lançamento');
      const atual = () => { const s = [...m.querySelectorAll('.kpfSelP:checked')].reduce((a, c) => a + (+c.dataset.v), 0); m.querySelector('#kpfSoma').textContent = s ? '— marcado ' + R$(s / 100) + ' de ' + R$(abs) : ''; };
      m.querySelectorAll('.kpfSelP').forEach(c => c.onchange = atual);
    },
    // contas a pagar / receber
    tituloForm(tipo) {
      const d = dadosAtual(), pag = tipo === 'pagar';
      const corpo = campo('Data da ' + (pag ? 'compra' : 'venda'), inp('kpfData', hoje(), 'date')) + campo(pag ? 'Fornecedor' : 'Cliente', inp('kpfQuem', '', 'text', 'maxlength="100"')) + campo(pag ? 'Tipo de gasto' : 'Tipo de receita', inp('kpfTipoG', '', 'text', 'maxlength="60"')) + campo('Valor bruto (R$)', inp('kpfValor', '', 'text', 'inputmode="decimal"'))
        + campo('Foi parcelado?', '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="kpfParc"> Sim</label>')
        + '<div id="kpfParcBox" style="display:none">' + campo('Em quantas vezes?', inp('kpfN', '2', 'number', 'min="2" max="60"')) + '</div>'
        + campo('Forma de ' + (pag ? 'pagamento' : 'recebimento'), sel('kpfForma', (pag ? [['avista', 'À vista / boleto'], ['cartao', 'Cartão de crédito'], ['carne', 'Carnê'], ['outro', 'Outro']] : [['avista', 'À vista / boleto'], ['carne', 'Carnê'], ['outro', 'Outro']]), 'avista'))
        + (pag ? '<div id="kpfCartaoBox" style="display:none">' + campo('Cartão', d.cartoes.length ? sel('kpfCartao', d.cartoes.map(c => [c.id, c.nome]), d.cartoes[0].id) : '<div style="font-size:12px;color:#b45309">Nenhum cartão cadastrado — cadastre na aba Cartões de crédito.</div>') + '</div>' : '')
        + '<div id="kpfVencBox">' + campo('1º vencimento', inp('kpfVenc1', '', 'date'), 'Se deixar vazio, usa 30 dias depois da data. As demais parcelas vencem de mês em mês.') + '</div>';
      const m = modal(pag ? 'Registrar compra' : 'Registrar receita a receber', corpo, mm => {
        const v = num(val(mm, 'kpfValor')), quem = (val(mm, 'kpfQuem') || '').trim(), data = val(mm, 'kpfData'), parc = chk(mm, 'kpfParc'), n = parc ? Math.floor(num(val(mm, 'kpfN'))) : 1, forma = val(mm, 'kpfForma');
        if (!data || !quem || !(v > 0)) { root.toast('Informe a data, ' + (pag ? 'o fornecedor' : 'o cliente') + ' e o valor.', 'err'); return false; }
        if (parc && !(n >= 2)) { root.toast('Informe em quantas vezes (2 ou mais).', 'err'); return false; }
        const dd = dadosAtual(), cartaoId = (pag && forma === 'cartao') ? val(mm, 'kpfCartao') : null, cartao = cartaoId ? dd.cartoes.find(c => c.id === cartaoId) : null;
        if (pag && forma === 'cartao' && !cartao) { root.toast('Escolha o cartão de crédito.', 'err'); return false; }
        const it = { id: uid(), data, [pag ? 'fornecedor' : 'cliente']: quem, tipo: (val(mm, 'kpfTipoG') || '').trim(), valor: v, parcelado: parc, n, forma, cartaoId, venc1: val(mm, 'kpfVenc1') || '' };
        it.parcelas = gerarParcelas(it, cartao); dd[tipo].push(it); gravarDados(ST.pf, dd); render(); root.toast('Registrado: ' + it.parcelas.length + ' parcela(s) gerada(s).', 'ok');
      });
      const atualizar = () => { m.querySelector('#kpfParcBox').style.display = chk(m, 'kpfParc') ? '' : 'none'; const cart = pag && val(m, 'kpfForma') === 'cartao'; const cb = m.querySelector('#kpfCartaoBox'); if (cb) cb.style.display = cart ? '' : 'none'; m.querySelector('#kpfVencBox').style.display = cart ? 'none' : ''; };
      m.querySelector('#kpfParc').onchange = atualizar; m.querySelector('#kpfForma').onchange = atualizar; atualizar();
    },
    tituloVer(tipo, id) {
      const d = dadosAtual(), it = d[tipo].find(x => x.id === id); if (!it) return; const pag = tipo === 'pagar';
      const linhas = (it.parcelas || []).map(p => '<tr>' + td(p.n + '/' + (it.parcelado ? it.n : 1)) + td(br(p.venc) + (p.fatura ? ' <span style="color:var(--slate);font-size:11px">(fatura ' + p.fatura + ')</span>' : '')) + td(R$(p.valor), 1) + td(p.pago ? '<span style="color:var(--teal)">' + (pag ? 'paga' : 'recebida') + ' em ' + br(p.dataPago) + '</span>' : 'em aberto') + '</tr>').join('');
      modal((pag ? 'Compra — ' : 'Receita — ') + E(it[pag ? 'fornecedor' : 'cliente']), '<div style="font-size:12.5px;margin-bottom:8px">' + br(it.data) + ' · ' + R$(it.valor) + ' · ' + E(it.tipo || '') + '</div>' + tabela([{ t: 'Parcela' }, { t: 'Vencimento' }, { t: 'Valor', r: 1 }, { t: 'Situação' }], [linhas], '') + '<div style="font-size:11.5px;color:var(--slate);margin-top:8px">A baixa é feita na aba Extrato bancário (Baixar / classificar).</div>', null);
    },
    tituloExcluir(tipo, id) { const dd = dadosAtual(), it = dd[tipo].find(x => x.id === id); if (!it) return; if ((it.parcelas || []).some(p => p.pago) && !confirm('Há parcelas já baixadas no extrato. Excluir mesmo assim? (A baixa ficará sem a conta.)')) return; if (!confirm('Excluir este registro e suas parcelas?')) return; dd[tipo] = dd[tipo].filter(x => x.id !== id); dd.extrato.forEach(l => { l.baixa = (l.baixa || []).filter(b => b.itemId !== id); if (l.baixa && !l.baixa.length && !l.classe) l.baixa = null; }); gravarDados(ST.pf, dd); render(); },
    // cartões
    cartaoForm(id) {
      const d = dadosAtual(), c = id ? d.cartoes.find(x => x.id === id) : null;
      modal(c ? 'Editar cartão' : 'Novo cartão de crédito', campo('Nome do cartão', inp('kpfNomeC', c ? c.nome : '', 'text', 'maxlength="60" placeholder="Ex.: Nubank, Itaú Visa"')) + campo('Limite (R$)', inp('kpfLim', c ? String(c.limite).replace('.', ',') : '', 'text', 'inputmode="decimal"')) + campo('Dia de fechamento da fatura', inp('kpfFech', c ? c.fechamento : '25', 'number', 'min="1" max="31"')) + campo('Dia de vencimento da fatura', inp('kpfVencC', c ? c.vencimento : '5', 'number', 'min="1" max="31"'), 'Compra feita até o dia do fechamento entra na fatura que fecha no mês; depois, na seguinte.'),
        m => { const nome = (val(m, 'kpfNomeC') || '').trim(), f = Math.floor(num(val(m, 'kpfFech'))), v = Math.floor(num(val(m, 'kpfVencC'))); if (!nome || !(f >= 1 && f <= 31) || !(v >= 1 && v <= 31)) { root.toast('Informe o nome e os dias de fechamento e vencimento (1 a 31).', 'err'); return false; } const dd = dadosAtual(); const novo = { id: c ? c.id : uid(), nome, limite: num(val(m, 'kpfLim')), fechamento: f, vencimento: v }; dd.cartoes = c ? dd.cartoes.map(x => x.id === c.id ? novo : x) : dd.cartoes.concat([novo]); if (!c) ST.cartaoSel = novo.id; gravarDados(ST.pf, dd); render(); });
    }
  };
  root.kcbmPf = K;
  function render() { if (!el()) return; if (ST.pf) telaPessoa(); else telaLista(); }

  // ───────────── integração com o site (menu, cartão da tela inicial, página) ─────────────
  root.kcbmPfAbrir = function () { root.goPage('kcbm-pf'); };
  function montar() {
    if (document.getElementById('n-kcbm-pf') || !document.getElementById('page-home')) return false;
    const ref = document.getElementById('n-lembretes') || document.querySelector('aside .ni');
    if (ref) { const ni = document.createElement('div'); ni.className = 'ni'; ni.id = 'n-kcbm-pf'; ni.setAttribute('onclick', 'kcbmPfAbrir()'); ni.innerHTML = '<span class="ic">👤</span>Pessoa Física'; ref.parentNode.insertBefore(ni, ref.nextSibling); }
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
