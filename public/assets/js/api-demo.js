/* Modo demonstração: mesmas funções do api-supabase.js, com dados de exemplo na memória.
   Nada é salvo: recarregar a página volta tudo ao começo. */
window.CAL = window.CAL || {};

CAL.criarApiDemo = function (cfg) {
  const D = CAL.datas;
  const PERFIS = [
    { id: 'u-admin', nome: 'Juliana', papel: 'admin', email: 'juliana@demo' },
    { id: 'u-sec', nome: 'Criativa', papel: 'criativa', email: 'criativa@demo' },
    { id: 'u-socia', nome: 'Sócia', papel: 'socia', email: 'socia@demo' },
  ];
  const lerPapel = () => { try { return sessionStorage.getItem('cal_demo_papel') || 'criativa'; } catch (e) { return 'criativa'; } };
  let papel = lerPapel();

  // sorteio repetível, para a demonstração ficar igual a cada abertura
  let semente = 7;
  const sorte = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
  const escolher = (lista) => lista[Math.floor(sorte() * lista.length)];
  const uid = () => 'd' + Math.random().toString(36).slice(2, 10);

  const TEMAS = [
    ['carrossel', '3 sinais de que você virou o gargalo do seu time'],
    ['reels', 'Delegar não é largar: o que muda na prática'],
    ['estatico', 'Frase: liderança é o que acontece quando você não está na sala'],
    ['carrossel', 'Líder executora x líder estratégica'],
    ['reels', 'O erro mais comum na primeira promoção'],
    ['carrossel', 'Feedback difícil em 4 passos'],
    ['estatico', 'Pergunta da semana: qual reunião você cancelaria hoje?'],
    ['reels', 'Como dizer não para a sua liderança sem se queimar'],
    ['carrossel', 'Radar da Liderança: descubra seu estágio em 10 minutos'],
    ['reels', 'Bastidores: uma sessão de mentoria por dentro'],
    ['carrossel', 'A 1:1 que o seu time realmente precisa'],
    ['estatico', 'Checklist da líder que quer ser promovida'],
  ];
  const LEGENDA = 'Você já percebeu que o time trava quando você sai de férias?\n\n'
    + 'Isso não é sinal de que você é indispensável. É sinal de que a liderança está concentrada demais em você.\n\n'
    + 'Arrasta para o lado e veja os 3 sinais (e o que fazer com cada um).\n\n'
    + 'Salva este post para reler na próxima segunda. 💚';
  const HASHTAGS = '#lideranca #liderancafeminina #gestaodepessoas #carreira #mentoria #mentorei #desenvolvimentodelideres';
  const MOTIVOS = [
    'Gancho direto na dor ("o time trava quando eu saio"); muita gente salvou e mandou para colegas.',
    'Reels curto, com legenda na tela. Teve muito compartilhamento no direct.',
    'Carrossel com checklist prático: foi o post mais salvo da semana.',
    'Tema polêmico (dizer não para a chefe) gerou muitos comentários.',
    'Bastidores reais da mentoria: as pessoas comentaram que se identificaram.',
  ];

  function criarMidias(post) {
    const n = post.formato === 'carrossel' ? 5 : 1;
    const ext = post.formato === 'reels' ? 'capa.png' : 'png';
    return Array.from({ length: n }, (_, i) => ({
      id: uid(), post_id: post.id, caminho: `demo/${post.id}/${i}`,
      nome: n > 1 ? `lamina-${String(i + 1).padStart(2, '0')}.png` : `arte-${ext}`,
      tipo: 'image/png', tamanho: 480000, ordem: i,
      _rotulo: n > 1 ? `${i + 1}/${n}` : (post.formato === 'reels' ? '▶ reels' : ''),
      _tema: post.tema, _formato: post.formato,
    }));
  }

  // ---------- dados de exemplo ----------
  const hoje = D.hoje();
  const inicio = D.somar(D.segunda(hoje), -21);
  const posts = [];
  for (let d = inicio; d <= D.somar(hoje, 12); d = D.somar(d, 1)) {
    const horarios = cfg.horarios[D.parse(d).getDay()] || [];
    horarios.forEach((hora) => {
      const futuro = d > hoje;
      if (futuro && sorte() < (d > D.somar(hoje, 5) ? 0.65 : 0.25)) return; // horários livres no futuro
      const [formato, tema] = escolher(TEMAS);
      const passado = d < hoje || (d === hoje && hora < D.horaAgora());
      const p = {
        id: uid(), data: d, hora: hora + ':00', formato, tema, legenda: LEGENDA, hashtags: HASHTAGS,
        observacoes: formato === 'carrossel' ? 'Marcar @mentorei nos stories depois de postar.' : '',
        status: passado ? 'postado' : (futuro && sorte() < 0.35 ? 'producao' : 'pronto'),
        origem: 'claude', autor_id: 'u-admin',
        link_post: passado ? 'https://www.instagram.com/p/exemplo/' : null,
        postado_em: passado ? D.parse(d).toISOString() : null, postado_por: passado ? 'u-sec' : null,
        criado_em: new Date().toISOString(),
      };
      p.midias = criarMidias(p);
      posts.push(p);
    });
  }
  [['Bastidores da mentoria de ontem', 'Gravei no fim da sessão. Pode cortar o comecinho!'],
    ['Resposta para a pergunta de uma seguidora sobre feedback', '']].forEach(([tema, obs], i) => {
    const p = {
      id: uid(), data: null, hora: null, formato: 'reels', tema, legenda: 'Sugestão: ' + tema.toLowerCase() + '.',
      hashtags: '', observacoes: obs, status: 'pronto', origem: 'socia', autor_id: 'u-socia', link_post: null,
      postado_em: null, postado_por: null, criado_em: new Date(Date.now() - (i + 1) * 36e5 * 5).toISOString(),
    };
    p.midias = criarMidias(p);
    posts.push(p);
  });

  // prévia da fila de verdade (só no computador, pelo servidor local): troca os exemplos pelos posts da fila
  if (CAL.previa) {
    posts.length = 0;
    CAL.previa.forEach((f) => {
      const p = {
        id: uid(), data: f.data || null, hora: f.hora ? f.hora + ':00' : null, formato: f.formato, tema: f.tema, legenda: f.legenda,
        hashtags: f.hashtags, observacoes: f.observacoes || '', status: 'pronto', origem: 'claude', autor_id: 'u-admin',
        link_post: null, postado_em: null, postado_por: null, criado_em: new Date().toISOString(),
        tipo: f.tipo || 'organico', anuncio: f.anuncio || {}, fixado: !!f.fixado, destaque_id: null, no_destaque: false,
      };
      if (p.tipo === 'anuncio') p.status = 'producao';
      p.midias = f.arquivos.map((a, i) => ({
        id: uid(), post_id: p.id, caminho: '/_local/' + a.split('/').map(encodeURIComponent).join('/'),
        nome: a.split('/').pop(), tipo: /\.(mp4|mov)$/i.test(a) ? 'video/mp4' : 'image/png', tamanho: 0, ordem: i, _real: true,
      }));
      posts.push(p);
    });
  } else {
    // um anúncio de exemplo, com alguns dias de resultado
    const p = {
      id: uid(), data: null, hora: null, formato: 'reels', tema: 'Reels: em que estágio está a sua liderança?',
      legenda: 'Em que estágio está a sua liderança? Faça o diagnóstico online da Mentorei e receba o laudo no seu e-mail.',
      hashtags: '', observacoes: '', status: 'pronto', origem: 'claude', autor_id: 'u-admin', link_post: null,
      postado_em: null, postado_por: null, criado_em: new Date().toISOString(), tipo: 'anuncio',
      anuncio: {
        campanha: 'Lançamento do Radar', objetivo: 'Vendas', situacao: 'no_ar', inicio: hoje, fim: D.somar(hoje, 14), verba_dia: 30,
        publico: 'Líderes com equipe, 28 a 55 anos, Brasil', titulo: 'Em que estágio está a sua liderança?',
        descricao: 'Laudo completo por R$ 14,99', botao: 'Saiba mais', link: 'https://radardalideranca.netlify.app/',
        resultados: [{ data: D.somar(hoje, -2), gasto: 30, alcance: 4200, cliques: 61, vendas: 3 }, { data: D.somar(hoje, -1), gasto: 30, alcance: 3900, cliques: 55, vendas: 2 }],
      },
    };
    p.midias = criarMidias(p);
    posts.push(p);
  }
  const organico = (p) => (p.tipo || 'organico') === 'organico';

  // destaques de exemplo; sem a prévia da fila, também alguns stories programados para eles
  const destaques = CAL.previa ? [] : [
    { id: uid(), nome: 'Quem somos', capa: null, ordem: 0 },
    { id: uid(), nome: 'Radar', capa: null, ordem: 1 },
    { id: uid(), nome: 'Turmas', capa: null, ordem: 2 },
  ];
  if (!CAL.previa) {
    posts.filter((p) => organico(p) && p.data && p.formato !== 'stories').slice(0, 2).forEach((p) => { p.fixado = true; });
    [[0, -3, 'postado', true, 'As três sócias da Mentorei'], [0, 2, 'pronto', false, 'Como trabalhamos'],
      [1, -1, 'postado', false, 'O que é o Radar da Liderança'], [1, 4, 'producao', false, 'Trecho do laudo'],
      [2, -6, 'postado', true, 'Turma do Sicoob Paulista']].forEach(([d, dias, status, noDestaque, tema]) => {
      const p = {
        id: uid(), data: D.somar(hoje, dias), hora: '10:00:00', formato: 'stories', tema, legenda: '', hashtags: '',
        observacoes: '', status, origem: 'claude', autor_id: 'u-admin', link_post: null,
        postado_em: status === 'postado' ? D.parse(D.somar(hoje, dias)).toISOString() : null, postado_por: status === 'postado' ? 'u-sec' : null,
        criado_em: new Date().toISOString(), tipo: 'organico', anuncio: {}, fixado: false, destaque_id: destaques[d].id, no_destaque: noDestaque,
      };
      p.midias = criarMidias(p);
      posts.push(p);
    });
  }

  const checkins = [];
  let seguidores = 4210;
  for (let s = D.somar(D.segunda(hoje), -63); s < D.segunda(hoje); s = D.somar(s, 7)) {
    seguidores += Math.round(40 + sorte() * 150 + checkins.length * 12);
    const daSemana = posts.filter((p) => p.data >= s && p.data <= D.somar(s, 6) && p.status === 'postado');
    checkins.push({
      id: uid(), semana: s, seguidores, alcance: Math.round(7000 + sorte() * 9000 + checkins.length * 1300),
      visitas_perfil: Math.round(600 + sorte() * 700), melhor_post_id: daSemana.length ? escolher(daSemana).id : null,
      melhor_post_motivo: escolher(MOTIVOS), aprendizado: '', preenchido_por: 'u-sec', criado_em: s,
    });
  }
  checkins.pop(); // a semana passada fica pendente, para mostrar o lembrete do check-in

  // ---------- imagens de exemplo (desenhadas na hora) ----------
  const imagens = {};
  function desenhar(m) {
    if (imagens[m.caminho]) return imagens[m.caminho];
    if (m._real) return m.caminho;
    const c = document.createElement('canvas');
    const alto = m._formato === 'reels' ? 1920 : 1350;
    c.width = 1080; c.height = alto;
    const g = c.getContext('2d');
    g.fillStyle = m._formato === 'estatico' ? '#C8F04A' : '#091216';
    g.fillRect(0, 0, 1080, alto);
    g.fillStyle = m._formato === 'estatico' ? '#091216' : '#C8F04A';
    g.font = '700 46px Manrope, Arial, sans-serif';
    g.fillText('MENTOREI', 90, 150);
    g.fillStyle = m._formato === 'estatico' ? '#091216' : '#FFFFFF';
    g.font = '800 76px Manrope, Arial, sans-serif';
    const palavras = (m._tema || '').split(' ');
    let linha = '', y = alto / 2 - 160;
    palavras.forEach((p) => {
      if (g.measureText(linha + p).width > 880) { g.fillText(linha, 90, y); linha = ''; y += 96; }
      linha += p + ' ';
    });
    g.fillText(linha, 90, y);
    if (m._rotulo) {
      g.font = '600 44px Inter, Arial, sans-serif';
      g.fillStyle = m._formato === 'estatico' ? '#091216' : '#C8F04A';
      g.fillText(m._rotulo, 90, alto - 110);
    }
    return (imagens[m.caminho] = c.toDataURL('image/png'));
  }

  const copia = (o) => JSON.parse(JSON.stringify(o));
  const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  return {
    demo: true,
    perfisDemo: PERFIS,
    trocarPapel(novo) {
      papel = novo;
      try { sessionStorage.setItem('cal_demo_papel', novo); } catch (e) { /* sem armazenamento: vale só nesta página */ }
    },

    async iniciar() { return { demo: true }; },
    async entrar() {},
    async sair() {},
    async esqueciSenha() {},
    async definirSenha() {},
    async meuPerfil() { return { ...PERFIS.find((p) => p.papel === papel) }; },
    async perfis() { return copia(PERFIS); },

    async posts(de, ate) {
      await espera();
      return copia(posts.filter((p) => organico(p) && p.data && p.data >= de && p.data <= ate)
        .sort((a, b) => (a.data + (a.hora || '99')).localeCompare(b.data + (b.hora || '99'))));
    },
    async caixa() {
      await espera();
      return copia(posts.filter((p) => organico(p) && (!p.data || !p.hora) && p.status !== 'postado')
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em)));
    },
    async feed(ate) {
      await espera();
      return copia(posts.filter((p) => organico(p) && p.data && p.data <= ate && ['carrossel', 'estatico', 'reels'].includes(p.formato))
        .sort((a, b) => (b.data + (b.hora || '')).localeCompare(a.data + (a.hora || ''))).slice(0, 120));
    },
    async destaques() {
      await espera();
      return copia(destaques.slice().sort((a, b) => a.ordem - b.ordem)
        .map((d) => ({ ...d, stories: posts.filter((p) => p.destaque_id === d.id) })));
    },
    async salvarDestaque(d) {
      let atual = destaques.find((x) => x.id === d.id);
      const { stories, ...campos } = d;
      if (atual) Object.assign(atual, campos);
      else { atual = { capa: null, ordem: destaques.length, ...campos, id: uid() }; destaques.push(atual); }
      return copia(atual);
    },
    async excluirDestaque(d) {
      const i = destaques.findIndex((x) => x.id === d.id);
      if (i >= 0) destaques.splice(i, 1);
      posts.forEach((p) => { if (p.destaque_id === d.id) p.destaque_id = null; });
    },
    async enviarCapaDestaque(destaqueId, arquivo, aoProgredir) {
      for (let i = 1; i <= 5; i++) { await espera(60); aoProgredir && aoProgredir(i / 5); }
      const caminho = `demo/destaques/${destaqueId}/${uid()}`;
      imagens[caminho] = URL.createObjectURL(arquivo);
      return caminho;
    },
    async anuncios() {
      await espera();
      return copia(posts.filter((p) => !organico(p)).sort((a, b) => b.criado_em.localeCompare(a.criado_em)));
    },
    async meusEnvios(autorId) {
      await espera();
      return copia(posts.filter((p) => p.autor_id === autorId).sort((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, 60));
    },
    async salvarPost(post) {
      await espera();
      let atual = posts.find((p) => p.id === post.id);
      if (atual) Object.assign(atual, post, { midias: atual.midias });
      else {
        atual = { midias: [], link_post: null, postado_em: null, postado_por: null, ...post, id: uid(), criado_em: new Date().toISOString() };
        posts.push(atual);
      }
      return copia(atual);
    },
    async excluirPost(post) {
      const i = posts.findIndex((p) => p.id === post.id);
      if (i >= 0) posts.splice(i, 1);
    },
    async enviarArquivo(postId, arquivo, ordem, aoProgredir) {
      for (let i = 1; i <= 10; i++) { await espera(60); aoProgredir && aoProgredir(i / 10); }
      const m = {
        id: uid(), post_id: postId, caminho: `demo/${postId}/${uid()}`, nome: arquivo.name,
        tipo: arquivo.type || 'application/octet-stream', tamanho: arquivo.size, ordem,
      };
      imagens[m.caminho] = URL.createObjectURL(arquivo);
      posts.find((p) => p.id === postId).midias.push(m);
      return copia(m);
    },
    async removerMidia(midia) {
      const p = posts.find((x) => x.id === midia.post_id);
      if (p) p.midias = p.midias.filter((m) => m.id !== midia.id);
    },
    async linkArquivo(midia) {
      const p = posts.find((x) => x.id === midia.post_id);
      const m = (p && p.midias.find((x) => x.id === midia.id)) || midia;
      return desenhar(m);
    },
    async linksVisualizacao(lista) {
      const mapa = {};
      lista.forEach((m) => {
        const p = posts.find((x) => x.id === m.post_id);
        mapa[m.caminho] = desenhar((p && p.midias.find((x) => x.id === m.id)) || m);
      });
      return mapa;
    },

    async checkins() { await espera(); return copia(checkins); },
    async salvarCheckin(c) {
      const i = checkins.findIndex((x) => x.semana === c.semana);
      const novo = { id: uid(), ...(i >= 0 ? checkins[i] : {}), ...c };
      if (i >= 0) checkins[i] = novo; else checkins.push(novo);
      checkins.sort((a, b) => a.semana.localeCompare(b.semana));
      return copia(novo);
    },
  };
};
