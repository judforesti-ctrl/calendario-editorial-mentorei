/* Ligação com o Instagram da Mentorei pela API oficial da Meta ("API do Instagram com login do Instagram").
   A chave de acesso fica na tabela cal_instagram (só admin e criativa leem) e vale 60 dias; o calendário a renova
   sozinho. Quando alguém da equipe abre o calendário, os posts publicados são ligados aos do calendário
   (marcados como postados, com os números de cada um) e o check-in já vem com os números da semana. */
window.CAL = window.CAL || {};

CAL.criarInstagram = function (api) {
  const D = CAL.datas;
  const BASE = 'https://graph.instagram.com/v25.0';
  const DIA = 86400000;
  let ligacao;            // linha da cal_instagram: null = não ligado; undefined = ainda não lida
  let disponivel = true;  // false enquanto o script supabase/06-instagram.sql não tiver sido rodado

  const ERROS = {
    190: 'A chave do Instagram venceu ou foi cancelada. Gere uma chave nova no site da Meta e cole no Check-in.',
    10: 'A chave não tem permissão para ler os números. Gere a chave de novo aceitando todas as permissões.',
    200: 'A chave não tem permissão para ler os números. Gere a chave de novo aceitando todas as permissões.',
    4: 'O Instagram pediu uma pausa (muitos pedidos seguidos). Tente de novo daqui a uma hora.',
    17: 'O Instagram pediu uma pausa (muitos pedidos seguidos). Tente de novo daqui a uma hora.',
    32: 'O Instagram pediu uma pausa (muitos pedidos seguidos). Tente de novo daqui a uma hora.',
  };

  async function chamar(caminho, params = {}, token) {
    const url = new URL(/^https:/.test(caminho) ? caminho : BASE + caminho);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    if (!url.searchParams.has('access_token')) url.searchParams.set('access_token', token || ligacao.token);
    let r;
    try { r = await fetch(url); } catch (e) { throw new Error('Não consegui falar com o Instagram. Verifique a internet e tente de novo.'); }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok || dados.error) {
      const info = dados.error || {};
      const e = new Error(ERROS[info.code] || `O Instagram respondeu: ${info.message || 'erro ' + r.status}`);
      e.chaveInvalida = info.code === 190;
      throw e;
    }
    return dados;
  }

  // "2026-10-06T15:30:12+0000" → data e hora de Brasília
  const instante = (ts) => new Date(String(ts).replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
  function local(ts) {
    const d = instante(ts);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value]));
    return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, iso: d.toISOString() };
  }
  // meia-noite de Brasília em segundos (sem horário de verão desde 2019: UTC-3)
  const inicioDoDia = (data) => Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10), 3) / 1000;
  const minutos = (h) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
  const inicioLegenda = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 40);

  async function ler() {
    if (ligacao !== undefined) return ligacao;
    try { ligacao = await api.instagram(); } catch (e) { console.warn('instagram', e); disponivel = false; ligacao = null; }
    return ligacao;
  }

  async function conectar(chave, quem) {
    const token = chave.trim().replace(/\s+/g, '');
    if (token.length < 50) throw new Error('Essa chave parece incompleta. Copie de novo a chave inteira no site da Meta.');
    const eu = await chamar('/me', { fields: 'user_id,username' }, token);
    ligacao = await api.conectarInstagram({
      token, usuario: eu.username || '', expira_em: new Date(Date.now() + 60 * DIA).toISOString(),
      renovado_em: new Date().toISOString(), sincronizado_em: null, erro: '', conectado_por: quem,
    });
    return ligacao;
  }

  async function desligar() {
    await api.desligarInstagram();
    ligacao = null;
  }

  // a chave dura 60 dias; uma vez por semana ela é trocada por outra nova (o Instagram só deixa depois de 24 horas)
  async function renovarSePreciso() {
    if (Date.now() - new Date(ligacao.renovado_em) < 7 * DIA) return;
    const r = await chamar('https://graph.instagram.com/refresh_access_token', { grant_type: 'ig_refresh_token' });
    ligacao = await api.atualizarInstagram({
      token: r.access_token, renovado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + (r.expires_in || 60 * 86400) * 1000).toISOString(),
    });
  }

  async function listarMidias(desde) {
    const limite = inicioDoDia(desde) * 1000;
    const todas = [];
    let pagina = await chamar('/me/media', { fields: 'id,caption,media_type,media_product_type,timestamp,permalink', limit: 50 });
    for (let i = 0; i < 5 && pagina; i++) {
      todas.push(...(pagina.data || []));
      const ultima = todas[todas.length - 1];
      if (!pagina.paging || !pagina.paging.next || !ultima || instante(ultima.timestamp) < limite) break;
      pagina = await chamar(pagina.paging.next);
    }
    return todas.filter((m) => instante(m.timestamp) >= limite);
  }

  async function numerosDoPost(m) {
    const pedir = async (metricas) => (await chamar(`/${m.id}/insights`, { metric: metricas })).data || [];
    let lista;
    try {
      lista = await pedir('reach,views,likes,comments,saved,shares,total_interactions');
    } catch (e) {
      if (e.chaveInvalida) throw e;
      try { lista = await pedir('reach,likes,comments,saved,shares'); } catch (e2) { if (e2.chaveInvalida) throw e2; return null; }
    }
    const v = (nome) => {
      const x = lista.find((i) => i.name === nome);
      if (!x) return null;
      return x.total_value ? x.total_value.value : (x.values && x.values[0] ? x.values[0].value : null);
    };
    return {
      alcance: v('reach'), visualizacoes: v('views'), curtidas: v('likes'), comentarios: v('comments'),
      salvamentos: v('saved'), compartilhamentos: v('shares'), interacoes: v('total_interactions'), lido_em: new Date().toISOString(),
    };
  }

  // Qual post do calendário é este post do Instagram? 1º pela legenda (até 3 dias de diferença);
  // senão, o do mesmo dia com formato parecido e horário mais perto.
  function acharPost(m, quando, livres) {
    const formato = m.media_product_type === 'REELS' || m.media_type === 'VIDEO' ? 'reels'
      : m.media_type === 'CAROUSEL_ALBUM' ? 'carrossel' : 'estatico';
    // carrossel de uma foto só chega como imagem: estático e carrossel podem se confundir; reels não
    const nota = (p) => (p.formato === formato ? 0 : formato !== 'reels' && p.formato !== 'reels' ? 1 : null);
    const dias = (p) => Math.abs(D.parse(p.data) - D.parse(quando.data)) / DIA;
    const distancia = (p) => (p.hora ? Math.abs(minutos(D.hora(p.hora)) - minutos(quando.hora)) : 24 * 60);
    const melhor = (lista) => lista.sort((a, b) => dias(a) - dias(b) || (nota(a) ?? 2) - (nota(b) ?? 2) || distancia(a) - distancia(b))[0] || null;
    const leg = inicioLegenda(m.caption);
    const pelaLegenda = leg.length >= 15 ? melhor(livres.filter((p) => p.data && dias(p) <= 3 && inicioLegenda(p.legenda) === leg)) : null;
    return pelaLegenda || melhor(livres.filter((p) => p.data === quando.data && nota(p) !== null));
  }

  // Liga os posts publicados nos últimos 14 dias aos do calendário, marca como postado e guarda os números.
  // Roda no máximo a cada 3 horas, a não ser que peçam ("Atualizar agora").
  let emAndamento = null;   // a abertura do calendário e o check-in podem pedir ao mesmo tempo: roda uma vez só
  function sincronizar(forcar) {
    if (!emAndamento) emAndamento = conferir(forcar).finally(() => { emAndamento = null; });
    return emAndamento;
  }

  async function conferir(forcar) {
    if (!(await ler())) return null;
    if (!forcar && ligacao.sincronizado_em && Date.now() - new Date(ligacao.sincronizado_em) < 3 * 3600000) return { pulou: true };
    try {
      await renovarSePreciso();
      const desde = D.somar(D.hoje(), -14);
      const midias = (await listarMidias(desde)).filter((m) => m.media_product_type !== 'STORY')
        .sort((a, b) => instante(a.timestamp) - instante(b.timestamp));
      const posts = (await api.posts(D.somar(desde, -3), D.somar(D.hoje(), 3))).filter((p) => p.formato !== 'stories');
      // primeiro descobre qual post é qual (em ordem de publicação); depois busca os números e grava, 5 de cada vez
      const pares = [];
      for (const m of midias) {
        const quando = local(m.timestamp);
        const p = posts.find((x) => x.ig_id === m.id) || acharPost(m, quando, posts.filter((x) => !x.ig_id));
        if (!p) continue;
        p.ig_id = m.id;
        pares.push({ m, p, quando });
      }
      let marcados = 0;
      for (let i = 0; i < pares.length; i += 5) {
        await Promise.all(pares.slice(i, i + 5).map(async ({ m, p, quando }) => {
          const campos = { ig_id: m.id };
          if (m.permalink) campos.link_post = m.permalink;
          const numeros = await numerosDoPost(m);
          if (numeros) campos.ig_numeros = numeros;
          if (p.status !== 'postado') { Object.assign(campos, { status: 'postado', postado_em: quando.iso }); marcados++; }
          await api.salvarPost({ id: p.id, ...campos });
        }));
      }
      const ligados = pares.length;
      ligacao = await api.atualizarInstagram({ sincronizado_em: new Date().toISOString(), erro: '' });
      return { marcados, ligados, publicados: midias.length };
    } catch (e) {
      ligacao.erro = e.message;
      await api.atualizarInstagram({ erro: e.message }).catch(() => {});
      throw e;
    }
  }

  // Números de uma semana (segunda a domingo) para o check-in. Seguidores: total no fim da semana.
  async function semana(segunda) {
    if (!(await ler())) return null;
    const agora = Math.floor(Date.now() / 1000);
    const ini = inicioDoDia(segunda), fim = Math.min(inicioDoDia(D.somar(segunda, 7)), agora);
    const total = async (metric, de = ini, ate = fim, extra = {}) =>
      (await chamar('/me/insights', { metric, period: 'day', metric_type: 'total_value', since: de, until: ate, ...extra })).data || [];
    const valor = async (metric) => {
      try { const x = (await total(metric))[0]; return x && x.total_value ? x.total_value.value : null; } catch (e) { if (e.chaveInvalida) throw e; return null; }
    };
    // quem começou a seguir e quem deixou de seguir num período (o Instagram só informa para perfis com 100+ seguidores)
    const saldo = async (de, ate) => {
      const x = (await total('follows_and_unfollows', de, ate, { breakdown: 'follow_type' }))[0];
      const res = ((((x || {}).total_value || {}).breakdowns || [])[0] || {}).results || [];
      const soma = (tipo) => res.filter((r) => r.dimension_values[0] === tipo).reduce((s, r) => s + r.value, 0);
      return { seguiram: soma('FOLLOWER'), deixaram: soma('NON_FOLLOWER') };
    };
    const [perfil, alcance, visualizacoes, engajadas, interacoes, daSemana] = await Promise.all([
      chamar('/me', { fields: 'followers_count' }), valor('reach'), valor('views'), valor('accounts_engaged'), valor('total_interactions'),
      saldo(ini, fim).catch((e) => { if (e.chaveInvalida) throw e; return null; }),
    ]);
    // seguidores no fim da semana = hoje menos o saldo de depois que a semana acabou
    let seguidores = perfil.followers_count;
    if (fim < agora - 3600) {
      try { const s = await saldo(fim, agora); seguidores -= s.seguiram - s.deixaram; } catch (e) {
        if (e.chaveInvalida) throw e;
        if (agora - fim > 3 * 86400) seguidores = null;   // semana antiga: melhor deixar em branco do que errado
      }
    }
    return {
      seguidores, alcance, visualizacoes, contas_engajadas: engajadas, interacoes,
      seguiram: daSemana ? daSemana.seguiram : null, deixaram: daSemana ? daSemana.deixaram : null,
      lido_em: new Date().toISOString(),
    };
  }

  return { ler, conectar, desligar, sincronizar, semana, disponivel: () => disponivel, ligacao: () => ligacao };
};
