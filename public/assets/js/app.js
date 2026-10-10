/* Calendário Editorial Mentorei: telas e ações.
   Papéis: admin (Juliana), criativa e socia. O que cada um vê está em ABAS_POR_PAPEL. */
(() => {
  const cfg = CAL.config, D = CAL.datas, esc = CAL.esc;
  const $ = (s, el = document) => el.querySelector(s);

  // o link de convite/recuperação de senha chega com type=invite|recovery; lido antes do Supabase limpar o endereço
  const tipoLink = new URLSearchParams(location.hash.slice(1)).get('type');

  const ABAS = {
    hoje: 'Hoje', semana: 'Semana', mes: 'Mês', caixa: 'Caixa de entrada', meus: 'Meus envios',
    enviar: 'Enviar vídeo', checkin: 'Check-in', evolucao: 'Evolução', anuncios: 'Anúncios', destaques: 'Destaques',
    arquivos: 'Arquivos', linkedin: 'LinkedIn', mala: 'Mala direta',
  };
  const ABAS_POR_PAPEL = {
    admin: ['hoje', 'semana', 'mes', 'caixa', 'arquivos', 'destaques', 'linkedin', 'mala', 'enviar', 'checkin', 'evolucao', 'anuncios'],
    criativa: ['hoje', 'semana', 'mes', 'caixa', 'arquivos', 'destaques', 'linkedin', 'mala', 'checkin', 'evolucao', 'anuncios'],
    socia: ['enviar', 'arquivos', 'meus', 'semana', 'evolucao'],
  };

  const st = {
    api: null, eu: null, nomes: {}, aba: null, ref: D.hoje(), posts: {}, links: {}, checkinSemana: null,
    destaques: [], feedAte: null, feedDatas: true, pasta: null, arquivos: [],
    liModo: 'posts', liRef: null, liSemana: null, emModo: 'envios', emRef: null,
  };
  const nomeDestaque = (id) => (st.destaques.find((d) => d.id === id) || {}).nome || '';

  const pode = {
    editar: (p) => ['admin', 'criativa'].includes(st.eu.papel) || (p && p.autor_id === st.eu.id && p.status !== 'postado'),
    criar: () => ['admin', 'criativa'].includes(st.eu.papel),
    excluir: (p) => st.eu.papel === 'admin' || (p.autor_id === st.eu.id && p.status !== 'postado'),
    postar: () => ['admin', 'criativa'].includes(st.eu.papel),
    checkin: () => ['admin', 'criativa'].includes(st.eu.papel),
  };

  // ---------------------------------------------------------------- avisos e telas
  let timerAviso;
  function aviso(texto, erro) {
    const el = $('#aviso');
    el.textContent = texto;
    el.className = erro ? 'erro' : '';
    el.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { el.hidden = true; }, erro ? 6000 : 2800);
  }
  const falha = (e) => { console.error(e); aviso(e.message || 'Algo deu errado. Tente de novo.', true); };

  function mostrarTela(id) {
    ['tela-login', 'tela-senha', 'tela-sem-acesso', 'app'].forEach((t) => { $('#' + t).hidden = t !== id; });
  }

  // ---------------------------------------------------------------- início
  async function iniciar() {
    // permite instalar como app e receber fotos pelo "Compartilhar" do celular (sw.js)
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('sw', e));
    }
    // veio do "Compartilhar": abre direto a aba Arquivos
    if (/[?&]compartilhado=1/.test(location.search)) {
      st.aba = 'arquivos';
      history.replaceState(null, '', location.pathname + location.search.replace(/[?&]compartilhado=1/, '').replace(/^&/, '?') + '#arquivos');
    }
    try {
      if (!cfg.demo && !window.supabase) throw new Error('Não consegui carregar o sistema de login. Verifique a internet e recarregue a página.');
      if (cfg.demo && location.hostname === 'localhost' && !/semprevia/.test(location.search)) await carregarPrevia();
      st.api = cfg.demo ? CAL.criarApiDemo(cfg) : CAL.criarApiSupabase(cfg);
      const sessao = await st.api.iniciar((evento) => {
        if (evento === 'PASSWORD_RECOVERY') mostrarTela('tela-senha');
        if (evento === 'SIGNED_OUT') mostrarTela('tela-login');
      });
      if (cfg.demo) montarFaixaDemo();
      if (sessao && (tipoLink === 'invite' || tipoLink === 'recovery')) mostrarTela('tela-senha');
      else if (sessao) await entrarNoApp();
      else mostrarTela('tela-login');
    } catch (e) {
      mostrarTela('tela-login');
      falha(e);
    }
  }

  // no computador, a demonstração mostra a fila de posts prontos (fila/previa.json), se existir
  async function carregarPrevia() {
    try {
      const r = await fetch('/_local/fila/previa.json', { cache: 'no-store' });
      if (!r.ok) return;
      CAL.previa = await r.json();
      if (!CAL.previa.length) { CAL.previa = null; return; }
      st.ref = CAL.previa.map((p) => p.data).filter(Boolean).sort()[0] || st.ref;
      if (!location.hash) st.aba = 'semana';
      $('#faixa-demo span').innerHTML = `<strong>Prévia da fila:</strong> ${CAL.previa.length} posts prontos para entrar no calendário. Nada é salvo aqui.`;
    } catch (e) { CAL.previa = null; }
  }

  function montarFaixaDemo() {
    const faixa = $('#faixa-demo');
    faixa.hidden = false;
    const sel = $('#demo-papel');
    sel.innerHTML = st.api.perfisDemo.map((p) => `<option value="${p.papel}">${esc(p.nome)}</option>`).join('');
    st.api.meuPerfil().then((p) => { sel.value = p.papel; });
    sel.addEventListener('change', async () => { st.api.trocarPapel(sel.value); st.aba = null; await entrarNoApp(); });
  }

  async function entrarNoApp() {
    st.eu = await st.api.meuPerfil();
    if (!st.eu || !st.eu.papel) { mostrarTela('tela-sem-acesso'); return; }
    (await st.api.perfis()).forEach((p) => { st.nomes[p.id] = p.nome; });
    $('#usuario-nome').textContent = st.eu.nome;
    $('#sair').hidden = cfg.demo;
    $('#trocar-senha').hidden = cfg.demo;
    await carregarDestaques();
    const abas = ABAS_POR_PAPEL[st.eu.papel];
    $('#abas').innerHTML = abas.map((a) => `<button type="button" data-aba="${a}">${ABAS[a]}</button>`).join('');
    const pedida = location.hash.slice(1);
    st.aba = abas.includes(st.aba) ? st.aba : abas.includes(pedida) ? pedida : abas[0];
    mostrarTela('app');
    await irPara(st.aba);
  }

  async function irPara(aba) {
    st.aba = aba;
    history.replaceState(null, '', '#' + aba);
    document.querySelectorAll('#abas button').forEach((b) => b.setAttribute('aria-current', b.dataset.aba === aba ? 'page' : 'false'));
    const ativo = $('#abas [aria-current="page"]');
    if (ativo) ativo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const el = $('#conteudo');
    el.innerHTML = '<p class="carregando">Carregando…</p>';
    try {
      await TELAS[aba](el);
      carregarMiniaturas(el);
    } catch (e) {
      el.innerHTML = `<p class="vazio">Não consegui carregar esta tela. ${esc(e.message)}</p>`;
      falha(e);
    }
  }
  const recarregar = () => {
    if (!$('#tela-feed').hidden) desenharFeed();
    return irPara(st.aba);
  };

  // lista de destaques (com os stories de cada um); se a tabela ainda não existir, o resto do calendário segue funcionando
  async function carregarDestaques() {
    try { st.destaques = await st.api.destaques(); } catch (e) { console.warn('destaques', e); st.destaques = []; }
    return st.destaques;
  }

  // ---------------------------------------------------------------- peças comuns
  function guardar(lista) { lista.forEach((p) => { st.posts[p.id] = p; }); return lista; }

  const chipStatus = (s, p) => `<span class="chip st-${s}">${p ? CAL.statusDe(p, s) : CAL.STATUS[s]}</span>`;

  // só imagem e vídeo viram miniatura (um HTML ou PDF de e-mail aparece pelo nome do tipo)
  const visual = (m) => /^(image|video)\//.test(m.tipo);
  const extensao = (m) => ((m.nome.match(/\.([a-z0-9]+)$/i) || [])[1] || 'arquivo').toUpperCase();

  function miniatura(p) {
    const lista = p.midias || [];
    const m = lista.find(visual);
    if (!m) return `<span class="thumb sem">${lista.length ? esc(extensao(lista[0])) : 'sem arte'}</span>`;
    const extra = lista.length > 1 ? `<span class="thumb-n">${lista.length}</span>` : '';
    // arte de e-mail é comprida: a miniatura mostra o topo, que é o que a pessoa vê primeiro
    return `<span class="thumb${p.rede === 'email' ? ' thumb-email' : ''}" data-thumb="${esc(m.caminho)}" data-tipo="${esc(m.tipo)}" data-post="${p.id}">${extra}</span>`;
  }

  // nome digitado no envio; sem ele, o nome do login de quem é sócia
  const quemEnviou = (p) => p.enviado_por || (p.origem === 'socia' ? st.nomes[p.autor_id] || 'sócia' : '');

  // último nome digitado neste aparelho (conveniência; funciona sem ele)
  const lerNome = () => { try { return localStorage.getItem('cal_meu_nome') || ''; } catch (e) { return ''; } };
  const guardarNome = (n) => { try { localStorage.setItem('cal_meu_nome', n); } catch (e) { /* sem armazenamento */ } };

  function cartao(p, opc = {}) {
    const quando = opc.mostrarData && p.data ? `${D.curto(p.data)} · ` : '';
    const hora = p.hora ? D.hora(p.hora) : 'a definir';
    const assunto = p.rede === 'email' && p.email && p.email.assunto;
    const de = quemEnviou(p) ? `<span class="post-de">Enviado por ${esc(quemEnviou(p))}</span>`
      : p.destaque_id ? `<span class="post-de">→ destaque “${esc(nomeDestaque(p.destaque_id))}”${p.no_destaque ? ' ✓' : ''}</span>`
      : assunto ? `<span class="post-de">✉ “${esc(assunto)}”${p.email.publico ? ` · para ${esc(p.email.publico)}` : ''}</span>` : '';
    return `<button type="button" class="post st-${p.status}" data-acao="abrir" data-id="${p.id}">
      ${miniatura(p)}
      <span class="post-info">
        <span class="post-topo"><b>${quando}${hora}</b> · ${CAL.formatoDe(p)}${p.fixado ? ' · 📌' : ''}</span>
        <span class="post-tema">${esc(p.tema || 'Sem tema')}</span>
        ${de}${chipStatus(p.status, p)}
      </span>
    </button>`;
  }

  function livre(data, hora) {
    const futuro = data > D.hoje() || (data === D.hoje() && hora >= D.horaAgora());
    if (!futuro) return '';
    const clicavel = pode.criar();
    return `<${clicavel ? 'button type="button" data-acao="novo"' : 'div'} class="post livre" data-data="${data}" data-hora="${hora}">
      <span class="livre-hora">${hora}</span><span>Horário livre${clicavel ? ' <em>+ criar post</em>' : ''}</span>
    </${clicavel ? 'button' : 'div'}>`;
  }

  // posts do dia + horários padrão ainda sem post
  function itensDoDia(data, posts) {
    const doDia = posts.filter((p) => p.data === data);
    const ocupados = new Set(doDia.map((p) => D.hora(p.hora)));
    const livres = (cfg.horarios[D.parse(data).getDay()] || []).filter((h) => !ocupados.has(h));
    const itens = doDia.map((p) => ({ chave: p.hora ? D.hora(p.hora) : '99', html: cartao(p) }))
      .concat(livres.map((h) => ({ chave: h, html: livre(data, h) })));
    return itens.sort((a, b) => a.chave.localeCompare(b.chave)).map((i) => i.html).join('');
  }

  const contarLivres = (data, posts) => {
    const ocupados = new Set(posts.filter((p) => p.data === data).map((p) => D.hora(p.hora)));
    return (cfg.horarios[D.parse(data).getDay()] || []).filter((h) => !ocupados.has(h)
      && (data > D.hoje() || (data === D.hoje() && h >= D.horaAgora()))).length;
  };

  async function carregarMiniaturas(raiz) {
    const alvos = [...raiz.querySelectorAll('[data-thumb]:not(.ok)')];
    if (!alvos.length) return;
    const midias = alvos.map((a) => (st.posts[a.dataset.post].midias || []).find((m) => m.caminho === a.dataset.thumb))
      .filter((m) => m && !st.links[m.caminho]);
    try {
      if (midias.length) Object.assign(st.links, await st.api.linksVisualizacao(midias));
    } catch (e) { console.warn('miniaturas', e); }
    alvos.forEach((a) => {
      const url = st.links[a.dataset.thumb];
      if (!url) return;
      a.classList.add('ok');
      if (a.dataset.tipo.startsWith('video/')) {
        a.insertAdjacentHTML('afterbegin', `<video src="${esc(url)}#t=0.5" muted playsinline preload="metadata"></video><span class="thumb-play">▶</span>`);
      } else {
        a.style.backgroundImage = `url("${url}")`;
      }
    });
  }

  // ---------------------------------------------------------------- telas
  const TELAS = {};

  TELAS.hoje = async (el) => {
    const hoje = D.hoje(), amanha = D.somar(hoje, 1);
    const semanaPassada = D.somar(D.segunda(hoje), -7);
    // o lembrete do check-in só aparece se a semana passada teve posts no calendário
    const [posts, caixa, checkins, passada] = await Promise.all([
      st.api.posts(hoje, amanha), st.api.caixa(), pode.checkin() ? st.api.checkins() : Promise.resolve(null),
      pode.checkin() ? st.api.posts(semanaPassada, D.somar(semanaPassada, 6)) : Promise.resolve([]),
    ]);
    guardar(posts); guardar(caixa);
    const deHoje = posts.filter((p) => p.data === hoje);
    const feitos = deHoje.filter((p) => p.status === 'postado').length;
    const faltaCheckin = checkins && passada.length > 0 && !checkins.some((c) => c.semana === semanaPassada);
    const semDestaque = pode.postar() ? (await carregarDestaques())
      .flatMap((d) => d.stories || []).filter((s) => s.status === 'postado' && !s.no_destaque).length : 0;
    // LinkedIn do dia (e lembrete do check-in do LinkedIn); se a tabela ainda não existir, só não mostra
    const liPosts = guardar(await st.api.postsLinkedin(hoje, amanha).catch(() => []));
    const liCheckins = pode.checkin() ? await st.api.checkinsLinkedin().catch(() => null) : null;
    const liPassada = liCheckins ? await st.api.postsLinkedin(semanaPassada, D.somar(semanaPassada, 6)).catch(() => []) : [];
    const faltaCheckinLi = liCheckins && liPassada.length > 0 && !liCheckins.some((c) => c.semana === semanaPassada);
    const liHoje = liPosts.filter((p) => p.data === hoje), liAmanha = liPosts.filter((p) => p.data === amanha);
    // mala direta do dia e e-mails enviados há 2 dias ou mais ainda sem os números do RD Station
    const emails = pode.criar() ? guardar(await st.api.postsEmail(D.somar(hoje, -45), amanha).catch(() => [])) : [];
    const emHoje = emails.filter((p) => p.data === hoje), emAmanha = emails.filter((p) => p.data === amanha);
    const semNumeros = emails.filter((p) => p.status === 'postado' && p.data <= D.somar(hoje, -2) && !temResultados(p)).length;

    el.innerHTML = `
      <div class="cabeca">
        <div><p class="sobre">Hoje</p><h1>${D.longo(hoje)}</h1>
        <p class="resumo">${deHoje.length} ${deHoje.length === 1 ? 'post' : 'posts'} hoje · ${feitos} ${feitos === 1 ? 'postado' : 'postados'}</p></div>
        ${pode.criar() ? `<button type="button" class="btn small" data-acao="novo" data-data="${hoje}">+ Novo post</button>` : ''}
      </div>
      ${faltaCheckin ? `<button type="button" class="alerta" data-aba-ir="checkin">
        <strong>Check-in da semana pendente</strong>
        <span>Conte como foi a semana de ${D.ddmm(semanaPassada)} a ${D.ddmm(D.somar(semanaPassada, 6))}: seguidores, alcance e o melhor post. Leva 3 minutos. →</span>
      </button>` : ''}
      ${semDestaque ? `<button type="button" class="alerta" data-aba-ir="destaques">
        <strong>${semDestaque} ${semDestaque === 1 ? 'story postado ainda não foi' : 'stories postados ainda não foram'} para o destaque</strong>
        <span>No Instagram, abra o story, toque em “Destacar” e escolha o destaque. Depois marque aqui. →</span>
      </button>` : ''}
      ${faltaCheckinLi ? `<button type="button" class="alerta suave" data-acao="li-relatorio">
        <strong>Check-in do LinkedIn pendente</strong>
        <span>Números da página da Mentorei na semana de ${D.ddmm(semanaPassada)} a ${D.ddmm(D.somar(semanaPassada, 6))}. →</span>
      </button>` : ''}
      ${semNumeros ? `<button type="button" class="alerta suave" data-acao="em-resultados">
        <strong>${semNumeros === 1 ? '1 e-mail da mala direta está' : `${semNumeros} e-mails da mala direta estão`} sem resultados</strong>
        <span>Copie do relatório do RD Station: entregues, aberturas, cliques e descadastros. →</span>
      </button>` : ''}
      <section class="lista-dia">${itensDoDia(hoje, posts) || '<p class="vazio">Nenhum post marcado para hoje.</p>'}</section>
      ${liHoje.length ? `<h2 class="sub">LinkedIn hoje</h2><section class="lista-dia">${liHoje.map((p) => cartao(p)).join('')}</section>` : ''}
      ${emHoje.length ? `<h2 class="sub">Mala direta hoje</h2><section class="lista-dia">${emHoje.map((p) => cartao(p)).join('')}</section>` : ''}
      ${caixa.length && pode.criar() ? `<button type="button" class="alerta suave" data-aba-ir="caixa">
        <strong>${caixa.length} ${caixa.length === 1 ? 'envio aguardando' : 'envios aguardando'} dia e horário</strong>
        <span>Vídeos das sócias e posts sem data ficam na Caixa de entrada. →</span></button>` : ''}
      <h2 class="sub">Amanhã · ${D.curto(amanha)}</h2>
      <section class="lista-dia">${itensDoDia(amanha, posts) || '<p class="vazio">Nada marcado para amanhã.</p>'}</section>
      ${liAmanha.length ? `<h2 class="sub">LinkedIn amanhã</h2><section class="lista-dia">${liAmanha.map((p) => cartao(p)).join('')}</section>` : ''}
      ${emAmanha.length ? `<h2 class="sub">Mala direta amanhã</h2><section class="lista-dia">${emAmanha.map((p) => cartao(p)).join('')}</section>` : ''}`;
  };

  TELAS.semana = async (el) => {
    const ini = D.segunda(st.ref), fim = D.somar(ini, 6);
    const posts = guardar(await st.api.posts(ini, fim));
    const dias = Array.from({ length: 7 }, (_, i) => D.somar(ini, i));
    const livres = dias.reduce((s, d) => s + contarLivres(d, posts), 0);
    const ehEstaSemana = ini === D.segunda(D.hoje());
    el.innerHTML = `
      <div class="cabeca">
        <div><p class="sobre">Semana</p><h1>${D.ddmm(ini)} a ${D.ddmm(fim)}</h1>
        <p class="resumo">${posts.length} posts${livres ? ` · <span class="destaque">${livres} ${livres === 1 ? 'horário livre' : 'horários livres'}</span>` : ''}</p></div>
        <div class="nav-periodo">
          <button type="button" class="btn small ghost" data-mover="-7" aria-label="Semana anterior">‹</button>
          ${ehEstaSemana ? '' : '<button type="button" class="btn small ghost" data-mover="0">Esta semana</button>'}
          <button type="button" class="btn small ghost" data-mover="7" aria-label="Próxima semana">›</button>
        </div>
      </div>
      <div class="semana">${dias.map((d) => `
        <section class="dia${d === D.hoje() ? ' hoje' : ''}">
          <h2><span>${D.DIAS_CURTOS[D.parse(d).getDay()]}</span> ${D.ddmm(d)}</h2>
          ${itensDoDia(d, posts) || '<p class="vazio">—</p>'}
        </section>`).join('')}
      </div>`;
  };

  TELAS.mes = async (el) => {
    const primeiro = D.primeiroDoMes(st.ref), ultimo = D.somar(D.somarMeses(primeiro, 1), -1);
    const ini = D.segunda(primeiro), fim = D.somar(D.segunda(ultimo), 6);
    const posts = guardar(await st.api.posts(ini, fim));
    const celulas = [];
    for (let d = ini; d <= fim; d = D.somar(d, 1)) {
      const doDia = posts.filter((p) => p.data === d);
      const livres = contarLivres(d, posts);
      const fora = d.slice(0, 7) !== primeiro.slice(0, 7);
      celulas.push(`<button type="button" class="cel${fora ? ' fora' : ''}${d === D.hoje() ? ' hoje' : ''}" data-ver-semana="${d}"
        aria-label="${D.longo(d)}: ${doDia.length} posts${livres ? `, ${livres} horários livres` : ''}">
        <span class="cel-n">${D.parse(d).getDate()}</span>
        <span class="cel-posts">${doDia.slice(0, 3).map((p) => `<span class="mini st-${p.status}">${D.hora(p.hora) || '—'} ${CAL.formatoDe(p)}</span>`).join('')}
        ${doDia.length > 3 ? `<span class="mais">+${doDia.length - 3}</span>` : ''}</span>
        <span class="cel-pontos">${doDia.map((p) => `<i class="st-${p.status}"></i>`).join('')}</span>
        ${livres ? `<span class="cel-livre">${livres} ${livres === 1 ? 'livre' : 'livres'}</span>` : ''}
      </button>`);
    }
    el.innerHTML = `
      <div class="cabeca">
        <div><p class="sobre">Mês</p><h1 class="cap">${D.mesAno(primeiro)}</h1>
        <p class="resumo">${posts.filter((p) => p.data.slice(0, 7) === primeiro.slice(0, 7)).length} posts no mês. Toque num dia para ver a semana.</p></div>
        <div class="nav-periodo">
          <button type="button" class="btn small ghost" data-mover-mes="-1" aria-label="Mês anterior">‹</button>
          <button type="button" class="btn small ghost" data-mover-mes="1" aria-label="Próximo mês">›</button>
        </div>
      </div>
      <div class="legenda-status">${Object.keys(CAL.STATUS).map((s) => `<span><i class="st-${s}"></i>${CAL.STATUS[s]}</span>`).join('')}</div>
      <div class="mes">${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((d) => `<span class="mes-dia">${d}</span>`).join('')}${celulas.join('')}</div>`;
  };

  TELAS.caixa = async (el) => {
    const lista = guardar(await st.api.caixa());
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Caixa de entrada</p><h1>Aguardando dia e horário</h1>
      <p class="resumo">Vídeos enviados pelas sócias e posts ainda sem data. Abra o envio e use <b>Editar</b> para marcar o dia.</p></div></div>
      <section class="lista">${lista.map((p) => `
        <div class="caixa-item">${cartao(p, { mostrarData: true })}
          <p class="caixa-meta">Recebido em ${new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          ${p.data ? ` · dia desejado: ${D.curto(p.data)}` : ''}${p.observacoes ? ` · “${esc(p.observacoes)}”` : ''}</p>
        </div>`).join('') || '<p class="vazio">Tudo em dia: nenhum envio aguardando.</p>'}</section>`;
  };

  TELAS.meus = async (el) => {
    const lista = guardar(await st.api.meusEnvios(st.eu.id));
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Meus envios</p><h1>O que você mandou</h1>
      <p class="resumo">Acompanhe quando cada vídeo foi agendado e postado.</p></div>
      <button type="button" class="btn small" data-aba-ir="enviar">+ Enviar vídeo</button></div>
      <section class="lista">${lista.map((p) => cartao(p, { mostrarData: true })).join('') || '<p class="vazio">Você ainda não enviou nenhum vídeo.</p>'}</section>`;
  };

  TELAS.enviar = async (el) => {
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Enviar vídeo</p><h1>Mande seu vídeo para o Instagram da Mentorei</h1>
      <p class="resumo">A criativa recebe na Caixa de entrada, marca o dia e posta. Você acompanha em “Meus envios”.</p></div></div>
      <form id="form-enviar" class="cartao-form">
        <label class="campo-arquivo">
          <input type="file" name="arquivos" accept="video/*,image/*" multiple required>
          <span class="campo-arquivo-txt"><strong>Escolher vídeo ou fotos</strong><small>Até ${cfg.limiteArquivoMB} MB por arquivo</small></span>
        </label>
        <ul class="arquivos" id="lista-arquivos"></ul>
        <div class="grade-2">
          <label class="field"><span>Formato</span>
            <select name="formato">${Object.entries(CAL.FORMATOS).map(([k, v]) => `<option value="${k}"${k === 'reels' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span>Dia desejado (opcional)</span><input type="date" name="data" min="${D.hoje()}"></label>
        </div>
        <label class="field"><span>Seu nome</span><input type="text" name="enviado_por" required maxlength="60" autocomplete="given-name" value="${esc(lerNome() || (st.eu.papel === 'socia' ? st.eu.nome : ''))}"></label>
        <label class="field"><span>Assunto do vídeo</span><input type="text" name="tema" required maxlength="140" placeholder="Ex.: Bastidores da mentoria de hoje"></label>
        <label class="field"><span>Sugestão de legenda (opcional)</span><textarea name="legenda" rows="4"></textarea></label>
        <label class="field"><span>Recado para a criativa (opcional)</span><textarea name="observacoes" rows="2" placeholder="Ex.: cortar os 3 primeiros segundos; marcar @fulana"></textarea></label>
        <button type="submit" class="btn">Enviar</button>
      </form>`;
    const form = $('#form-enviar', el);
    form.arquivos.addEventListener('change', () => {
      $('#lista-arquivos', el).innerHTML = [...form.arquivos.files].map((f) => {
        const grande = f.size > cfg.limiteArquivoMB * 1048576;
        return `<li class="${grande ? 'erro' : ''}"><span>${esc(f.name)}</span><small>${CAL.tamanho(f.size)}${grande ? ' · grande demais' : ''}</small><progress max="1" value="0" hidden></progress></li>`;
      }).join('');
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const arquivos = [...form.arquivos.files];
      const grande = arquivos.find((f) => f.size > cfg.limiteArquivoMB * 1048576);
      if (grande) { aviso(`"${grande.name}" passa de ${cfg.limiteArquivoMB} MB. Comprima o vídeo (ou envie pelo WhatsApp) e tente de novo.`, true); return; }
      const botao = form.querySelector('[type=submit]');
      botao.disabled = true; botao.textContent = 'Enviando… não feche a página';
      let post;
      try {
        post = await st.api.salvarPost({
          data: form.data.value || null, hora: null, formato: form.formato.value, tema: form.tema.value.trim(),
          legenda: form.legenda.value.trim(), hashtags: '', observacoes: form.observacoes.value.trim(),
          status: 'pronto', origem: st.eu.papel === 'socia' ? 'socia' : 'manual', autor_id: st.eu.id,
          enviado_por: form.enviado_por.value.trim(),
        });
        guardarNome(form.enviado_por.value.trim());
        await enviarArquivos(post.id, arquivos, 0, $('#lista-arquivos', el));
        aviso('Enviado! A criativa já consegue ver na Caixa de entrada.');
        irPara(st.eu.papel === 'socia' ? 'meus' : 'caixa');
      } catch (e) {
        if (post && !(await postTemMidia(post))) await st.api.excluirPost(post).catch(() => {});
        botao.disabled = false; botao.textContent = 'Tentar de novo';
        falha(e);
      }
    });
  };

  async function postTemMidia(post) {
    const lista = post.data ? await st.api.posts(post.data, post.data) : await st.api.caixa();
    const p = lista.find((x) => x.id === post.id);
    return p && p.midias.length > 0;
  }

  async function enviarArquivos(postId, arquivos, ordemInicial, listaEl) {
    const itens = listaEl ? [...listaEl.querySelectorAll('li')] : [];
    for (let i = 0; i < arquivos.length; i++) {
      const barra = itens[i] && itens[i].querySelector('progress');
      if (barra) barra.hidden = false;
      await st.api.enviarArquivo(postId, arquivos[i], ordemInicial + i, (f) => { if (barra) barra.value = f; });
    }
  }

  // Semanas do check-in: a atual (em andamento) e as 6 anteriores, só as que têm post ou check-in
  // (semana sem nada no calendário não tem o que contar). Abre na última semana completa com posts; se não houver, na atual.
  function semanasDoCheckin(posts, checkins, escolhida) {
    const estaSemana = D.segunda(D.hoje());
    const comPost = new Set(posts.map((p) => D.segunda(p.data)));
    const feitos = new Set(checkins.map((c) => c.semana));
    let semanas = Array.from({ length: 7 }, (_, i) => D.somar(estaSemana, -7 * i)).filter((s) => comPost.has(s) || feitos.has(s));
    if (!semanas.length) semanas = [estaSemana];
    const semana = semanas.includes(escolhida) ? escolhida : (semanas.find((s) => s < estaSemana && comPost.has(s)) || semanas[0]);
    const opcoes = semanas.map((s) => `<option value="${s}"${s === semana ? ' selected' : ''}>${D.ddmm(s)} a ${D.ddmm(D.somar(s, 6))}${s === estaSemana ? ' · esta semana' : ''}${feitos.has(s) ? ' ✓ preenchida' : ' · pendente'}</option>`).join('');
    const nota = semana === estaSemana ? '<small>A semana ainda não acabou: se preencher agora, atualize na segunda com os números finais.</small>' : '';
    return { semana, opcoes, nota };
  }

  TELAS.checkin = async (el) => {
    const estaSemana = D.segunda(D.hoje());
    const [checkins, todos] = await Promise.all([st.api.checkins(), st.api.posts(D.somar(estaSemana, -42), D.somar(estaSemana, 6))]);
    const { semana, opcoes, nota: avisoSemana } = semanasDoCheckin(todos, checkins, st.checkinSemana);
    const posts = guardar(todos.filter((p) => D.segunda(p.data) === semana));
    const atual = checkins.find((c) => c.semana === semana) || {};
    const anterior = checkins.filter((c) => c.semana < semana).pop();
    // stories ficam de fora: a pergunta é sobre o post do feed
    const doFeed = posts.filter((p) => p.formato !== 'stories');
    const postados = doFeed.filter((p) => p.status === 'postado');

    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Check-in semanal</p><h1>Como foi a semana?</h1>
      <p class="resumo">Preencha toda segunda-feira com os números da semana anterior. Eles alimentam a aba Evolução.</p></div></div>
      <form id="form-checkin" class="cartao-form">
        <label class="field"><span>Semana</span>
          <select name="semana">${opcoes}</select>${avisoSemana}</label>
        <details class="ajuda"><summary>Onde encontro esses números no Instagram?</summary>
          <p>No app do Instagram, abra o perfil da Mentorei → <b>Painel profissional</b> → <b>Insights</b> e escolha <b>Últimos 7 dias</b>.</p>
          <ul><li><b>Seguidores:</b> o número total que aparece no perfil hoje.</li>
          <li><b>Contas alcançadas:</b> em Insights → Visão geral.</li>
          <li><b>Visitas ao perfil:</b> em Insights → Contas alcançadas → Atividade do perfil.</li></ul></details>
        <div class="grade-3">
          <label class="field"><span>Seguidores (total)</span><input type="number" name="seguidores" min="0" inputmode="numeric" required value="${atual.seguidores ?? ''}">
            ${anterior && anterior.seguidores ? `<small>Semana anterior: ${CAL.num(anterior.seguidores)}</small>` : ''}</label>
          <label class="field"><span>Contas alcançadas</span><input type="number" name="alcance" min="0" inputmode="numeric" required value="${atual.alcance ?? ''}">
            ${anterior && anterior.alcance ? `<small>Semana anterior: ${CAL.num(anterior.alcance)}</small>` : ''}</label>
          <label class="field"><span>Visitas ao perfil (opcional)</span><input type="number" name="visitas_perfil" min="0" inputmode="numeric" value="${atual.visitas_perfil ?? ''}"></label>
        </div>
        <fieldset class="field"><legend>Qual foi o melhor post da semana?</legend>
          ${postados.length ? `<div class="escolha-posts">${postados.map((p) => `
            <label class="escolha"><input type="radio" name="melhor_post_id" value="${p.id}"${atual.melhor_post_id === p.id ? ' checked' : ''}>
              ${miniatura(p)}<span><b>${D.curto(p.data)} · ${CAL.formatoDe(p)}</b><br>${esc(p.tema)}</span></label>`).join('')}</div>`
            : `<p class="vazio">${doFeed.length ? 'Nenhum post do feed dessa semana está marcado como postado. Abra o post no calendário, toque em “Marcar como postado” e volte aqui.' : 'O calendário não tem posts do feed nessa semana.'}</p>`}
        </fieldset>
        <label class="field"><span>Por que ele foi o melhor?</span>
          <textarea name="melhor_post_motivo" rows="3" placeholder="Ex.: muitos salvamentos; gente marcando amigas nos comentários; o gancho do começo prendeu">${esc(atual.melhor_post_motivo || '')}</textarea></label>
        <label class="field"><span>O que vamos repetir ou mudar? (opcional)</span>
          <textarea name="aprendizado" rows="2">${esc(atual.aprendizado || '')}</textarea></label>
        <button type="submit" class="btn">${atual.id ? 'Atualizar check-in' : 'Salvar check-in'}</button>
      </form>`;

    const form = $('#form-checkin', el);
    form.semana.addEventListener('change', () => { st.checkinSemana = form.semana.value; recarregar(); });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const n = (v) => (v === '' ? null : Number(v));
      const escolhido = form.querySelector('[name=melhor_post_id]:checked');
      try {
        await st.api.salvarCheckin({
          semana, seguidores: n(form.seguidores.value), alcance: n(form.alcance.value), visitas_perfil: n(form.visitas_perfil.value),
          melhor_post_id: escolhido ? escolhido.value : null, melhor_post_motivo: form.melhor_post_motivo.value.trim(),
          aprendizado: form.aprendizado.value.trim(), preenchido_por: st.eu.id,
        });
        aviso('Check-in salvo. Obrigada!');
        st.checkinSemana = null;
        irPara('evolucao');
      } catch (e) { falha(e); }
    });
  };

  TELAS.evolucao = async (el) => {
    const checkins = (await st.api.checkins()).filter((c) => c.seguidores != null || c.alcance != null);
    const recentes = checkins.slice(-12);
    const ini = recentes.length ? recentes[0].semana : D.somar(D.segunda(D.hoje()), -7 * 8);
    const posts = guardar(await st.api.posts(ini, D.somar(D.segunda(D.hoje()), -1)));

    if (!checkins.length) {
      el.innerHTML = `<div class="cabeca"><div><p class="sobre">Evolução</p><h1>Ainda sem números</h1>
        <p class="resumo">Os gráficos aparecem depois do primeiro check-in semanal.</p></div>
        ${pode.checkin() ? '<button type="button" class="btn small" data-aba-ir="checkin">Fazer check-in</button>' : ''}</div>`;
      return;
    }
    const ult = checkins[checkins.length - 1], pen = checkins[checkins.length - 2];
    const ganhos = recentes.map((c, i) => {
      const ant = i ? recentes[i - 1] : checkins[checkins.indexOf(c) - 1];
      return ant && c.seguidores != null && ant.seguidores != null ? c.seguidores - ant.seguidores : null;
    });
    const ganhosValidos = ganhos.filter((g) => g != null);
    const media4 = ganhosValidos.length ? Math.round(ganhosValidos.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, ganhosValidos.length)) : null;
    const variacao = (a, b) => (a != null && b ? Math.round(((a - b) / b) * 100) : null);
    const varAlcance = pen ? variacao(ult.alcance, pen.alcance) : null;
    const ganhoUlt = ganhos[ganhos.length - 1];
    const postadosNa = (s) => posts.filter((p) => p.status === 'postado' && p.data >= s && p.data <= D.somar(s, 6)).length;
    const sinal = (v, suf = '') => (v == null ? '' : `<span class="delta ${v >= 0 ? 'sobe' : 'desce'}">${v >= 0 ? '▲ +' : '▼ '}${CAL.num(v)}${suf}</span>`);

    const melhores = checkins.slice().reverse().filter((c) => c.melhor_post_id || c.melhor_post_motivo).slice(0, 8);
    const faltando = melhores.filter((c) => c.melhor_post_id && !st.posts[c.melhor_post_id]);
    if (faltando.length) {
      const lo = faltando[faltando.length - 1].semana, hi = D.somar(faltando[0].semana, 6);
      guardar(await st.api.posts(lo, hi));
    }

    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Evolução no Instagram</p><h1>Como estamos crescendo</h1>
      <p class="resumo">Números dos check-ins semanais. Último: semana de ${D.ddmm(ult.semana)}.</p></div></div>
      <div class="kpis">
        <div class="kpi"><span>Seguidores</span><strong>${CAL.num(ult.seguidores)}</strong>${sinal(ganhoUlt)}<small>na última semana</small></div>
        <div class="kpi"><span>Média de novos seguidores</span><strong>${media4 == null ? '—' : '+' + CAL.num(media4)}</strong><small>por semana (últimas 4)</small></div>
        <div class="kpi"><span>Contas alcançadas</span><strong>${CAL.num(ult.alcance)}</strong>${sinal(varAlcance, '%')}<small>vs. semana anterior</small></div>
        <div class="kpi"><span>Posts publicados</span><strong>${postadosNa(ult.semana)}</strong><small>na semana de ${D.ddmm(ult.semana)}</small></div>
      </div>
      <div class="graficos">
        <section class="cartao"><h2>Seguidores</h2><div id="g-seguidores"></div></section>
        <section class="cartao"><h2>Novos seguidores por semana</h2><div id="g-ganho"></div></section>
        <section class="cartao"><h2>Contas alcançadas por semana</h2><div id="g-alcance"></div></section>
        <section class="cartao"><h2>Posts publicados por semana</h2><div id="g-posts"></div></section>
      </div>
      <section class="cartao"><h2>Melhores posts de cada semana</h2>
        <div class="ranking">${melhores.map((c) => {
          const p = st.posts[c.melhor_post_id];
          return `<div class="rank-item">${p ? `<button type="button" class="rank-thumb" data-acao="abrir" data-id="${p.id}">${miniatura(p)}</button>` : ''}
            <div><p class="rank-semana">Semana de ${D.ddmm(c.semana)}${p ? ` · ${CAL.formatoDe(p)}` : ''}</p>
            <p class="rank-tema">${esc(p ? p.tema : 'Post não identificado')}</p>
            ${c.melhor_post_motivo ? `<p class="rank-motivo">${esc(c.melhor_post_motivo)}</p>` : ''}
            ${c.aprendizado ? `<p class="rank-motivo"><b>Aprendizado:</b> ${esc(c.aprendizado)}</p>` : ''}</div></div>`;
        }).join('') || '<p class="vazio">Ainda sem melhores posts registrados.</p>'}</div>
      </section>
      <details class="cartao tabela-dados"><summary>Ver todos os números em tabela</summary>
        <div class="rolagem"><table><thead><tr><th>Semana</th><th>Seguidores</th><th>Novos</th><th>Alcance</th><th>Visitas ao perfil</th></tr></thead>
        <tbody>${checkins.slice().reverse().map((c) => {
          const i = checkins.indexOf(c), ant = checkins[i - 1];
          const g = ant && c.seguidores != null && ant.seguidores != null ? c.seguidores - ant.seguidores : null;
          return `<tr><td>${D.ddmm(c.semana)}</td><td>${CAL.num(c.seguidores)}</td><td>${g == null ? '—' : (g >= 0 ? '+' : '') + CAL.num(g)}</td><td>${CAL.num(c.alcance)}</td><td>${CAL.num(c.visitas_perfil)}</td></tr>`;
        }).join('')}</tbody></table></div></details>`;

    const rot = (c) => D.ddmm(c.semana);
    const dica = (c) => `Semana de ${D.ddmm(c.semana)}`;
    CAL.graficos.linha($('#g-seguidores', el), recentes.filter((c) => c.seguidores != null)
      .map((c) => ({ rotulo: rot(c), dica: dica(c), valor: c.seguidores, texto: `${CAL.num(c.seguidores)} seguidores` })), 'Seguidores por semana');
    CAL.graficos.barras($('#g-ganho', el), recentes.map((c, i) => ({ c, g: ganhos[i] })).filter((x) => x.g != null)
      .map(({ c, g }) => ({ rotulo: rot(c), dica: dica(c), valor: Math.max(0, g), texto: `${g >= 0 ? '+' : ''}${CAL.num(g)} seguidores` })), 'Novos seguidores por semana');
    CAL.graficos.barras($('#g-alcance', el), recentes.filter((c) => c.alcance != null)
      .map((c) => ({ rotulo: rot(c), dica: dica(c), valor: c.alcance, texto: `${CAL.num(c.alcance)} contas alcançadas` })), 'Contas alcançadas por semana');
    CAL.graficos.barras($('#g-posts', el), recentes
      .map((c) => ({ rotulo: rot(c), dica: dica(c), valor: postadosNa(c.semana), texto: `${postadosNa(c.semana)} posts publicados` })), 'Posts publicados por semana');
  };

  // ---------------------------------------------------------------- LinkedIn (página da Mentorei)
  const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  function itensLinkedin(data, posts) {
    const doDia = posts.filter((p) => p.data === data);
    const ocupados = new Set(doDia.map((p) => D.hora(p.hora)));
    const futuro = (h) => data > D.hoje() || (data === D.hoje() && h >= D.horaAgora());
    const livres = ((cfg.horariosLinkedin || {})[D.parse(data).getDay()] || []).filter((h) => !ocupados.has(h) && futuro(h));
    return doDia.map((p) => ({ k: p.hora ? D.hora(p.hora) : '99', html: cartao(p) }))
      .concat(livres.map((h) => ({ k: h, html: pode.criar()
        ? `<button type="button" class="post livre" data-acao="novo-li" data-data="${data}" data-hora="${h}"><span class="livre-hora">${h}</span><span>Horário sugerido <em>+ criar post</em></span></button>`
        : `<div class="post livre"><span class="livre-hora">${h}</span><span>Horário sugerido</span></div>` })))
      .sort((a, b) => a.k.localeCompare(b.k)).map((i) => i.html).join('');
  }

  const segmentosLi = () => `<div class="segmentos" role="tablist">
      <button type="button" data-acao="li-modo" data-modo="posts" aria-pressed="${st.liModo === 'posts'}">📅 Publicações</button>
      <button type="button" data-acao="li-modo" data-modo="relatorio" aria-pressed="${st.liModo === 'relatorio'}">📊 Relatório</button></div>`;

  TELAS.linkedin = async (el) => {
    if (st.liModo === 'relatorio') return relatorioLinkedin(el);
    const ini = D.segunda(st.liRef || D.hoje()), fim = D.somar(ini, 27);
    const [posts, caixa] = await Promise.all([st.api.postsLinkedin(ini, fim), st.api.caixaLinkedin()]);
    guardar(posts); guardar(caixa);
    const semanas = [0, 7, 14, 21].map((n) => D.somar(ini, n));
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">LinkedIn · página da Mentorei</p><h1>Publicações</h1>
        <p class="resumo">${posts.length} ${posts.length === 1 ? 'post' : 'posts'} de ${D.ddmm(ini)} a ${D.ddmm(fim)}. Horários sugeridos: terça, quarta e quinta às 8h30.</p></div>
        <div class="nav-periodo">
          <button type="button" class="btn small ghost" data-acao="li-mover" data-dias="-28" aria-label="Semanas anteriores">‹</button>
          <button type="button" class="btn small ghost" data-acao="li-mover" data-dias="0">Hoje</button>
          <button type="button" class="btn small ghost" data-acao="li-mover" data-dias="28" aria-label="Próximas semanas">›</button>
          ${pode.criar() ? '<button type="button" class="btn small" data-acao="novo-li">+ Novo post</button>' : ''}
        </div></div>
      ${segmentosLi()}
      ${caixa.length ? `<section class="cartao li-caixa"><h2>Sem dia marcado (${caixa.length})</h2><div class="lista">${caixa.map((p) => cartao(p)).join('')}</div></section>` : ''}
      ${semanas.map((s) => {
        const dias = Array.from({ length: 7 }, (_, i) => D.somar(s, i)).map((d) => ({ d, html: itensLinkedin(d, posts) })).filter((x) => x.html);
        return `<section class="li-semana"><h2 class="sub">Semana de ${D.ddmm(s)} a ${D.ddmm(D.somar(s, 6))}</h2>
          ${dias.map((x) => `<div class="li-dia${x.d === D.hoje() ? ' hoje' : ''}"><p class="li-dia-nome">${DIAS_SEMANA[D.parse(x.d).getDay()]}, ${D.ddmm(x.d)}</p><div class="lista-dia">${x.html}</div></div>`).join('')
            || '<p class="vazio">Nada nesta semana.</p>'}</section>`;
      }).join('')}`;
  };

  async function relatorioLinkedin(el) {
    const estaSemana = D.segunda(D.hoje());
    const [checkins, todos] = await Promise.all([st.api.checkinsLinkedin(), st.api.postsLinkedin(D.somar(estaSemana, -42), D.somar(estaSemana, 6))]);
    const { semana, opcoes, nota: avisoSemana } = semanasDoCheckin(todos, checkins, st.liSemana);
    const postsSemana = guardar(todos.filter((p) => D.segunda(p.data) === semana));
    const atual = checkins.find((c) => c.semana === semana) || {};
    const anterior = checkins.filter((c) => c.semana < semana).pop();
    const postados = postsSemana.filter((p) => p.status === 'postado');
    const eng = (c) => (c && c.impressoes ? ((Number(c.reacoes) || 0) + (Number(c.comentarios) || 0) + (Number(c.compartilhamentos) || 0)) / c.impressoes * 100 : null);
    const pct = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%');
    const validos = checkins.filter((c) => c.seguidores != null || c.impressoes != null);
    const ult = validos[validos.length - 1], pen = validos[validos.length - 2];
    const campo = (nome, rotulo) => `<label class="field"><span>${rotulo}</span><input type="number" name="${nome}" min="0" inputmode="numeric" value="${atual[nome] ?? ''}">
      ${anterior && anterior[nome] != null ? `<small>Semana anterior: ${CAL.num(anterior[nome])}</small>` : ''}</label>`;
    const sinal = (v, suf = '') => (v == null ? '' : `<span class="delta ${v >= 0 ? 'sobe' : 'desce'}">${v >= 0 ? '▲ +' : '▼ '}${CAL.num(Math.round(v * 10) / 10)}${suf}</span>`);

    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">LinkedIn · página da Mentorei</p><h1>Relatório</h1>
        <p class="resumo">Toda segunda, preencha os números da semana anterior. Os gráficos se atualizam sozinhos.</p></div></div>
      ${segmentosLi()}
      ${ult ? `<div class="kpis">
        <div class="kpi"><span>Seguidores</span><strong>${CAL.num(ult.seguidores)}</strong>${pen && ult.seguidores != null && pen.seguidores != null ? sinal(ult.seguidores - pen.seguidores) : ''}<small>na semana de ${D.ddmm(ult.semana)}</small></div>
        <div class="kpi"><span>Impressões</span><strong>${CAL.num(ult.impressoes)}</strong>${pen && pen.impressoes ? sinal((ult.impressoes - pen.impressoes) / pen.impressoes * 100, '%') : ''}<small>vs. semana anterior</small></div>
        <div class="kpi"><span>Engajamento</span><strong>${pct(eng(ult))}</strong><small>reações + comentários + compartilhamentos ÷ impressões</small></div>
        <div class="kpi"><span>Visitas à página</span><strong>${CAL.num(ult.visitas_pagina)}</strong><small>na semana de ${D.ddmm(ult.semana)}</small></div>
      </div>
      <div class="graficos">
        <section class="cartao"><h2>Seguidores da página</h2><div id="gli-seguidores"></div></section>
        <section class="cartao"><h2>Impressões por semana</h2><div id="gli-impressoes"></div></section>
        <section class="cartao"><h2>Engajamento por semana (%)</h2><div id="gli-engajamento"></div></section>
        <section class="cartao"><h2>Visitas à página por semana</h2><div id="gli-visitas"></div></section>
      </div>` : '<p class="vazio">Os gráficos aparecem depois do primeiro check-in.</p>'}
      ${pode.checkin() ? `<form id="form-checkin-li" class="cartao-form">
        <h2>Check-in da semana</h2>
        <label class="field"><span>Semana</span>
          <select name="semana">${opcoes}</select>${avisoSemana}</label>
        <details class="ajuda"><summary>Onde encontro esses números no LinkedIn?</summary>
          <p>No computador, abra a <b>página da Mentorei</b> no LinkedIn (como administradora) → <b>Análises</b> (Analytics) e escolha <b>últimos 7 dias</b>.</p>
          <ul><li><b>Seguidores:</b> Análises → Seguidores (o total).</li>
          <li><b>Impressões, reações, comentários e compartilhamentos:</b> Análises → Conteúdo.</li>
          <li><b>Visitas à página:</b> Análises → Visitantes.</li></ul></details>
        <div class="grade-3">${campo('seguidores', 'Seguidores (total)')}${campo('impressoes', 'Impressões')}${campo('visitas_pagina', 'Visitas à página')}</div>
        <div class="grade-3">${campo('reacoes', 'Reações')}${campo('comentarios', 'Comentários')}${campo('compartilhamentos', 'Compartilhamentos')}</div>
        <fieldset class="field"><legend>Qual foi o melhor post da semana?</legend>
          ${postados.length ? `<div class="escolha-posts">${postados.map((p) => `
            <label class="escolha"><input type="radio" name="melhor_post_id" value="${p.id}"${atual.melhor_post_id === p.id ? ' checked' : ''}>
              ${miniatura(p)}<span><b>${D.curto(p.data)} · ${CAL.formatoDe(p)}</b><br>${esc(p.tema)}</span></label>`).join('')}</div>`
            : '<p class="vazio">Nenhum post do LinkedIn marcado como postado nessa semana.</p>'}</fieldset>
        <label class="field"><span>Por que ele foi o melhor?</span><textarea name="melhor_post_motivo" rows="3">${esc(atual.melhor_post_motivo || '')}</textarea></label>
        <label class="field"><span>O que vamos repetir ou mudar? (opcional)</span><textarea name="aprendizado" rows="2">${esc(atual.aprendizado || '')}</textarea></label>
        <button type="submit" class="btn">${atual.id ? 'Atualizar check-in' : 'Salvar check-in'}</button>
      </form>` : ''}
      ${validos.length ? `<details class="cartao tabela-dados"><summary>Ver todos os números em tabela</summary>
        <div class="rolagem"><table><thead><tr><th>Semana</th><th>Seguidores</th><th>Impressões</th><th>Reações</th><th>Coment.</th><th>Compart.</th><th>Engaj.</th><th>Visitas</th></tr></thead>
        <tbody>${validos.slice().reverse().map((c) => `<tr><td>${D.ddmm(c.semana)}</td><td>${CAL.num(c.seguidores)}</td><td>${CAL.num(c.impressoes)}</td><td>${CAL.num(c.reacoes)}</td><td>${CAL.num(c.comentarios)}</td><td>${CAL.num(c.compartilhamentos)}</td><td>${pct(eng(c))}</td><td>${CAL.num(c.visitas_pagina)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}`;

    if (ult) {
      const recentes = validos.slice(-12), dica = (c) => `Semana de ${D.ddmm(c.semana)}`;
      CAL.graficos.linha($('#gli-seguidores', el), recentes.filter((c) => c.seguidores != null).map((c) => ({ rotulo: D.ddmm(c.semana), dica: dica(c), valor: c.seguidores, texto: `${CAL.num(c.seguidores)} seguidores` })), 'Seguidores da página no LinkedIn');
      CAL.graficos.barras($('#gli-impressoes', el), recentes.filter((c) => c.impressoes != null).map((c) => ({ rotulo: D.ddmm(c.semana), dica: dica(c), valor: c.impressoes, texto: `${CAL.num(c.impressoes)} impressões` })), 'Impressões por semana no LinkedIn');
      CAL.graficos.barras($('#gli-engajamento', el), recentes.filter((c) => eng(c) != null).map((c) => ({ rotulo: D.ddmm(c.semana), dica: dica(c), valor: Math.round(eng(c) * 10) / 10, texto: `${pct(eng(c))} de engajamento` })), 'Engajamento por semana no LinkedIn');
      CAL.graficos.barras($('#gli-visitas', el), recentes.filter((c) => c.visitas_pagina != null).map((c) => ({ rotulo: D.ddmm(c.semana), dica: dica(c), valor: c.visitas_pagina, texto: `${CAL.num(c.visitas_pagina)} visitas` })), 'Visitas à página por semana no LinkedIn');
    }
    const form = $('#form-checkin-li', el);
    if (!form) return;
    form.semana.addEventListener('change', () => { st.liSemana = form.semana.value; recarregar(); });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const n = (v) => (v === '' ? null : Number(v));
      const escolhido = form.querySelector('[name=melhor_post_id]:checked');
      try {
        await st.api.salvarCheckinLinkedin({
          semana, seguidores: n(form.seguidores.value), impressoes: n(form.impressoes.value), visitas_pagina: n(form.visitas_pagina.value),
          reacoes: n(form.reacoes.value), comentarios: n(form.comentarios.value), compartilhamentos: n(form.compartilhamentos.value),
          melhor_post_id: escolhido ? escolhido.value : null, melhor_post_motivo: form.melhor_post_motivo.value.trim(),
          aprendizado: form.aprendizado.value.trim(), preenchido_por: st.eu.id,
        });
        aviso('Check-in do LinkedIn salvo. Obrigada!');
        st.liSemana = null; recarregar();
      } catch (e) { falha(e); }
    });
  }

  // copia um post do Instagram (texto e artes) para o calendário do LinkedIn, sem dia marcado
  async function levarParaLinkedin(p) {
    const formatos = { reels: 'video', carrossel: 'carrossel', estatico: 'estatico', stories: 'estatico' };
    const novo = await st.api.salvarPost({
      rede: 'linkedin', data: null, hora: null, formato: (p.midias || []).length ? formatos[p.formato] || 'estatico' : 'texto',
      tema: p.tema, legenda: p.legenda, hashtags: p.hashtags,
      observacoes: `Veio do Instagram (post ${p.data ? 'de ' + D.ddmm(p.data) : 'sem data'}). Adapte o texto para o LinkedIn e escolha o dia.`,
      status: 'producao', origem: st.eu.papel === 'socia' ? 'socia' : 'manual', autor_id: st.eu.id,
    });
    novo.midias = [];
    for (let i = 0; i < (p.midias || []).length; i++) {
      const m = p.midias[i];
      novo.midias.push(await st.api.copiarParaPost(novo.id, { caminho: m.caminho, nome: m.nome, tipo: m.tipo, tamanho: m.tamanho }, i));
    }
    guardar([novo]);
    aviso('Copiado para o LinkedIn. Agora escolha o dia e ajuste o texto.');
    abrirEditor(novo);
  }

  // ---------------------------------------------------------------- Mala direta (e-mails para clientes, disparados pelo RD Station)
  const dadosEmail = (p) => p.email || {};
  const resultadosDe = (p) => dadosEmail(p).resultados || {};
  const temResultados = (p) => Number(resultadosDe(p).entregues) > 0;
  const taxa = (parte, total) => (Number(total) ? (Number(parte) || 0) / Number(total) * 100 : null);
  const pct = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%');
  const abertura = (p) => taxa(resultadosDe(p).aberturas, resultadosDe(p).entregues);
  const cliques = (p) => taxa(resultadosDe(p).cliques, resultadosDe(p).entregues);
  const LARGURA_EMAIL = 600;

  const segmentosEm = () => `<div class="segmentos" role="tablist">
      <button type="button" data-acao="em-modo" data-modo="envios" aria-pressed="${st.emModo === 'envios'}">📅 Envios</button>
      <button type="button" data-acao="em-modo" data-modo="resultados" aria-pressed="${st.emModo === 'resultados'}">📊 Resultados</button></div>`;

  const ajudaArteEmail = `<details class="ajuda"><summary>Como preparar a arte para o RD Station</summary>
      <ul>
        <li><b>Largura de ${LARGURA_EMAIL} px.</b> É a largura padrão de e-mail. Arte mais estreita que isso pode ficar borrada.</li>
        <li><b>Arte comprida? Divida em partes</b> (topo, meio, botão…) e envie todas aqui com os nomes numerados (01, 02, 03). No RD Station, cada parte entra como uma imagem, uma embaixo da outra, e cada uma pode ter o seu link.</li>
        <li><b>Leve:</b> de preferência menos de 1 MB por imagem (JPG costuma ficar menor que PNG). Arte pesada demora a abrir no celular.</li>
        <li><b>Assunto e pré-cabeçalho são texto, não vão na arte.</b> São o que a pessoa lê antes de abrir. Preencha aqui para quem monta o e-mail só copiar e colar.</li>
        <li><b>Texto alternativo:</b> alguns programas de e-mail escondem as imagens até a pessoa liberar. Esse texto aparece no lugar da arte, então precisa contar a mensagem.</li>
        <li>Já tem o e-mail pronto em <b>HTML</b>? Envie o arquivo .html: aqui dá para ver como fica e copiar o código para colar no editor de HTML do RD Station.</li>
      </ul></details>`;

  TELAS.mala = async (el) => {
    if (st.emModo === 'resultados') return resultadosEmail(el);
    const ini = D.primeiroDoMes(st.emRef || D.hoje()), fim = ultimoDiaDoMes(ini);
    const [lista, semDia] = await Promise.all([st.api.postsEmail(ini, fim), st.api.caixaEmail()]);
    guardar(lista); guardar(semDia);
    const dias = [...new Set(lista.map((p) => p.data))];
    const enviados = lista.filter((p) => p.status === 'postado').length;
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Mala direta · e-mails para clientes (RD Station)</p><h1 class="cap">${D.mesAno(ini)}</h1>
        <p class="resumo">${lista.length ? `${lista.length} ${lista.length === 1 ? 'e-mail' : 'e-mails'} no mês · ${enviados} ${enviados === 1 ? 'enviado' : 'enviados'}` : 'Nenhum e-mail marcado neste mês.'}</p></div>
        <div class="nav-periodo">
          <button type="button" class="btn small ghost" data-acao="em-mover" data-meses="-1" aria-label="Mês anterior">‹</button>
          ${ini === D.primeiroDoMes(D.hoje()) ? '' : '<button type="button" class="btn small ghost" data-acao="em-mover" data-meses="0">Este mês</button>'}
          <button type="button" class="btn small ghost" data-acao="em-mover" data-meses="1" aria-label="Próximo mês">›</button>
          ${pode.criar() ? '<button type="button" class="btn small" data-acao="novo-email">+ Nova mala direta</button>' : ''}
        </div></div>
      ${segmentosEm()}
      ${ajudaArteEmail}
      ${semDia.length ? `<section class="cartao li-caixa"><h2>Sem dia marcado (${semDia.length})</h2><div class="lista">${semDia.map((p) => cartao(p)).join('')}</div></section>` : ''}
      ${dias.map((d) => `<div class="li-dia${d === D.hoje() ? ' hoje' : ''}"><p class="li-dia-nome">${DIAS_SEMANA[D.parse(d).getDay()]}, ${D.ddmm(d)}</p>
        <div class="lista-dia">${lista.filter((p) => p.data === d).map((p) => cartao(p)).join('')}</div></div>`).join('')
        || `<p class="vazio">Nada neste mês.${pode.criar() ? ' Use “+ Nova mala direta” para guardar a arte e o assunto do próximo e-mail.' : ''}</p>`}`;
  };

  async function resultadosEmail(el) {
    const lista = guardar(await st.api.postsEmail(D.somar(D.hoje(), -365), D.hoje()));
    const enviados = lista.filter((p) => p.status === 'postado');
    const comNumeros = enviados.filter(temResultados), pendentes = enviados.filter((p) => !temResultados(p));
    const soma = (k) => comNumeros.reduce((s, p) => s + (Number(resultadosDe(p)[k]) || 0), 0);
    const entregues = soma('entregues');
    const melhores = comNumeros.slice().sort((a, b) => abertura(b) - abertura(a)).slice(0, 5);
    const assunto = (p) => dadosEmail(p).assunto || p.tema;
    const curto = (t) => (t.length > 42 ? t.slice(0, 40) + '…' : t);

    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Mala direta · e-mails para clientes (RD Station)</p><h1>Resultados</h1>
        <p class="resumo">Dois ou três dias depois de cada envio, abra o e-mail aqui e anote os números do relatório do RD Station. Mostra os últimos 12 meses.</p></div></div>
      ${segmentosEm()}
      ${pendentes.length ? `<section class="cartao li-caixa"><h2>Faltam os números (${pendentes.length})</h2>
        <p class="resumo">Abra cada e-mail e preencha “Resultados do RD Station”.</p>
        <div class="lista">${pendentes.map((p) => cartao(p, { mostrarData: true })).join('')}</div></section>` : ''}
      ${comNumeros.length ? `<div class="kpis">
        <div class="kpi"><span>E-mails enviados</span><strong>${enviados.length}</strong><small>${CAL.num(entregues)} entregas com números anotados</small></div>
        <div class="kpi"><span>Abertura média</span><strong>${pct(taxa(soma('aberturas'), entregues))}</strong><small>de quem recebeu, quantos abriram</small></div>
        <div class="kpi"><span>Cliques</span><strong>${pct(taxa(soma('cliques'), entregues))}</strong><small>de quem recebeu, quantos clicaram</small></div>
        <div class="kpi"><span>Descadastros</span><strong>${CAL.num(soma('descadastros'))}</strong><small>pediram para sair da lista</small></div>
      </div>
      <div class="graficos">
        <section class="cartao"><h2>Abertura por e-mail (%)</h2><div id="gem-abertura"></div></section>
        <section class="cartao"><h2>Cliques por e-mail (%)</h2><div id="gem-cliques"></div></section>
      </div>
      <section class="cartao"><h2>Assuntos que mais abriram</h2>
        <div class="ranking">${melhores.map((p) => `<div class="rank-item"><button type="button" class="rank-thumb" data-acao="abrir" data-id="${p.id}">${miniatura(p)}</button>
          <div><p class="rank-semana">${D.curto(p.data)} · ${pct(abertura(p))} abriram · ${pct(cliques(p))} clicaram</p>
          <p class="rank-tema">“${esc(assunto(p))}”</p>
          ${dadosEmail(p).publico ? `<p class="rank-motivo">Para: ${esc(dadosEmail(p).publico)}</p>` : ''}</div></div>`).join('')}</div></section>
      <details class="cartao tabela-dados"><summary>Ver todos os números em tabela</summary>
        <div class="rolagem"><table><thead><tr><th>Dia</th><th class="col-assunto">Assunto</th><th>Entregues</th><th>Aberturas</th><th>Abertura</th><th>Cliques</th><th>Cliques %</th><th>Descad.</th></tr></thead>
        <tbody>${comNumeros.slice().reverse().map((p) => {
          const r = resultadosDe(p);
          return `<tr><td>${D.ddmm(p.data)}</td><td class="col-assunto">${esc(assunto(p))}</td><td>${CAL.num(r.entregues)}</td><td>${CAL.num(r.aberturas)}</td><td>${pct(abertura(p))}</td><td>${CAL.num(r.cliques)}</td><td>${pct(cliques(p))}</td><td>${CAL.num(r.descadastros)}</td></tr>`;
        }).join('')}</tbody></table></div></details>`
      : '<p class="vazio">Os gráficos aparecem quando o primeiro e-mail enviado tiver os números anotados.</p>'}`;

    if (!comNumeros.length) return;
    const recentes = comNumeros.slice(-12);
    const ponto = (p, v, txt) => ({ rotulo: D.ddmm(p.data), dica: curto(assunto(p)), valor: Math.round(v * 10) / 10, texto: txt });
    CAL.graficos.barras($('#gem-abertura', el), recentes.map((p) => ponto(p, abertura(p), `${pct(abertura(p))} abriram`)), 'Abertura por e-mail da mala direta');
    CAL.graficos.barras($('#gem-cliques', el), recentes.map((p) => ponto(p, cliques(p), `${pct(cliques(p))} clicaram`)), 'Cliques por e-mail da mala direta');
  }

  // janela de um e-mail: como chega na caixa de entrada, campos para copiar no RD Station, a arte inteira e os resultados
  function htmlEmail(p, podeCompartilhar) {
    const e = dadosEmail(p), r = resultadosDe(p);
    const linha = (rotulo, campo, falta) => `<div class="campo-anuncio"><span>${rotulo}</span>
      <div>${e[campo] ? esc(e[campo]) : `<span class="vazio">${falta || '—'}</span>`}</div>
      ${e[campo] ? `<button type="button" class="linkbtn" data-copiar-email="${campo}">Copiar</button>` : ''}</div>`;
    const imagens = p.midias.map((m, i) => ({ m, i })).filter((x) => x.m.tipo.startsWith('image/'));
    const salvarCel = podeCompartilhar && imagens.length;
    const num = (v) => (v == null || v === '' ? '' : v);
    return `
      <section class="bloco">
        <h3>Na caixa de entrada</h3>
        <div class="email-inbox"><span class="email-de">Mentorei</span>
          <span class="email-linha">${e.assunto ? `<b>${esc(e.assunto)}</b>` : '<span class="vazio">Sem assunto</span>'}${e.preheader ? ` <span class="email-pre">— ${esc(e.preheader)}</span>` : ''}</span></div>
      </section>
      <section class="bloco campos-anuncio">
        ${linha('Assunto', 'assunto', 'Falta o assunto')}${linha('Pré-cabeçalho', 'preheader')}
        ${linha('Para quem', 'publico', 'Lista ou segmentação no RD Station')}${linha('Link da arte', 'link')}${linha('Texto alternativo', 'alt')}
      </section>
      ${p.midias.length ? `<section class="bloco">
        <div class="bloco-topo"><h3>${imagens.length > 1 ? `Arte em ${imagens.length} partes, na ordem` : 'Arte do e-mail'}</h3>
          <div class="acoes">
            ${salvarCel ? '<button type="button" class="btn small" data-acao="celular">Salvar no celular</button>' : ''}
            <button type="button" class="btn small${salvarCel ? ' ghost' : ''}" data-acao="baixar-tudo">Baixar ${p.midias.length > 1 ? 'tudo' : ''}</button>
          </div></div>
        ${imagens.length ? `<div class="email-janela"><div class="email-corpo">${imagens.map(({ m, i }) => `<img src="${esc(st.links[m.caminho] || '')}" alt="${esc(e.alt || 'Arte do e-mail')}" data-medir="${i}">`).join('')}</div></div>` : ''}
        <ul class="arquivos email-pecas">${p.midias.map((m, i) => `<li><span>${p.midias.length > 1 ? `${i + 1}. ` : ''}${esc(m.nome)}
            <small data-medida="${i}">${m.tamanho ? CAL.tamanho(m.tamanho) : ''}</small></span>
          <span class="acoes">${/^HTML?$/.test(extensao(m)) ? `<button type="button" class="linkbtn" data-acao="html-ver" data-i="${i}">Ver como fica</button>
            <button type="button" class="linkbtn" data-acao="html-copiar" data-i="${i}">Copiar código</button>` : ''}
            <button type="button" class="linkbtn" data-acao="baixar" data-i="${i}">Baixar</button></span></li>`).join('')}</ul>
        <div id="html-previa"></div>
      </section>` : '<p class="vazio">Este e-mail ainda não tem arte.</p>'}
      ${p.legenda ? `<section class="bloco">
        <div class="bloco-topo"><h3>Texto do e-mail</h3><button type="button" class="btn small ghost" data-copiar="legenda">Copiar texto</button></div>
        <div class="texto-post">${esc(p.legenda)}</div></section>` : ''}
      ${p.observacoes ? `<section class="bloco recado"><h3>Recado</h3><p>${esc(p.observacoes)}</p></section>` : ''}
      ${p.status === 'postado' ? `<section class="bloco">
        <h3>Resultados do RD Station</h3>
        ${temResultados(p) ? `<p class="resumo"><b>${pct(abertura(p))}</b> abriram · <b>${pct(cliques(p))}</b> clicaram · ${CAL.num(r.descadastros || 0)} ${Number(r.descadastros) === 1 ? 'descadastro' : 'descadastros'}</p>`
          : '<p class="vazio">Dois ou três dias depois do envio, copie aqui os números do relatório deste e-mail no RD Station.</p>'}
        ${pode.criar() ? `<form id="form-resultado-email" class="form-resultado quatro">
          <label class="field"><span>Entregues</span><input type="number" name="entregues" min="0" inputmode="numeric" required value="${num(r.entregues)}"></label>
          <label class="field"><span>Aberturas</span><input type="number" name="aberturas" min="0" inputmode="numeric" value="${num(r.aberturas)}"></label>
          <label class="field"><span>Cliques</span><input type="number" name="cliques" min="0" inputmode="numeric" value="${num(r.cliques)}"></label>
          <label class="field"><span>Descadastros</span><input type="number" name="descadastros" min="0" inputmode="numeric" value="${num(r.descadastros)}"></label>
          <button type="submit" class="btn small">${temResultados(p) ? 'Atualizar' : 'Salvar'}</button></form>` : ''}
      </section>` : ''}
      <footer class="modal-rodape">
        ${p.status === 'postado' ? `<p class="postado-info">✓ Enviado${p.postado_em ? ' · marcado em ' + new Date(p.postado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
          ${p.postado_por ? ' por ' + esc(st.nomes[p.postado_por] || '') : ''}</p>` : ''}
        <div class="acoes">
          ${pode.postar() && p.status !== 'postado' ? '<button type="button" class="btn" data-acao="postado">Marcar como enviado</button>' : ''}
          ${pode.postar() && p.status === 'postado' ? '<button type="button" class="btn small ghost" data-acao="desfazer">Desfazer “enviado”</button>' : ''}
          ${pode.editar(p) ? '<button type="button" class="btn small ghost" data-acao="editar">Editar</button>' : ''}
          ${pode.excluir(p) ? '<button type="button" class="btn small danger" data-acao="excluir">Excluir</button>' : ''}
        </div>
      </footer>`;
  }

  // mostra largura × altura de cada parte da arte e avisa se estiver estreita ou pesada para e-mail
  const avisosArte = (largura, bytes) => [
    largura && largura < LARGURA_EMAIL ? `⚠ estreita (menos de ${LARGURA_EMAIL} px)` : '',
    bytes > 1048576 ? '⚠ pesada (mais de 1 MB)' : '',
  ].filter(Boolean);
  function medirArtes(p) {
    document.querySelectorAll('.email-corpo img[data-medir]').forEach((img) => {
      const anotar = () => {
        const m = p.midias[+img.dataset.medir], alvo = $(`[data-medida="${img.dataset.medir}"]`);
        if (!alvo || !img.naturalWidth) return;
        const avisos = avisosArte(img.naturalWidth, m.tamanho);
        alvo.textContent = [m.tamanho ? CAL.tamanho(m.tamanho) : '', `${img.naturalWidth} × ${img.naturalHeight} px`].concat(avisos).filter(Boolean).join(' · ');
        alvo.classList.toggle('aviso-peca', avisos.length > 0);
      };
      if (img.complete) anotar(); else img.addEventListener('load', anotar, { once: true });
    });
  }

  function ligarFormResultadoEmail(p) {
    const form = $('#form-resultado-email');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const n = (v) => (v === '' ? null : Number(v));
      const resultados = { entregues: n(form.entregues.value), aberturas: n(form.aberturas.value), cliques: n(form.cliques.value), descadastros: n(form.descadastros.value) };
      try {
        st.posts[p.id] = await st.api.salvarPost({ id: p.id, email: { ...dadosEmail(p), resultados } });
        aviso('Resultados guardados.');
        await abrirPost(p.id);
        if (st.aba === 'mala' || st.aba === 'hoje') { const el = $('#conteudo'); await TELAS[st.aba](el); carregarMiniaturas(el); }
      } catch (e) { falha(e); }
    });
  }

  // arquivo .html do e-mail: lido como texto para a prévia e para copiar o código
  async function textoDoArquivo(m) {
    const r = await fetch(st.links[m.caminho] || await st.api.linkArquivo(m));
    if (!r.ok) throw new Error('Não consegui abrir o arquivo. Tente de novo.');
    return r.text();
  }

  // ---------------------------------------------------------------- arquivos (pastas da equipe)
  const slugPasta = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const nomePasta = (slug) => { const t = slug.replace(/-/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };

  // fotos grandes do celular ficam com no máximo 2560 px (economiza espaço e o envio fica bem mais rápido)
  async function reduzirFoto(arquivo) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(arquivo.type) || arquivo.size < 1.2e6) return arquivo;
    try {
      const bmp = await createImageBitmap(arquivo);
      const esc = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      if (!blob || blob.size >= arquivo.size) return arquivo;
      return new File([blob], arquivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return arquivo; }
  }

  // arquivos que chegam pelo "Compartilhar" do celular (o sw.js guarda no aparelho; aqui a gente envia)
  const compartilhados = {
    abrir: () => new Promise((ok, erro) => {
      const r = indexedDB.open('calendario-mentorei', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('compartilhados', { autoIncrement: true });
      r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
    }),
    async listar() {
      if (!window.indexedDB) return [];
      const db = await this.abrir();
      return new Promise((ok) => {
        const itens = [];
        db.transaction('compartilhados').objectStore('compartilhados').openCursor().onsuccess = (e) => {
          const c = e.target.result; if (c) { itens.push({ chave: c.key, arquivo: c.value }); c.continue(); } else ok(itens);
        };
      });
    },
    async apagar(chaves) {
      const db = await this.abrir();
      await new Promise((ok) => { const tx = db.transaction('compartilhados', 'readwrite'); chaves.forEach((k) => tx.objectStore('compartilhados').delete(k)); tx.oncomplete = ok; });
    },
  };

  async function enviarLista(pasta, arquivos, listaEl, reduzir) {
    for (let i = 0; i < arquivos.length; i++) {
      const li = listaEl && listaEl.children[i];
      const barra = li && li.querySelector('progress');
      if (barra) barra.hidden = false;
      const f = reduzir ? await reduzirFoto(arquivos[i]) : arquivos[i];
      if (f.size > cfg.limiteArquivoMB * 1048576) { if (li) li.classList.add('erro'); throw new Error(`"${f.name}" passa de ${cfg.limiteArquivoMB} MB.`); }
      await st.api.enviarParaPasta(pasta, f, (x) => { if (barra) barra.value = x; });
    }
  }
  const itemEnvio = (f) => `<li><span>${esc(f.name)}</span><small>${CAL.tamanho(f.size)}</small><progress max="1" value="0" hidden></progress></li>`;

  TELAS.arquivos = async (el) => {
    const recebidos = await compartilhados.listar().catch(() => []);
    let pastas = await st.api.pastasArquivos();
    if (!pastas.length) { await st.api.criarPasta('fotos-do-dia-a-dia'); pastas = ['fotos-do-dia-a-dia']; }
    if (st.pasta && !pastas.includes(st.pasta)) st.pasta = null;
    const aviso_ = recebidos.length ? `
      <div class="alerta recebidos">
        <strong>📲 ${recebidos.length} ${recebidos.length === 1 ? 'arquivo chegou' : 'arquivos chegaram'} pelo “Compartilhar” do celular</strong>
        <span>Escolha a pasta e toque em Enviar.</span>
        <div class="acoes"><select id="pasta-recebidos">${pastas.map((p) => `<option value="${p}"${p === st.pasta ? ' selected' : ''}>${esc(nomePasta(p))}</option>`).join('')}</select>
          <button type="button" class="btn small" data-acao="enviar-recebidos">Enviar</button>
          <button type="button" class="btn small ghost" data-acao="descartar-recebidos">Descartar</button></div>
        <ul class="arquivos" id="lista-recebidos">${recebidos.map((r) => itemEnvio(r.arquivo)).join('')}</ul>
      </div>` : '';

    if (!st.pasta) {
      el.innerHTML = `
        <div class="cabeca"><div><p class="sobre">Arquivos</p><h1>Pastas da equipe</h1>
        <p class="resumo">Fotos e vídeos do dia a dia. Qualquer pessoa da equipe pode enviar direto do celular, e daqui eles viram post.</p></div>
        <button type="button" class="btn small ghost" data-acao="nova-pasta">+ Nova pasta</button></div>
        ${aviso_}
        <div class="pastas">${pastas.map((p) => `<button type="button" class="pasta" data-pasta="${p}"><span class="pasta-icone">📁</span><span>${esc(nomePasta(p))}</span></button>`).join('')}</div>
        <details class="ajuda"><summary>Como mandar fotos direto do celular</summary>
          <p><b>Android:</b> abra o calendário no Chrome, toque nos 3 pontinhos ⋮ e em <b>“Instalar app”</b> (ou “Adicionar à tela inicial”). Pronto: na galeria, escolha as fotos, toque em <b>Compartilhar</b> e depois em <b>“Calendário”</b>. Elas aparecem aqui para escolher a pasta.</p>
          <p><b>iPhone:</b> no Safari, toque em Compartilhar ⬆ e em <b>“Adicionar à Tela de Início”</b>. Para mandar fotos: abra o calendário pelo ícone, entre na pasta e toque em <b>“Enviar fotos e vídeos”</b> → <b>Fototeca</b>. (O iPhone não deixa aparecer no menu Compartilhar.)</p>
        </details>`;
      return;
    }

    const lista = await st.api.arquivosDaPasta(st.pasta);
    st.arquivos = lista;
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre"><button type="button" class="linkbtn" data-acao="pasta-voltar">← Pastas</button></p>
        <h1>📁 ${esc(nomePasta(st.pasta))}</h1><p class="resumo">${lista.length} ${lista.length === 1 ? 'arquivo' : 'arquivos'}</p></div></div>
      ${aviso_}
      <div class="cartao-form envio-pasta">
        <label class="campo-arquivo pequeno"><input type="file" id="arquivos-pasta" accept="image/*,video/*" multiple>
          <span class="campo-arquivo-txt"><strong>📤 Enviar fotos e vídeos</strong><small>Pode escolher vários de uma vez · até ${cfg.limiteArquivoMB} MB cada</small></span></label>
        <label class="check"><input type="checkbox" id="reduzir-fotos" checked><span>Reduzir o tamanho das fotos <small>Recomendado: envia mais rápido e ocupa menos espaço.</small></span></label>
        <ul class="arquivos" id="lista-envio-pasta"></ul>
      </div>
      <div class="barra-selecao" id="barra-selecao" hidden>
        <span id="qtd-selecao"></span>
        <button type="button" class="btn small" data-acao="arq-post">Criar post com estes</button>
        <button type="button" class="btn small ghost-claro" data-acao="arq-baixar">Baixar</button>
        ${pode.criar() ? '<button type="button" class="btn small danger" data-acao="arq-apagar">Apagar</button>' : ''}
      </div>
      <div class="grade-arquivos">${lista.map((a) => `
        <label class="arq"><input type="checkbox" data-caminho="${esc(a.caminho)}">
          <span class="arq-thumb" data-arq="${esc(a.caminho)}" data-tipo="${esc(a.tipo)}">${a.tipo.startsWith('video/') ? '<span class="thumb-play">▶</span>' : ''}</span>
          <span class="arq-nome">${esc(a.nome)}<small>${new Date(a.criado_em).toLocaleDateString('pt-BR')} · ${CAL.tamanho(a.tamanho || 0)}</small></span>
        </label>`).join('') || '<p class="vazio">Pasta vazia. Toque em “Enviar fotos e vídeos”.</p>'}</div>`;

    const input = $('#arquivos-pasta', el);
    input.addEventListener('change', async () => {
      const arquivos = [...input.files];
      if (!arquivos.length) return;
      $('#lista-envio-pasta', el).innerHTML = arquivos.map(itemEnvio).join('');
      input.disabled = true;
      try {
        await enviarLista(st.pasta, arquivos, $('#lista-envio-pasta', el), $('#reduzir-fotos', el).checked);
        aviso(arquivos.length === 1 ? 'Arquivo enviado.' : `${arquivos.length} arquivos enviados.`);
        recarregar();
      } catch (e) { input.disabled = false; falha(e); }
    });
    el.querySelectorAll('.arq input').forEach((c) => c.addEventListener('change', () => {
      const n = el.querySelectorAll('.arq input:checked').length;
      $('#barra-selecao', el).hidden = !n;
      $('#qtd-selecao', el).textContent = `${n} ${n === 1 ? 'selecionado' : 'selecionados'}`;
    }));
    carregarArquivos(el);
  };

  async function carregarArquivos(raiz) {
    const alvos = [...raiz.querySelectorAll('[data-arq]:not(.ok)')];
    const faltam = alvos.map((a) => a.dataset.arq).filter((c) => !st.links[c]);
    try {
      if (faltam.length) Object.assign(st.links, await st.api.linksVisualizacao(faltam.map((c) => (st.arquivos || []).find((x) => x.caminho === c) || { caminho: c })));
    } catch (e) { console.warn('arquivos', e); }
    alvos.forEach((a) => {
      const url = st.links[a.dataset.arq]; if (!url) return;
      a.classList.add('ok');
      if (a.dataset.tipo.startsWith('video/')) a.insertAdjacentHTML('afterbegin', `<video src="${esc(url)}#t=0.5" muted playsinline preload="metadata"></video>`);
      else a.style.backgroundImage = `url("${url}")`;
    });
  }

  const selecionados = () => [...document.querySelectorAll('.arq input:checked')]
    .map((c) => (st.arquivos || []).find((a) => a.caminho === c.dataset.caminho)).filter(Boolean);

  async function criarPostDosArquivos() {
    const lista = selecionados();
    if (!lista.length) return;
    const temVideo = lista.some((a) => a.tipo.startsWith('video/'));
    const formato = temVideo ? 'reels' : lista.length > 1 ? 'carrossel' : 'estatico';
    const post = await st.api.salvarPost({
      data: null, hora: null, formato, tema: `Post com arquivos de “${nomePasta(st.pasta)}”`, legenda: '', hashtags: '', observacoes: '',
      status: 'producao', origem: st.eu.papel === 'socia' ? 'socia' : 'manual', autor_id: st.eu.id,
    });
    post.midias = [];
    for (let i = 0; i < lista.length; i++) post.midias.push(await st.api.copiarParaPost(post.id, lista[i], i));
    guardar([post]);
    aviso('Post criado na Caixa de entrada. Agora é só completar.');
    abrirEditor(post);
  }

  async function enviarRecebidos() {
    const recebidos = await compartilhados.listar();
    const pasta = $('#pasta-recebidos').value;
    const botao = document.querySelector('[data-acao="enviar-recebidos"]');
    if (botao) { botao.disabled = true; botao.textContent = 'Enviando…'; }
    await enviarLista(pasta, recebidos.map((r) => r.arquivo), $('#lista-recebidos'), true);
    await compartilhados.apagar(recebidos.map((r) => r.chave));
    aviso('Arquivos enviados para a pasta.');
    st.pasta = pasta; recarregar();
  }

  // ---------------------------------------------------------------- destaques (stories que ficam no perfil)
  const iniciais = (nome) => (nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const bolaDestaque = (d) => `<span class="destaque-bola${d.capa ? '' : ' sem-capa'}"${d.capa ? ` data-capa="${esc(d.capa)}"` : ''}>${d.capa ? '' : esc(iniciais(d.nome))}</span>`;

  async function carregarCapas(raiz) {
    const alvos = [...raiz.querySelectorAll('[data-capa]:not(.ok)')];
    const faltam = alvos.map((a) => a.dataset.capa).filter((c) => !st.links[c]);
    try { if (faltam.length) Object.assign(st.links, await st.api.linksVisualizacao([...new Set(faltam)].map((caminho) => ({ caminho })))); } catch (e) { console.warn('capas', e); }
    alvos.forEach((a) => { const url = st.links[a.dataset.capa]; if (url) { a.style.backgroundImage = `url("${url}")`; a.classList.add('ok'); } });
  }

  const ordemStories = (lista) => lista.slice().sort((a, b) => ((a.data || '9999') + (a.hora || '')).localeCompare((b.data || '9999') + (b.hora || '')));

  TELAS.destaques = async (el) => {
    const lista = await carregarDestaques();
    lista.forEach((d) => guardar(d.stories || []));
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Destaques</p><h1>Destaques do perfil</h1>
      <p class="resumo">As bolinhas que ficam abaixo da bio. Cada destaque é feito de stories que já foram publicados.</p></div>
      ${pode.criar() ? '<button type="button" class="btn small" data-acao="novo-destaque">+ Novo destaque</button>' : ''}</div>
      <details class="ajuda"><summary>Como funciona um destaque?</summary>
        <ol>
          <li><b>Programe o story</b> aqui, dentro do destaque, com dia e horário. Ele aparece no calendário como qualquer post.</li>
          <li><b>A criativa posta o story</b> no Instagram e marca “Postado”.</li>
          <li><b>Coloque no destaque:</b> nas primeiras 24 horas, abra o story e toque em <b>“Destacar”</b>. Depois disso, vá no perfil, segure a bolinha do destaque → <b>Editar destaque</b> → escolha o story no arquivo.</li>
          <li>Volte aqui e toque em <b>“Já adicionei ao destaque”</b>.</li>
        </ol>
        <p>A capa de cada destaque (a imagem da bolinha) também é definida no Instagram, em <b>Editar destaque → Editar capa</b>. Guarde aqui a imagem para a criativa baixar.</p></details>
      ${lista.map((d) => {
        const stories = ordemStories(d.stories || []);
        const postados = stories.filter((s) => s.status === 'postado').length;
        const noDestaque = stories.filter((s) => s.no_destaque).length;
        const pendentes = stories.filter((s) => s.status === 'postado' && !s.no_destaque).length;
        return `<section class="cartao destaque-cartao">
          <div class="destaque-topo">${bolaDestaque(d)}
            <div class="destaque-titulo"><h2>${esc(d.nome)}</h2>
              <p class="resumo">${stories.length} ${stories.length === 1 ? 'story' : 'stories'} · ${postados} ${postados === 1 ? 'postado' : 'postados'} · ${noDestaque} no destaque</p></div>
            ${pode.criar() ? `<div class="acoes"><button type="button" class="btn small" data-acao="novo-story" data-destaque="${d.id}">+ Programar story</button>
              <button type="button" class="btn small ghost" data-acao="editar-destaque" data-destaque="${d.id}">Editar</button></div>` : ''}
          </div>
          ${pendentes ? `<p class="aviso-destaque">⚠ ${pendentes} ${pendentes === 1 ? 'story já postado precisa' : 'stories já postados precisam'} ir para este destaque.</p>` : ''}
          <div class="lista">${stories.map((s) => cartao(s, { mostrarData: true })).join('') || '<p class="vazio">Nenhum story programado para este destaque ainda.</p>'}</div>
        </section>`;
      }).join('') || '<p class="vazio">Nenhum destaque criado ainda. Use “+ Novo destaque” para criar o primeiro (por exemplo: Quem somos, Radar, Turmas).</p>'}`;
    carregarCapas(el);
  };

  function abrirEditorDestaque(d) {
    const novo = !d.id;
    abrirModal(`
      <header class="modal-topo"><div><p class="sobre">${novo ? 'Novo destaque' : 'Editar destaque'}</p><h2>${esc(d.nome || 'Destaque')}</h2></div>
        <button type="button" class="fechar" data-acao="fechar" aria-label="Fechar">×</button></header>
      <form id="form-destaque">
        <div class="destaque-editor">${bolaDestaque(d)}
          <div class="destaque-campos">
            <label class="field"><span>Nome (aparece embaixo da bolinha, curto)</span><input type="text" name="nome" required maxlength="20" value="${esc(d.nome || '')}" placeholder="Ex.: Radar"></label>
            <label class="field"><span>Posição no perfil</span><input type="number" name="ordem" min="1" value="${(d.ordem ?? st.destaques.length) + 1}"><small>1 = primeira bolinha da esquerda</small></label>
          </div></div>
        <label class="campo-arquivo pequeno"><input type="file" name="capa" accept="image/*">
          <span class="campo-arquivo-txt"><strong>${d.capa ? 'Trocar a capa' : 'Escolher a imagem da capa'}</strong><small>Imagem quadrada; o Instagram mostra só o círculo do meio</small></span></label>
        <ul class="arquivos" id="capa-arquivo"></ul>
        <div class="acoes"><button type="submit" class="btn">${novo ? 'Criar destaque' : 'Salvar'}</button>
          <button type="button" class="btn small ghost" data-acao="fechar">Cancelar</button>
          ${!novo && pode.excluir({}) ? '<button type="button" class="btn small danger" data-acao="excluir-destaque">Excluir destaque</button>' : ''}</div>
      </form>`);
    modal().dataset.destaque = d.id || '';
    carregarCapas($('.modal-corpo', modal()));
    const form = $('#form-destaque');
    form.capa.addEventListener('change', () => {
      const f = form.capa.files[0];
      const bola = $('.destaque-editor .destaque-bola');
      if (f) { bola.style.backgroundImage = `url("${URL.createObjectURL(f)}")`; bola.textContent = ''; bola.classList.remove('sem-capa'); }
      $('#capa-arquivo').innerHTML = f ? `<li><span>${esc(f.name)}</span><small>${CAL.tamanho(f.size)}</small><progress max="1" value="0" hidden></progress></li>` : '';
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const botao = form.querySelector('[type=submit]');
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        const salvo = await st.api.salvarDestaque({ ...(novo ? {} : { id: d.id }), nome: form.nome.value.trim(), ordem: Math.max(0, Number(form.ordem.value || 1) - 1) });
        const arquivo = form.capa.files[0];
        if (arquivo) {
          const barra = $('#capa-arquivo progress'); if (barra) barra.hidden = false;
          const capa = await st.api.enviarCapaDestaque(salvo.id, arquivo, (f) => { if (barra) barra.value = f; });
          await st.api.salvarDestaque({ id: salvo.id, capa });
        }
        fecharModal(); aviso(novo ? 'Destaque criado.' : 'Destaque salvo.');
        await carregarDestaques(); recarregar();
      } catch (e) { botao.disabled = false; botao.textContent = 'Tentar de novo'; falha(e); }
    });
  }

  // ---------------------------------------------------------------- simulação do feed (tela cheia)
  const ultimoDiaDoMes = (s) => D.somar(D.somarMeses(D.primeiroDoMes(s), 1), -1);

  function celulaFeed(p, fixado) {
    const m = (p.midias || []).find((x) => /capa/i.test(x.nome)) || (p.midias || []).find((x) => !x.tipo.startsWith('video/')) || (p.midias || [])[0];
    const icone = fixado ? '📌' : p.formato === 'reels' ? '▶' : p.formato === 'carrossel' ? '❐' : '';
    const futuro = p.status !== 'postado';
    return `<button type="button" class="ig-celula${futuro ? ' futuro' : ''}" data-acao="abrir" data-id="${p.id}" title="${esc(p.tema)}">
      ${m ? `<span class="ig-thumb" data-thumb="${esc(m.caminho)}" data-tipo="${esc(m.tipo)}" data-post="${p.id}"></span>` : `<span class="ig-thumb sem">${esc(p.tema)}</span>`}
      ${icone ? `<span class="ig-icone">${icone}</span>` : ''}
      ${st.feedDatas ? `<span class="ig-data">${D.ddmm(p.data)}${futuro ? ' · programado' : ''}</span>` : ''}
    </button>`;
  }

  async function abrirFeed() {
    if (!st.feedAte) st.feedAte = ultimoDiaDoMes(D.hoje());
    $('#feed-ate').value = st.feedAte;
    $('#feed-datas').checked = st.feedDatas;
    $('#tela-feed').hidden = false;
    document.body.classList.add('sem-rolagem');
    await desenharFeed();
  }
  function fecharFeed() {
    $('#tela-feed').hidden = true;
    document.body.classList.remove('sem-rolagem');
  }

  async function desenharFeed() {
    const corpo = $('#feed-corpo');
    corpo.innerHTML = '<p class="carregando">Montando o feed…</p>';
    try {
      const [posts, destaques, checkins] = await Promise.all([
        st.api.feed(st.feedAte), carregarDestaques(), st.api.checkins().catch(() => []),
      ]);
      guardar(posts);
      const fixados = posts.filter((p) => p.fixado).slice(0, 3);
      const grade = fixados.concat(posts.filter((p) => !fixados.includes(p)));
      const ultimo = (checkins || []).filter((c) => c.seguidores != null && c.semana <= st.feedAte).pop();
      const perfil = cfg.perfil || {};
      const programados = posts.filter((p) => p.status !== 'postado').length;
      corpo.innerHTML = `
        <div class="ig">
          <div class="ig-topo"><b>${esc(perfil.usuario || 'mentorei_')}</b></div>
          <div class="ig-cabeca">
            <span class="ig-avatar">${esc(perfil.avatarLetra || 'M')}</span>
            <div class="ig-numeros">
              <span><b>${grade.length}</b>publicações</span>
              <span><b>${ultimo ? CAL.num(ultimo.seguidores) : '—'}</b>seguidores</span>
              <span><b>${programados}</b>programados</span>
            </div>
          </div>
          <p class="ig-nome">${esc(perfil.nome || 'Mentorei')}</p>
          <p class="ig-bio">${esc(perfil.bio || '')}</p>
          ${perfil.link ? `<p class="ig-link">🔗 ${esc(perfil.link)}</p>` : ''}
          <div class="ig-destaques">${destaques.map((d) => {
            const vazio = !(d.stories || []).some((s) => s.no_destaque || (s.status === 'postado' && s.data <= st.feedAte));
            return `<button type="button" class="ig-destaque${vazio ? ' vazio' : ''}" data-aba-ir="destaques">${bolaDestaque(d)}<span>${esc(d.nome)}</span></button>`;
          }).join('') || '<span class="ig-sem-destaques">Sem destaques ainda</span>'}</div>
          <div class="ig-abas"><span class="ativo">▦</span><span>▶</span><span>☺</span></div>
          <div class="ig-grade">${grade.map((p, i) => celulaFeed(p, i < fixados.length)).join('') || '<p class="vazio">Nenhum post até esta data.</p>'}</div>
        </div>`;
      carregarMiniaturas(corpo);
      carregarCapas(corpo);
    } catch (e) {
      corpo.innerHTML = `<p class="vazio">Não consegui montar o feed. ${esc(e.message)}</p>`;
      falha(e);
    }
  }

  $('#feed-ate').addEventListener('change', (ev) => { if (ev.target.value) { st.feedAte = ev.target.value; desenharFeed(); } });
  $('#feed-datas').addEventListener('change', (ev) => { st.feedDatas = ev.target.checked; desenharFeed(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#tela-feed').hidden && !modal().open) fecharFeed(); });

  // ---------------------------------------------------------------- anúncios (patrocinados, fora do calendário de posts)
  const SITUACOES = { rascunho: 'Rascunho', no_ar: 'No ar', pausado: 'Pausado', encerrado: 'Encerrado' };
  const OBJETIVOS = ['Vendas', 'Tráfego para o site', 'Cadastros', 'Alcance', 'Engajamento', 'Mensagens'];
  const BOTOES = ['Saiba mais', 'Comprar agora', 'Cadastre-se', 'Enviar mensagem', 'Ver mais'];
  const PRECO_RADAR = 14.99;
  const reais = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function somarResultados(lista) {
    const t = { gasto: 0, alcance: 0, cliques: 0, vendas: 0 };
    lista.forEach((r) => Object.keys(t).forEach((k) => { t[k] += Number(r[k]) || 0; }));
    t.custoVenda = t.vendas ? t.gasto / t.vendas : null;
    return t;
  }

  function cartaoAnuncio(p) {
    const a = p.anuncio || {}, t = somarResultados(a.resultados || []);
    const periodo = a.inicio ? `${D.ddmm(a.inicio)}${a.fim ? ' a ' + D.ddmm(a.fim) : ''}` : 'sem período';
    return `<button type="button" class="post anuncio sit-${a.situacao || 'rascunho'}" data-acao="abrir" data-id="${p.id}">
      ${miniatura(p)}
      <span class="post-info">
        <span class="post-topo"><b>${CAL.formatoDe(p)}</b> · ${periodo}${a.verba_dia ? ` · ${reais(a.verba_dia)}/dia` : ''}</span>
        <span class="post-tema">${esc(p.tema || 'Sem nome')}</span>
        ${t.gasto ? `<span class="post-de">${reais(t.gasto)} investidos · ${t.vendas} ${t.vendas === 1 ? 'venda' : 'vendas'}${t.custoVenda ? ` · ${reais(t.custoVenda)} por venda` : ''}</span>` : ''}
        <span class="chip sit-${a.situacao || 'rascunho'}">${SITUACOES[a.situacao || 'rascunho']}</span>
      </span>
    </button>`;
  }

  TELAS.anuncios = async (el) => {
    const lista = guardar(await st.api.anuncios());
    const t = somarResultados(lista.flatMap((p) => (p.anuncio && p.anuncio.resultados) || []));
    const noAr = lista.filter((p) => p.anuncio && p.anuncio.situacao === 'no_ar').length;
    const campanhas = {};
    lista.forEach((p) => { const c = (p.anuncio && p.anuncio.campanha) || 'Sem campanha'; (campanhas[c] = campanhas[c] || []).push(p); });
    const lucro = t.custoVenda == null ? '' : t.custoVenda < PRECO_RADAR ? 'sobe' : 'desce';
    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Anúncios</p><h1>Campanhas patrocinadas</h1>
      <p class="resumo">Tudo o que é pago fica aqui, separado dos posts do dia a dia. Os resultados entram em cada anúncio.</p></div>
      ${pode.criar() ? '<button type="button" class="btn small" data-acao="novo-anuncio">+ Novo anúncio</button>' : ''}</div>
      <div class="kpis">
        <div class="kpi"><span>Investido</span><strong>${reais(t.gasto)}</strong><small>soma de todos os resultados</small></div>
        <div class="kpi"><span>Vendas</span><strong>${CAL.num(t.vendas)}</strong><small>${CAL.num(t.cliques)} cliques</small></div>
        <div class="kpi"><span>Custo por venda</span><strong>${t.custoVenda == null ? '—' : reais(t.custoVenda)}</strong>
          ${lucro ? `<span class="delta ${lucro}">${lucro === 'sobe' ? '▲ abaixo' : '▼ acima'} de ${reais(PRECO_RADAR)}</span>` : ''}
          <small>precisa ficar abaixo do preço do Radar (${reais(PRECO_RADAR)})</small></div>
        <div class="kpi"><span>No ar agora</span><strong>${noAr}</strong><small>de ${lista.length} ${lista.length === 1 ? 'anúncio' : 'anúncios'}</small></div>
      </div>
      ${Object.keys(campanhas).map((c) => `
        <h2 class="sub">${esc(c)}</h2>
        <section class="lista">${campanhas[c].map(cartaoAnuncio).join('')}</section>`).join('')
        || '<p class="vazio">Nenhum anúncio ainda. Use “+ Novo anúncio” para guardar o primeiro.</p>'}`;
  };

  function htmlAnuncio(p) {
    const a = p.anuncio || {}, res = (a.resultados || []).slice().sort((x, y) => (x.data || '').localeCompare(y.data || ''));
    const t = somarResultados(res);
    const linha = (rotulo, campo, valor) => `<div class="campo-anuncio"><span>${rotulo}</span>
      <div>${valor ? esc(valor) : '<span class="vazio">—</span>'}</div>
      ${valor ? `<button type="button" class="linkbtn" data-copiar-anuncio="${campo}">Copiar</button>` : ''}</div>`;
    return `
      <section class="bloco">
        <div class="bloco-topo"><h3>Texto principal</h3>${p.legenda ? '<button type="button" class="btn small ghost" data-copiar="legenda">Copiar texto</button>' : ''}</div>
        <div class="texto-post">${p.legenda ? esc(p.legenda) : '<span class="vazio">Sem texto.</span>'}</div>
      </section>
      <section class="bloco campos-anuncio">
        ${linha('Título', 'titulo', a.titulo)}${linha('Descrição', 'descricao', a.descricao)}
        ${linha('Botão', 'botao', a.botao)}${linha('Link de destino', 'link', a.link)}
      </section>
      <section class="bloco campos-anuncio">
        <div class="campo-anuncio"><span>Objetivo</span><div>${esc(a.objetivo || '—')}</div></div>
        <div class="campo-anuncio"><span>Período</span><div>${a.inicio ? D.ddmm(a.inicio) : '—'}${a.fim ? ' a ' + D.ddmm(a.fim) : ''}</div></div>
        <div class="campo-anuncio"><span>Verba por dia</span><div>${a.verba_dia ? reais(a.verba_dia) : '—'}</div></div>
        <div class="campo-anuncio"><span>Público</span><div>${esc(a.publico || '—')}</div></div>
      </section>
      <section class="bloco">
        <h3>Resultados</h3>
        ${res.length ? `<div class="rolagem"><table><thead><tr><th>Dia</th><th>Gasto</th><th>Alcance</th><th>Cliques</th><th>Vendas</th></tr></thead>
          <tbody>${res.map((r) => `<tr><td>${r.data ? D.ddmm(r.data) : '—'}</td><td>${reais(r.gasto)}</td><td>${CAL.num(r.alcance)}</td><td>${CAL.num(r.cliques)}</td><td>${CAL.num(r.vendas)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><th>Total</th><th>${reais(t.gasto)}</th><th>${CAL.num(t.alcance)}</th><th>${CAL.num(t.cliques)}</th><th>${CAL.num(t.vendas)}</th></tr></tfoot></table></div>
          <p class="resumo">Custo por venda: <b>${t.custoVenda == null ? '—' : reais(t.custoVenda)}</b>${t.custoVenda == null ? '' : t.custoVenda < PRECO_RADAR ? ' · abaixo do preço do Radar ✓' : ' · acima do preço do Radar: vale rever o anúncio'}</p>`
          : '<p class="vazio">Ainda sem resultados. Copie os números do Gerenciador de Anúncios da Meta no fim de cada dia.</p>'}
        ${pode.criar() ? `<form id="form-resultado" class="form-resultado">
          <label class="field"><span>Dia</span><input type="date" name="data" value="${D.hoje()}" required></label>
          <label class="field"><span>Gasto (R$)</span><input type="number" name="gasto" step="0.01" min="0" inputmode="decimal" required></label>
          <label class="field"><span>Alcance</span><input type="number" name="alcance" min="0" inputmode="numeric"></label>
          <label class="field"><span>Cliques</span><input type="number" name="cliques" min="0" inputmode="numeric"></label>
          <label class="field"><span>Vendas</span><input type="number" name="vendas" min="0" inputmode="numeric"></label>
          <button type="submit" class="btn small">Adicionar</button></form>` : ''}
      </section>
      ${p.observacoes ? `<section class="bloco recado"><h3>Recado</h3><p>${esc(p.observacoes)}</p></section>` : ''}
      <footer class="modal-rodape"><div class="acoes">
        ${pode.criar() ? '<button type="button" class="btn small ghost" data-acao="editar">Editar anúncio</button>' : ''}
        ${pode.excluir(p) ? '<button type="button" class="btn small danger" data-acao="excluir">Excluir</button>' : ''}
      </div></footer>`;
  }

  function ligarFormResultado(p) {
    const form = $('#form-resultado');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const n = (v) => (v === '' ? 0 : Number(v));
      const novo = { data: form.data.value, gasto: n(form.gasto.value), alcance: n(form.alcance.value), cliques: n(form.cliques.value), vendas: n(form.vendas.value) };
      const anuncio = { ...(p.anuncio || {}) };
      anuncio.resultados = ((anuncio.resultados || []).filter((r) => r.data !== novo.data)).concat(novo);
      try {
        st.posts[p.id] = await st.api.salvarPost({ id: p.id, anuncio });
        aviso('Resultado guardado.');
        await abrirPost(p.id);
        if (st.aba === 'anuncios') { const el = $('#conteudo'); await TELAS.anuncios(el); carregarMiniaturas(el); }
      } catch (e) { falha(e); }
    });
  }

  // ---------------------------------------------------------------- janela do post
  const modal = () => $('#modal');
  function abrirModal(html) {
    const m = modal();
    $('.modal-corpo', m).innerHTML = html;
    if (!m.open) m.showModal();
    $('.modal-corpo', m).scrollTop = 0;
  }
  const fecharModal = () => modal().open && modal().close();

  const nomeArquivo = (p, m, i) => {
    const ext = (m.nome.match(/\.[a-z0-9]+$/i) || ['.' + (m.tipo.split('/')[1] || 'bin')])[0].toLowerCase();
    const n = p.midias.length > 1 ? '_' + String(i + 1).padStart(2, '0') : '';
    return `${p.data || 'sem-data'}${p.hora ? '_' + D.hora(p.hora).replace(':', 'h') : ''}_${p.formato}${n}${ext}`;
  };

  async function abrirPost(id) {
    const p = st.posts[id];
    if (!p) return;
    const links = await st.api.linksVisualizacao(p.midias.filter((m) => !st.links[m.caminho])).catch(() => ({}));
    Object.assign(st.links, links);
    const ad = p.tipo === 'anuncio', a = p.anuncio || {}, em = !ad && p.rede === 'email';
    const quando = ad ? `Anúncio · ${a.campanha || 'Sem campanha'}`
      : p.data ? `${D.longo(p.data)}${p.hora ? ' · ' + D.hora(p.hora) : ' · horário a definir'}` : 'Sem dia marcado';
    const podeCompartilhar = !!(navigator.canShare && navigator.share);
    const textoCompleto = [p.legenda, p.hashtags].filter(Boolean).join('\n\n');

    abrirModal(`
      <header class="modal-topo">
        <div><p class="sobre">${esc(quando)}</p><h2>${esc(p.tema || 'Sem tema')}</h2>
          <p class="etiquetas"><span class="chip">${CAL.formatoDe(p)}</span>${ad ? `<span class="chip sit-${a.situacao || 'rascunho'}">${SITUACOES[a.situacao || 'rascunho']}</span>` : chipStatus(p.status, p)}
          ${p.fixado ? '<span class="chip">📌 Fixado no perfil</span>' : ''}
          ${p.rede === 'linkedin' ? '<span class="chip chip-li">LinkedIn</span>' : ''}
          ${em ? '<span class="chip chip-email">✉ Mala direta</span>' : ''}
          ${p.destaque_id ? `<span class="chip">Destaque: ${esc(nomeDestaque(p.destaque_id))}${p.no_destaque ? ' ✓' : ''}</span>` : ''}
          ${quemEnviou(p) ? `<span class="chip">Enviado por ${esc(quemEnviou(p))}</span>` : ''}</p></div>
        <button type="button" class="fechar" data-acao="fechar" aria-label="Fechar">×</button>
      </header>

      ${em ? htmlEmail(p, podeCompartilhar) : `${p.midias.length ? `
      <section class="bloco">
        <div class="bloco-topo"><h3>${p.midias.length > 1 ? `Artes (${p.midias.length}, na ordem)` : 'Arte'}</h3>
          <div class="acoes">
            ${podeCompartilhar ? '<button type="button" class="btn small" data-acao="celular">Salvar no celular</button>' : ''}
            <button type="button" class="btn small ${podeCompartilhar ? 'ghost' : ''}" data-acao="baixar-tudo">Baixar ${p.midias.length > 1 ? 'tudo' : ''}</button>
          </div></div>
        <div class="galeria">${p.midias.map((m, i) => `
          <figure>
            ${m.tipo.startsWith('video/') ? `<video src="${esc(st.links[m.caminho] || '')}" controls playsinline preload="metadata"></video>`
              : `<img src="${esc(st.links[m.caminho] || '')}" alt="${p.midias.length > 1 ? 'Lâmina ' + (i + 1) : 'Arte do post'}" loading="lazy">`}
            <figcaption><span>${p.midias.length > 1 ? `${i + 1}. ` : ''}${esc(m.nome)}${m.tamanho ? ' · ' + CAL.tamanho(m.tamanho) : ''}</span>
              <button type="button" class="linkbtn" data-acao="baixar" data-i="${i}">Baixar</button></figcaption>
          </figure>`).join('')}</div>
      </section>` : '<p class="vazio">Este post ainda não tem arte.</p>'}

      ${ad ? htmlAnuncio(p) : `
      <section class="bloco">
        <div class="bloco-topo"><h3>${p.rede === 'linkedin' ? 'Texto do post' : 'Legenda'}</h3>${p.legenda ? '<button type="button" class="btn small ghost" data-copiar="legenda">Copiar legenda</button>' : ''}</div>
        <div class="texto-post">${p.legenda ? esc(p.legenda) : '<span class="vazio">Sem legenda.</span>'}</div>
      </section>
      <section class="bloco">
        <div class="bloco-topo"><h3>Hashtags</h3>${p.hashtags ? '<button type="button" class="btn small ghost" data-copiar="hashtags">Copiar hashtags</button>' : ''}</div>
        <div class="texto-post">${p.hashtags ? esc(p.hashtags) : '<span class="vazio">Sem hashtags.</span>'}</div>
      </section>
      ${p.legenda && p.hashtags ? '<button type="button" class="btn dark largo" data-copiar="tudo">Copiar legenda + hashtags</button>' : ''}
      ${p.observacoes ? `<section class="bloco recado"><h3>Recado</h3><p>${esc(p.observacoes)}</p></section>` : ''}

      <footer class="modal-rodape">
        ${p.status === 'postado' ? `<p class="postado-info">✓ Postado${p.postado_em ? ' em ' + new Date(p.postado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
          ${p.postado_por ? ' por ' + esc(st.nomes[p.postado_por] || '') : ''}${p.link_post ? ` · <a href="${esc(p.link_post)}" target="_blank" rel="noopener">ver no Instagram</a>` : ''}</p>` : ''}
        <div class="acoes">
          ${pode.postar() && p.status !== 'postado' ? '<button type="button" class="btn" data-acao="postado">Marcar como postado</button>' : ''}
          ${pode.postar() && p.destaque_id && p.status === 'postado' && !p.no_destaque ? `<button type="button" class="btn" data-acao="no-destaque">Já adicionei ao destaque “${esc(nomeDestaque(p.destaque_id))}”</button>` : ''}
          ${p.destaque_id && p.no_destaque ? '<p class="postado-info">✓ Já está no destaque</p>' : ''}
          ${pode.postar() && p.status === 'postado' ? '<button type="button" class="btn small ghost" data-acao="desfazer">Desfazer “postado”</button>' : ''}
          ${pode.editar(p) ? '<button type="button" class="btn small ghost" data-acao="editar">Editar</button>' : ''}
          ${pode.criar() && p.rede !== 'linkedin' && p.formato !== 'stories' ? '<button type="button" class="btn small ghost btn-li" data-acao="levar-li">＋ Adicionar ao LinkedIn</button>' : ''}
          ${pode.excluir(p) ? '<button type="button" class="btn small danger" data-acao="excluir">Excluir</button>' : ''}
        </div>
      </footer>`}`}`);
    modal().dataset.post = id;
    modal().dataset.texto = textoCompleto;
    if (ad) ligarFormResultado(p);
    if (em) { medirArtes(p); ligarFormResultadoEmail(p); }
  }

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); } catch (e) {
      const t = document.createElement('textarea');
      t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    aviso('Copiado! Agora é só colar.');
  }

  async function baixar(p, i) {
    const m = p.midias[i];
    const url = await st.api.linkArquivo(m, nomeArquivo(p, m, i));
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo(p, m, i); a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  let arquivosProntos = null;
  async function salvarNoCelular(p, botao) {
    try {
      if (!arquivosProntos || arquivosProntos.id !== p.id) {
        botao.textContent = 'Preparando…'; botao.disabled = true;
        const files = await Promise.all(p.midias.map(async (m, i) => {
          const blob = await (await fetch(st.links[m.caminho] || await st.api.linkArquivo(m))).blob();
          return new File([blob], nomeArquivo(p, m, i), { type: m.tipo });
        }));
        arquivosProntos = { id: p.id, files };
        botao.disabled = false;
      }
      if (!navigator.canShare({ files: arquivosProntos.files })) throw new Error('Este aparelho não deixa salvar assim. Use “Baixar”.');
      await navigator.share({ files: arquivosProntos.files });
      botao.textContent = 'Salvar no celular';
    } catch (e) {
      botao.disabled = false;
      if (e.name === 'NotAllowedError') { botao.textContent = 'Pronto: toque de novo para salvar'; return; }
      botao.textContent = 'Salvar no celular';
      if (e.name !== 'AbortError') falha(e);
    }
  }

  function pedirLink(p) {
    const rodape = $('.modal-rodape', modal());
    const em = p.rede === 'email';
    rodape.innerHTML = `<form id="form-postado" class="form-postado">
      ${em ? '<p class="resumo">Confirme quando o e-mail já tiver sido disparado (ou agendado) no RD Station.</p>'
        : `<label class="field"><span>Link do post no Instagram (opcional)</span>
        <input type="url" name="link" placeholder="https://www.instagram.com/p/..." inputmode="url"></label>`}
      <div class="acoes"><button type="submit" class="btn">${em ? 'Confirmar: foi enviado' : 'Confirmar: está postado'}</button>
      <button type="button" class="btn small ghost" data-acao="voltar">Voltar</button></div></form>`;
    $('#form-postado').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const salvo = await st.api.salvarPost({
          id: p.id, status: 'postado', link_post: ev.target.link ? ev.target.link.value.trim() || null : null,
          postado_em: new Date().toISOString(), postado_por: st.eu.id,
        });
        st.posts[p.id] = salvo;
        fecharModal(); aviso(em ? 'Marcado como enviado. 🎉' : 'Marcado como postado. 🎉'); recarregar();
      } catch (e) { falha(e); }
    });
    ($('#form-postado input') || $('#form-postado [type=submit]')).focus();
  }

  // ---------------------------------------------------------------- criar e editar post
  function abrirEditor(p) {
    const novo = !p.id;
    const midias = p.midias || [];
    const ad = p.tipo === 'anuncio', a = p.anuncio || {};
    const li = !ad && p.rede === 'linkedin';
    const em = !ad && p.rede === 'email', e = p.email || {};
    const opcoes = (lista, atual) => lista.map((v) => `<option${v === atual ? ' selected' : ''}>${esc(v)}</option>`).join('');
    const titulo = ad ? (novo ? 'Novo anúncio' : 'Editar anúncio') : em ? (novo ? 'Nova mala direta' : 'Editar mala direta')
      : (novo ? 'Novo post' : 'Editar post') + (li ? ' · LinkedIn' : '');
    abrirModal(`
      <header class="modal-topo"><div><p class="sobre">${titulo}</p><h2>${esc(p.tema || (em ? 'E-mail para clientes' : 'Sem tema'))}</h2></div>
        <button type="button" class="fechar" data-acao="fechar" aria-label="Fechar">×</button></header>
      <form id="form-post">
        ${ad ? `
        <div class="grade-3">
          <label class="field"><span>Campanha</span><input type="text" name="campanha" maxlength="80" value="${esc(a.campanha || '')}" placeholder="Ex.: Lançamento do Radar"></label>
          <label class="field"><span>Objetivo</span><select name="objetivo">${opcoes(OBJETIVOS, a.objetivo || 'Vendas')}</select></label>
          <label class="field"><span>Situação</span><select name="situacao">${Object.entries(SITUACOES).map(([k, v]) => `<option value="${k}"${k === (a.situacao || 'rascunho') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <div class="grade-3">
          <label class="field"><span>Começa em</span><input type="date" name="inicio" value="${a.inicio || ''}"></label>
          <label class="field"><span>Termina em</span><input type="date" name="fim" value="${a.fim || ''}"></label>
          <label class="field"><span>Verba por dia (R$)</span><input type="number" name="verba_dia" step="0.01" min="0" inputmode="decimal" value="${a.verba_dia ?? ''}"></label>
        </div>
        <div class="grade-2">
          <label class="field"><span>Formato</span><select name="formato">${Object.entries(CAL.FORMATOS).map(([k, v]) => `<option value="${k}"${k === (p.formato || 'estatico') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field"><span>Nome do anúncio</span><input type="text" name="tema" required maxlength="160" value="${esc(p.tema || '')}"></label>
        </div>
        <label class="field"><span>Texto principal (a 1ª linha é a que aparece antes do “ver mais”)</span><textarea name="legenda" rows="6">${esc(p.legenda || '')}</textarea></label>
        <div class="grade-2">
          <label class="field"><span>Título (até 40 caracteres)</span><input type="text" name="titulo" maxlength="60" value="${esc(a.titulo || '')}"></label>
          <label class="field"><span>Descrição (até 30 caracteres)</span><input type="text" name="descricao" maxlength="60" value="${esc(a.descricao || '')}"></label>
          <label class="field"><span>Botão</span><select name="botao">${opcoes(BOTOES, a.botao || 'Saiba mais')}</select></label>
          <label class="field"><span>Link de destino</span><input type="url" name="link" value="${esc(a.link || '')}" placeholder="https://"></label>
        </div>
        <label class="field"><span>Público</span><textarea name="publico" rows="2" placeholder="Ex.: líderes com equipe, 28 a 55 anos, Brasil">${esc(a.publico || '')}</textarea></label>
        <label class="field"><span>Recado</span><textarea name="observacoes" rows="2">${esc(p.observacoes || '')}</textarea></label>` : em ? `
        <div class="grade-3">
          <label class="field"><span>Dia do envio</span><input type="date" name="data" value="${p.data || ''}"><small>Vazio = fica em “Sem dia marcado”</small></label>
          <label class="field"><span>Horário</span><input type="time" name="hora" value="${D.hora(p.hora)}"></label>
          <label class="field"><span>Formato</span><select name="formato">${Object.entries(CAL.FORMATOS_EMAIL).map(([k, v]) => `<option value="${k}"${k === (p.formato || 'email') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Nome do e-mail (só para a equipe)</span><input type="text" name="tema" required maxlength="160" value="${esc(p.tema || '')}" placeholder="Ex.: Convite para a turma de novembro"></label>
        <label class="field"><span>Assunto</span><input type="text" name="assunto" maxlength="150" value="${esc(e.assunto || '')}">
          <small><span id="conta-assunto">${(e.assunto || '').length}</span> caracteres. É a linha em negrito na caixa de entrada; curto e direto aparece inteiro no celular.</small></label>
        <label class="field"><span>Pré-cabeçalho (opcional)</span><input type="text" name="preheader" maxlength="200" value="${esc(e.preheader || '')}">
          <small>A frase cinza que aparece logo depois do assunto. Complementa o assunto, sem repetir.</small></label>
        <div class="grade-2">
          <label class="field"><span>Para quem</span><input type="text" name="publico" maxlength="120" value="${esc(e.publico || '')}" placeholder="Ex.: Clientes ativos (cooperativas)"><small>Nome da lista ou segmentação no RD Station</small></label>
          <label class="field"><span>Link da arte ou do botão</span><input type="url" name="link" value="${esc(e.link || '')}" placeholder="https://"><small>Para onde vai quem clicar</small></label>
        </div>
        <label class="field"><span>Texto alternativo da arte</span><input type="text" name="alt" maxlength="200" value="${esc(e.alt || '')}">
          <small>Aparece no lugar da arte quando o programa de e-mail esconde as imagens.</small></label>
        ${pode.criar() ? `<label class="field"><span>Situação</span><select name="status">
          ${['producao', 'pronto'].map((s) => `<option value="${s}"${s === (p.status || 'producao') ? ' selected' : ''}>${CAL.STATUS_EMAIL[s]}</option>`).join('')}
          ${p.status === 'postado' ? '<option value="postado" selected>Enviado</option>' : ''}</select></label>` : ''}
        <label class="field"><span>Texto do e-mail (opcional: só se tiver texto além da arte)</span><textarea name="legenda" rows="4">${esc(p.legenda || '')}</textarea></label>
        <label class="field"><span>Recado para quem vai montar no RD Station</span><textarea name="observacoes" rows="2">${esc(p.observacoes || '')}</textarea></label>` : `
        <div class="grade-3">
          <label class="field"><span>Dia</span><input type="date" name="data" value="${p.data || ''}"><small>Vazio = fica na Caixa de entrada</small></label>
          <label class="field"><span>Horário</span><input type="time" name="hora" value="${D.hora(p.hora)}"></label>
          <label class="field"><span>Formato</span><select name="formato">${Object.entries(li ? CAL.FORMATOS_LI : CAL.FORMATOS).map(([k, v]) => `<option value="${k}"${k === (p.formato || (li ? 'texto' : 'carrossel')) ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Tema</span><input type="text" name="tema" required maxlength="160" value="${esc(p.tema || '')}"></label>
        ${pode.criar() && !li ? `
        <label class="field campo-destaque"${p.formato === 'stories' ? '' : ' hidden'}><span>Vai para o destaque</span>
          <select name="destaque_id"><option value="">Nenhum</option>${st.destaques.map((d) => `<option value="${d.id}"${d.id === p.destaque_id ? ' selected' : ''}>${esc(d.nome)}</option>`).join('')}</select>
          <small>Primeiro a criativa posta nos stories; depois adiciona ao destaque.</small></label>
        <label class="check campo-fixado"${p.formato === 'stories' ? ' hidden' : ''}><input type="checkbox" name="fixado"${p.fixado ? ' checked' : ''}>
          Fixar no topo do perfil <small>(o Instagram aceita até 3)</small></label>` : ''}
        ${pode.criar() ? `<label class="field"><span>Situação</span><select name="status">
          ${['producao', 'pronto'].map((s) => `<option value="${s}"${s === (p.status || 'producao') ? ' selected' : ''}>${CAL.STATUS[s]}</option>`).join('')}
          ${p.status === 'postado' ? '<option value="postado" selected>Postado</option>' : ''}</select></label>` : ''}
        <label class="field"><span>${li ? 'Texto do post (no LinkedIn, as 3 primeiras linhas aparecem antes do “ver mais”)' : 'Legenda'}</span><textarea name="legenda" rows="7">${esc(p.legenda || '')}</textarea></label>
        <label class="field"><span>Hashtags</span><textarea name="hashtags" rows="2">${esc(p.hashtags || '')}</textarea></label>
        <label class="field"><span>Recado para quem vai postar</span><textarea name="observacoes" rows="2">${esc(p.observacoes || '')}</textarea></label>`}
        <fieldset class="field"><legend>${em ? 'Arte do e-mail' : 'Artes e vídeos'}</legend>
          <ul class="arquivos">${midias.map((m) => `<li><span>${esc(m.nome)}</span><small>${m.tamanho ? CAL.tamanho(m.tamanho) : ''}</small>
            <button type="button" class="linkbtn perigo" data-remover="${m.id}">Remover</button></li>`).join('')}</ul>
          <label class="campo-arquivo pequeno"><input type="file" name="arquivos" accept="${em ? 'image/*,.html,.htm,.pdf' : 'image/*,video/*'}" multiple>
            <span class="campo-arquivo-txt"><strong>Adicionar arquivos</strong><small>${em
              ? `Imagem com ${LARGURA_EMAIL} px de largura. Arte em partes: numere os nomes (01, 02…). Também aceita o arquivo .html.`
              : 'Carrossel: escolha as lâminas na ordem (ou numere os nomes: 01, 02…)'}</small></span></label>
          <ul class="arquivos" id="novos-arquivos"></ul>
        </fieldset>
        <div class="acoes"><button type="submit" class="btn">${novo ? (ad ? 'Criar anúncio' : em ? 'Criar mala direta' : 'Criar post') : 'Salvar'}</button>
          <button type="button" class="btn small ghost" data-acao="fechar">Cancelar</button></div>
      </form>`);
    const form = $('#form-post');
    if (!ad && form.destaque_id) {
      form.formato.addEventListener('change', () => {
        const story = form.formato.value === 'stories';
        $('.campo-destaque', form).hidden = !story;
        $('.campo-fixado', form).hidden = story;
      });
    }
    form.arquivos.addEventListener('change', () => {
      const lista = ordenarArquivos([...form.arquivos.files]);
      $('#novos-arquivos').innerHTML = lista.map((f) =>
        `<li><span>${esc(f.name)}</span><small>${CAL.tamanho(f.size)}</small><progress max="1" value="0" hidden></progress></li>`).join('');
      // arte de e-mail: mostra a largura de cada imagem e avisa se estiver estreita ou pesada
      if (em) lista.forEach(async (f, i) => {
        if (!f.type.startsWith('image/')) return;
        try {
          const bmp = await createImageBitmap(f);
          const avisos = avisosArte(bmp.width, f.size), alvo = $(`#novos-arquivos li:nth-child(${i + 1}) small`);
          if (!alvo) return;
          alvo.textContent = [CAL.tamanho(f.size), `${bmp.width} × ${bmp.height} px`].concat(avisos).join(' · ');
          alvo.classList.toggle('aviso-peca', avisos.length > 0);
        } catch (erro) { /* imagem que o navegador não lê: segue sem a medida */ }
      });
    });
    if (em) form.assunto.addEventListener('input', () => { $('#conta-assunto').textContent = form.assunto.value.length; });
    form.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Remover este arquivo do post?')) return;
      try {
        const m = midias.find((x) => x.id === b.dataset.remover);
        await st.api.removerMidia(m);
        p.midias = midias.filter((x) => x !== m);
        b.closest('li').remove();
      } catch (e) { falha(e); }
    }));
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const arquivos = ordenarArquivos([...form.arquivos.files]);
      const grande = arquivos.find((f) => f.size > cfg.limiteArquivoMB * 1048576);
      if (grande) { aviso(`"${grande.name}" passa de ${cfg.limiteArquivoMB} MB.`, true); return; }
      const botao = form.querySelector('[type=submit]');
      botao.disabled = true; botao.textContent = 'Salvando…';
      try {
        const txt = (n) => form[n].value.trim();
        const dados = ad ? {
          tipo: 'anuncio', data: null, hora: null, formato: form.formato.value, tema: txt('tema'), legenda: txt('legenda'),
          hashtags: '', observacoes: txt('observacoes'),
          anuncio: {
            ...a, campanha: txt('campanha'), objetivo: form.objetivo.value, situacao: form.situacao.value,
            inicio: form.inicio.value || null, fim: form.fim.value || null,
            verba_dia: form.verba_dia.value === '' ? null : Number(form.verba_dia.value),
            titulo: txt('titulo'), descricao: txt('descricao'), botao: form.botao.value, link: txt('link'), publico: txt('publico'),
            resultados: a.resultados || [],
          },
        } : em ? {
          data: form.data.value || null, hora: form.data.value && form.hora.value ? form.hora.value : null,
          formato: form.formato.value, tema: txt('tema'), legenda: txt('legenda'), hashtags: '', observacoes: txt('observacoes'),
          email: {
            ...e, assunto: txt('assunto'), preheader: txt('preheader'), publico: txt('publico'), link: txt('link'), alt: txt('alt'),
            resultados: e.resultados || {},
          },
        } : {
          data: form.data.value || null, hora: form.data.value && form.hora.value ? form.hora.value : null,
          formato: form.formato.value, tema: txt('tema'), legenda: txt('legenda'),
          hashtags: txt('hashtags'), observacoes: txt('observacoes'),
        };
        if (form.status) dados.status = form.status.value;
        if (!ad && form.destaque_id) {
          const story = form.formato.value === 'stories';
          dados.destaque_id = story ? (form.destaque_id.value || null) : null;
          dados.fixado = !story && form.fixado.checked;
        }
        if (novo && li) dados.rede = 'linkedin';
        if (novo && em) dados.rede = 'email';
        if (novo) Object.assign(dados, { origem: st.eu.papel === 'socia' ? 'socia' : 'manual', autor_id: st.eu.id, status: dados.status || 'pronto' });
        const salvo = await st.api.salvarPost(novo ? dados : { id: p.id, ...dados });
        const ordem = (p.midias || []).reduce((mx, m) => Math.max(mx, m.ordem + 1), 0);
        await enviarArquivos(salvo.id, arquivos, ordem, $('#novos-arquivos'));
        fecharModal(); aviso(novo ? (ad ? 'Anúncio criado.' : em ? 'Mala direta criada.' : 'Post criado.') : 'Alterações salvas.'); recarregar();
      } catch (e) {
        botao.disabled = false; botao.textContent = 'Tentar de novo';
        falha(e);
      }
    });
  }

  // lâminas numeradas (01, 02, 10...) na ordem natural
  const ordenarArquivos = (lista) => lista.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));

  // ---------------------------------------------------------------- cliques
  document.addEventListener('click', async (ev) => {
    const alvo = ev.target.closest('[data-aba],[data-aba-ir],[data-acao],[data-mover],[data-mover-mes],[data-ver-semana],[data-copiar],[data-copiar-anuncio],[data-copiar-email],[data-pasta]');
    if (!alvo) return;
    const d = alvo.dataset;
    const p = st.posts[modal().dataset.post];
    try {
      if (d.aba) return irPara(d.aba);
      if (d.abaIr) { fecharModal(); fecharFeed(); return irPara(d.abaIr); }
      if (d.mover) { st.ref = d.mover === '0' ? D.hoje() : D.somar(st.ref, +d.mover); return recarregar(); }
      if (d.moverMes) { st.ref = D.somarMeses(st.ref, +d.moverMes); return recarregar(); }
      if (d.verSemana) { st.ref = d.verSemana; return irPara('semana'); }
      if (d.copiar) return copiar(d.copiar === 'tudo' ? modal().dataset.texto : p[d.copiar]);
      if (d.copiarAnuncio) return copiar(p.anuncio[d.copiarAnuncio]);
      if (d.copiarEmail) return copiar(dadosEmail(p)[d.copiarEmail]);
      if (d.pasta) { st.pasta = d.pasta; return recarregar(); }
      switch (d.acao) {
        case 'abrir': return abrirPost(d.id);
        case 'fechar': return fecharModal();
        case 'novo': return abrirEditor({ data: d.data || D.hoje(), hora: d.hora || '', formato: 'carrossel', status: 'producao' });
        case 'li-modo': st.liModo = d.modo; return recarregar();
        case 'li-relatorio': st.liModo = 'relatorio'; return irPara('linkedin');
        case 'li-mover': st.liRef = d.dias === '0' ? D.hoje() : D.somar(st.liRef || D.hoje(), +d.dias); return recarregar();
        case 'novo-li': return abrirEditor({ rede: 'linkedin', data: d.data || '', hora: d.hora || '', formato: 'texto', status: 'producao' });
        case 'levar-li': alvo.disabled = true; alvo.textContent = 'Copiando…'; return levarParaLinkedin(p);
        case 'em-modo': st.emModo = d.modo; return recarregar();
        case 'em-resultados': st.emModo = 'resultados'; return irPara('mala');
        case 'em-mover': st.emRef = d.meses === '0' ? D.hoje() : D.somarMeses(st.emRef || D.hoje(), +d.meses); return recarregar();
        case 'novo-email': return abrirEditor({ rede: 'email', data: '', hora: '', formato: 'email', status: 'producao', email: {} });
        case 'html-ver': {
          const caixa = $('#html-previa');
          if (caixa.firstChild) { caixa.innerHTML = ''; return; }
          const html = await textoDoArquivo(p.midias[+d.i]);
          caixa.innerHTML = '<p class="resumo">Prévia do HTML (os links não abrem aqui):</p><iframe class="email-html" sandbox title="Prévia do e-mail em HTML"></iframe>';
          caixa.querySelector('iframe').srcdoc = html;
          return;
        }
        case 'html-copiar': return copiar(await textoDoArquivo(p.midias[+d.i]));
        case 'novo-anuncio': return abrirEditor({ tipo: 'anuncio', formato: 'estatico', status: 'producao', anuncio: { situacao: 'rascunho', resultados: [] } });
        case 'baixar': return baixar(p, +d.i);
        case 'baixar-tudo':
          for (let i = 0; i < p.midias.length; i++) { await baixar(p, i); await new Promise((r) => setTimeout(r, 500)); }
          return aviso(p.midias.length > 1 ? 'Baixando os arquivos. Se o navegador perguntar, permita vários downloads.' : 'Baixando…');
        case 'celular': return salvarNoCelular(p, alvo);
        case 'postado': return pedirLink(p);
        case 'voltar': return abrirPost(p.id);
        case 'desfazer': {
          st.posts[p.id] = await st.api.salvarPost({ id: p.id, status: 'pronto', link_post: null, postado_em: null, postado_por: null, ...(p.destaque_id ? { no_destaque: false } : {}) });
          fecharModal(); aviso(`Voltou para “${CAL.statusDe(p, 'pronto')}”.`); return recarregar();
        }
        case 'no-destaque':
          st.posts[p.id] = await st.api.salvarPost({ id: p.id, no_destaque: true });
          await carregarDestaques();
          fecharModal(); aviso('Anotado: o story está no destaque. ✓'); return recarregar();
        case 'ver-feed': return abrirFeed();
        case 'fechar-feed': return fecharFeed();
        case 'feed-hoje': st.feedAte = D.hoje(); $('#feed-ate').value = st.feedAte; return desenharFeed();
        case 'feed-menos': st.feedAte = ultimoDiaDoMes(D.somarMeses(st.feedAte || D.hoje(), -1)); $('#feed-ate').value = st.feedAte; return desenharFeed();
        case 'feed-mais': st.feedAte = ultimoDiaDoMes(D.somarMeses(st.feedAte || D.hoje(), 1)); $('#feed-ate').value = st.feedAte; return desenharFeed();
        case 'novo-destaque': return abrirEditorDestaque({});
        case 'editar-destaque': return abrirEditorDestaque(st.destaques.find((x) => x.id === d.destaque) || {});
        case 'excluir-destaque': {
          const alvoDestaque = st.destaques.find((x) => x.id === modal().dataset.destaque);
          if (!alvoDestaque || !confirm(`Excluir o destaque “${alvoDestaque.nome}”? Os stories continuam no calendário, só deixam de estar ligados a ele.`)) return;
          await st.api.excluirDestaque(alvoDestaque);
          await carregarDestaques();
          fecharModal(); aviso('Destaque excluído.'); return recarregar();
        }
        case 'pasta-voltar': st.pasta = null; return recarregar();
        case 'nova-pasta': {
          const nome = prompt('Nome da nova pasta (por exemplo: Evento Sicoob outubro)');
          if (!nome || !slugPasta(nome)) return;
          await st.api.criarPasta(slugPasta(nome));
          st.pasta = slugPasta(nome); aviso('Pasta criada.'); return recarregar();
        }
        case 'arq-baixar':
          for (const a of selecionados()) {
            const url = await st.api.linkArquivo({ caminho: a.caminho }, a.nome);
            const link = document.createElement('a'); link.href = url; link.download = a.nome; link.rel = 'noopener';
            document.body.appendChild(link); link.click(); link.remove();
            await new Promise((r) => setTimeout(r, 500));
          }
          return aviso('Baixando. Se o navegador perguntar, permita vários downloads.');
        case 'arq-apagar': {
          const lista = selecionados();
          if (!lista.length || !confirm(`Apagar ${lista.length} ${lista.length === 1 ? 'arquivo' : 'arquivos'} desta pasta? Não dá para desfazer. (Posts já criados com eles não são afetados.)`)) return;
          await st.api.apagarArquivos(lista.map((a) => a.caminho));
          aviso('Apagado.'); return recarregar();
        }
        case 'arq-post': alvo.disabled = true; return criarPostDosArquivos().finally(() => { alvo.disabled = false; });
        case 'enviar-recebidos': return enviarRecebidos().catch((e) => { falha(e); recarregar(); });
        case 'descartar-recebidos': {
          if (!confirm('Descartar os arquivos que chegaram pelo Compartilhar? Eles continuam na galeria do celular.')) return;
          const r = await compartilhados.listar(); await compartilhados.apagar(r.map((x) => x.chave)); return recarregar();
        }
        case 'novo-story': return abrirEditor({ formato: 'stories', destaque_id: d.destaque, data: D.hoje(), hora: '', status: 'producao' });
        case 'editar': return abrirEditor(p);
        case 'excluir':
          if (!confirm('Excluir este post e as artes dele? Não dá para desfazer.')) return;
          await st.api.excluirPost(p);
          fecharModal(); aviso('Post excluído.'); return recarregar();
        default:
      }
    } catch (e) { falha(e); }
  });

  modal().addEventListener('click', (ev) => { if (ev.target === modal()) fecharModal(); });

  // ---------------------------------------------------------------- login e senha
  $('#form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target, botao = f.querySelector('[type=submit]');
    botao.disabled = true;
    try {
      await st.api.entrar(f.email.value.trim(), f.senha.value);
      await entrarNoApp();
    } catch (e) { falha(e); } finally { botao.disabled = false; }
  });
  $('#esqueci').addEventListener('click', async () => {
    const email = $('#form-login').email.value.trim();
    if (!email) { aviso('Digite seu e-mail primeiro.', true); $('#form-login').email.focus(); return; }
    try {
      await st.api.esqueciSenha(email);
      aviso('Se esse e-mail tiver acesso, chega um link para criar uma nova senha.');
    } catch (e) { falha(e); }
  });
  $('#form-senha').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (f.senha.value.length < 8) { aviso('Use pelo menos 8 caracteres.', true); return; }
    if (f.senha.value !== f.senha2.value) { aviso('As duas senhas não estão iguais.', true); return; }
    try {
      await st.api.definirSenha(f.senha.value);
      history.replaceState(null, '', location.pathname);
      aviso('Senha criada!');
      await entrarNoApp();
    } catch (e) { falha(e); }
  });
  $('#trocar-senha').addEventListener('click', () => { $('#cancelar-senha').hidden = false; mostrarTela('tela-senha'); });
  $('#cancelar-senha').addEventListener('click', () => mostrarTela('app'));
  document.querySelectorAll('[data-sair]').forEach((b) => b.addEventListener('click', async () => {
    await st.api.sair(); mostrarTela('tela-login');
  }));

  iniciar();
})();
