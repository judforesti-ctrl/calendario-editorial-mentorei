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
  };
  const ABAS_POR_PAPEL = {
    admin: ['hoje', 'semana', 'mes', 'caixa', 'destaques', 'enviar', 'checkin', 'evolucao', 'anuncios'],
    criativa: ['hoje', 'semana', 'mes', 'caixa', 'destaques', 'checkin', 'evolucao', 'anuncios'],
    socia: ['enviar', 'meus', 'semana', 'evolucao'],
  };

  const st = {
    api: null, eu: null, nomes: {}, aba: null, ref: D.hoje(), posts: {}, links: {}, checkinSemana: null,
    destaques: [], feedAte: null, feedDatas: true,
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

  const chipStatus = (s) => `<span class="chip st-${s}">${CAL.STATUS[s]}</span>`;

  function miniatura(p) {
    const m = (p.midias || [])[0];
    if (!m) return '<span class="thumb sem">sem arte</span>';
    const extra = p.midias.length > 1 ? `<span class="thumb-n">${p.midias.length}</span>` : '';
    return `<span class="thumb" data-thumb="${esc(m.caminho)}" data-tipo="${esc(m.tipo)}" data-post="${p.id}">${extra}</span>`;
  }

  // nome digitado no envio; sem ele, o nome do login de quem é sócia
  const quemEnviou = (p) => p.enviado_por || (p.origem === 'socia' ? st.nomes[p.autor_id] || 'sócia' : '');

  // último nome digitado neste aparelho (conveniência; funciona sem ele)
  const lerNome = () => { try { return localStorage.getItem('cal_meu_nome') || ''; } catch (e) { return ''; } };
  const guardarNome = (n) => { try { localStorage.setItem('cal_meu_nome', n); } catch (e) { /* sem armazenamento */ } };

  function cartao(p, opc = {}) {
    const quando = opc.mostrarData && p.data ? `${D.curto(p.data)} · ` : '';
    const hora = p.hora ? D.hora(p.hora) : 'a definir';
    const de = quemEnviou(p) ? `<span class="post-de">Enviado por ${esc(quemEnviou(p))}</span>`
      : p.destaque_id ? `<span class="post-de">→ destaque “${esc(nomeDestaque(p.destaque_id))}”${p.no_destaque ? ' ✓' : ''}</span>` : '';
    return `<button type="button" class="post st-${p.status}" data-acao="abrir" data-id="${p.id}">
      ${miniatura(p)}
      <span class="post-info">
        <span class="post-topo"><b>${quando}${hora}</b> · ${CAL.FORMATOS[p.formato]}${p.fixado ? ' · 📌' : ''}</span>
        <span class="post-tema">${esc(p.tema || 'Sem tema')}</span>
        ${de}${chipStatus(p.status)}
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
    const [posts, caixa, checkins] = await Promise.all([
      st.api.posts(hoje, amanha), st.api.caixa(), pode.checkin() ? st.api.checkins() : Promise.resolve(null),
    ]);
    guardar(posts); guardar(caixa);
    const deHoje = posts.filter((p) => p.data === hoje);
    const feitos = deHoje.filter((p) => p.status === 'postado').length;
    const semanaPassada = D.somar(D.segunda(hoje), -7);
    const faltaCheckin = checkins && !checkins.some((c) => c.semana === semanaPassada);
    const semDestaque = pode.postar() ? (await carregarDestaques())
      .flatMap((d) => d.stories || []).filter((s) => s.status === 'postado' && !s.no_destaque).length : 0;

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
      <section class="lista-dia">${itensDoDia(hoje, posts) || '<p class="vazio">Nenhum post marcado para hoje.</p>'}</section>
      ${caixa.length && pode.criar() ? `<button type="button" class="alerta suave" data-aba-ir="caixa">
        <strong>${caixa.length} ${caixa.length === 1 ? 'envio aguardando' : 'envios aguardando'} dia e horário</strong>
        <span>Vídeos das sócias e posts sem data ficam na Caixa de entrada. →</span></button>` : ''}
      <h2 class="sub">Amanhã · ${D.curto(amanha)}</h2>
      <section class="lista-dia">${itensDoDia(amanha, posts) || '<p class="vazio">Nada marcado para amanhã.</p>'}</section>`;
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
        <span class="cel-posts">${doDia.slice(0, 3).map((p) => `<span class="mini st-${p.status}">${D.hora(p.hora) || '—'} ${CAL.FORMATOS[p.formato]}</span>`).join('')}
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

  TELAS.checkin = async (el) => {
    const semanas = Array.from({ length: 6 }, (_, i) => D.somar(D.segunda(D.hoje()), -7 * (i + 1)));
    const semana = st.checkinSemana && semanas.includes(st.checkinSemana) ? st.checkinSemana : semanas[0];
    const [checkins, posts] = await Promise.all([st.api.checkins(), st.api.posts(semana, D.somar(semana, 6))]);
    guardar(posts);
    const atual = checkins.find((c) => c.semana === semana) || {};
    const anterior = checkins.filter((c) => c.semana < semana).pop();
    const postados = posts.filter((p) => p.status === 'postado');
    const feitos = new Set(checkins.map((c) => c.semana));

    el.innerHTML = `
      <div class="cabeca"><div><p class="sobre">Check-in semanal</p><h1>Como foi a semana?</h1>
      <p class="resumo">Preencha toda segunda-feira com os números da semana anterior. Eles alimentam a aba Evolução.</p></div></div>
      <form id="form-checkin" class="cartao-form">
        <label class="field"><span>Semana</span>
          <select name="semana">${semanas.map((s) => `<option value="${s}"${s === semana ? ' selected' : ''}>${D.ddmm(s)} a ${D.ddmm(D.somar(s, 6))}${feitos.has(s) ? ' ✓ preenchida' : ' · pendente'}</option>`).join('')}</select></label>
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
              ${miniatura(p)}<span><b>${D.curto(p.data)} · ${CAL.FORMATOS[p.formato]}</b><br>${esc(p.tema)}</span></label>`).join('')}</div>`
            : '<p class="vazio">Nenhum post marcado como postado nessa semana.</p>'}
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
            <div><p class="rank-semana">Semana de ${D.ddmm(c.semana)}${p ? ` · ${CAL.FORMATOS[p.formato]}` : ''}</p>
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
        <span class="post-topo"><b>${CAL.FORMATOS[p.formato]}</b> · ${periodo}${a.verba_dia ? ` · ${reais(a.verba_dia)}/dia` : ''}</span>
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
    const ad = p.tipo === 'anuncio', a = p.anuncio || {};
    const quando = ad ? `Anúncio · ${a.campanha || 'Sem campanha'}`
      : p.data ? `${D.longo(p.data)}${p.hora ? ' · ' + D.hora(p.hora) : ' · horário a definir'}` : 'Sem dia marcado';
    const podeCompartilhar = !!(navigator.canShare && navigator.share);
    const textoCompleto = [p.legenda, p.hashtags].filter(Boolean).join('\n\n');

    abrirModal(`
      <header class="modal-topo">
        <div><p class="sobre">${esc(quando)}</p><h2>${esc(p.tema || 'Sem tema')}</h2>
          <p class="etiquetas"><span class="chip">${CAL.FORMATOS[p.formato]}</span>${ad ? `<span class="chip sit-${a.situacao || 'rascunho'}">${SITUACOES[a.situacao || 'rascunho']}</span>` : chipStatus(p.status)}
          ${p.fixado ? '<span class="chip">📌 Fixado no perfil</span>' : ''}
          ${p.destaque_id ? `<span class="chip">Destaque: ${esc(nomeDestaque(p.destaque_id))}${p.no_destaque ? ' ✓' : ''}</span>` : ''}
          ${quemEnviou(p) ? `<span class="chip">Enviado por ${esc(quemEnviou(p))}</span>` : ''}</p></div>
        <button type="button" class="fechar" data-acao="fechar" aria-label="Fechar">×</button>
      </header>

      ${p.midias.length ? `
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
        <div class="bloco-topo"><h3>Legenda</h3>${p.legenda ? '<button type="button" class="btn small ghost" data-copiar="legenda">Copiar legenda</button>' : ''}</div>
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
          ${pode.excluir(p) ? '<button type="button" class="btn small danger" data-acao="excluir">Excluir</button>' : ''}
        </div>
      </footer>`}`);
    modal().dataset.post = id;
    modal().dataset.texto = textoCompleto;
    if (ad) ligarFormResultado(p);
  }

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); } catch (e) {
      const t = document.createElement('textarea');
      t.value = texto; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    aviso('Copiado! Agora é só colar no Instagram.');
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
    rodape.innerHTML = `<form id="form-postado" class="form-postado">
      <label class="field"><span>Link do post no Instagram (opcional)</span>
        <input type="url" name="link" placeholder="https://www.instagram.com/p/..." inputmode="url"></label>
      <div class="acoes"><button type="submit" class="btn">Confirmar: está postado</button>
      <button type="button" class="btn small ghost" data-acao="voltar">Voltar</button></div></form>`;
    $('#form-postado').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const salvo = await st.api.salvarPost({
          id: p.id, status: 'postado', link_post: ev.target.link.value.trim() || null,
          postado_em: new Date().toISOString(), postado_por: st.eu.id,
        });
        st.posts[p.id] = salvo;
        fecharModal(); aviso('Marcado como postado. 🎉'); recarregar();
      } catch (e) { falha(e); }
    });
    $('#form-postado input').focus();
  }

  // ---------------------------------------------------------------- criar e editar post
  function abrirEditor(p) {
    const novo = !p.id;
    const midias = p.midias || [];
    const ad = p.tipo === 'anuncio', a = p.anuncio || {};
    const opcoes = (lista, atual) => lista.map((v) => `<option${v === atual ? ' selected' : ''}>${esc(v)}</option>`).join('');
    abrirModal(`
      <header class="modal-topo"><div><p class="sobre">${ad ? (novo ? 'Novo anúncio' : 'Editar anúncio') : (novo ? 'Novo post' : 'Editar post')}</p><h2>${esc(p.tema || 'Sem tema')}</h2></div>
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
        <label class="field"><span>Recado</span><textarea name="observacoes" rows="2">${esc(p.observacoes || '')}</textarea></label>` : `
        <div class="grade-3">
          <label class="field"><span>Dia</span><input type="date" name="data" value="${p.data || ''}"><small>Vazio = fica na Caixa de entrada</small></label>
          <label class="field"><span>Horário</span><input type="time" name="hora" value="${D.hora(p.hora)}"></label>
          <label class="field"><span>Formato</span><select name="formato">${Object.entries(CAL.FORMATOS).map(([k, v]) => `<option value="${k}"${k === (p.formato || 'carrossel') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Tema</span><input type="text" name="tema" required maxlength="160" value="${esc(p.tema || '')}"></label>
        ${pode.criar() ? `
        <label class="field campo-destaque"${p.formato === 'stories' ? '' : ' hidden'}><span>Vai para o destaque</span>
          <select name="destaque_id"><option value="">Nenhum</option>${st.destaques.map((d) => `<option value="${d.id}"${d.id === p.destaque_id ? ' selected' : ''}>${esc(d.nome)}</option>`).join('')}</select>
          <small>Primeiro a criativa posta nos stories; depois adiciona ao destaque.</small></label>
        <label class="check campo-fixado"${p.formato === 'stories' ? ' hidden' : ''}><input type="checkbox" name="fixado"${p.fixado ? ' checked' : ''}>
          Fixar no topo do perfil <small>(o Instagram aceita até 3)</small></label>` : ''}
        ${pode.criar() ? `<label class="field"><span>Situação</span><select name="status">
          ${['producao', 'pronto'].map((s) => `<option value="${s}"${s === (p.status || 'producao') ? ' selected' : ''}>${CAL.STATUS[s]}</option>`).join('')}
          ${p.status === 'postado' ? '<option value="postado" selected>Postado</option>' : ''}</select></label>` : ''}
        <label class="field"><span>Legenda</span><textarea name="legenda" rows="7">${esc(p.legenda || '')}</textarea></label>
        <label class="field"><span>Hashtags</span><textarea name="hashtags" rows="2">${esc(p.hashtags || '')}</textarea></label>
        <label class="field"><span>Recado para quem vai postar</span><textarea name="observacoes" rows="2">${esc(p.observacoes || '')}</textarea></label>`}
        <fieldset class="field"><legend>Artes e vídeos</legend>
          <ul class="arquivos">${midias.map((m) => `<li><span>${esc(m.nome)}</span><small>${m.tamanho ? CAL.tamanho(m.tamanho) : ''}</small>
            <button type="button" class="linkbtn perigo" data-remover="${m.id}">Remover</button></li>`).join('')}</ul>
          <label class="campo-arquivo pequeno"><input type="file" name="arquivos" accept="image/*,video/*" multiple>
            <span class="campo-arquivo-txt"><strong>Adicionar arquivos</strong><small>Carrossel: escolha as lâminas na ordem (ou numere os nomes: 01, 02…)</small></span></label>
          <ul class="arquivos" id="novos-arquivos"></ul>
        </fieldset>
        <div class="acoes"><button type="submit" class="btn">${novo ? (ad ? 'Criar anúncio' : 'Criar post') : 'Salvar'}</button>
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
      $('#novos-arquivos').innerHTML = ordenarArquivos([...form.arquivos.files]).map((f) =>
        `<li><span>${esc(f.name)}</span><small>${CAL.tamanho(f.size)}</small><progress max="1" value="0" hidden></progress></li>`).join('');
    });
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
        if (novo) Object.assign(dados, { origem: st.eu.papel === 'socia' ? 'socia' : 'manual', autor_id: st.eu.id, status: dados.status || 'pronto' });
        const salvo = await st.api.salvarPost(novo ? dados : { id: p.id, ...dados });
        const ordem = (p.midias || []).reduce((mx, m) => Math.max(mx, m.ordem + 1), 0);
        await enviarArquivos(salvo.id, arquivos, ordem, $('#novos-arquivos'));
        fecharModal(); aviso(novo ? (ad ? 'Anúncio criado.' : 'Post criado.') : 'Alterações salvas.'); recarregar();
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
    const alvo = ev.target.closest('[data-aba],[data-aba-ir],[data-acao],[data-mover],[data-mover-mes],[data-ver-semana],[data-copiar],[data-copiar-anuncio]');
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
      switch (d.acao) {
        case 'abrir': return abrirPost(d.id);
        case 'fechar': return fecharModal();
        case 'novo': return abrirEditor({ data: d.data || D.hoje(), hora: d.hora || '', formato: 'carrossel', status: 'producao' });
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
          fecharModal(); aviso('Voltou para “Pronto para postar”.'); return recarregar();
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
