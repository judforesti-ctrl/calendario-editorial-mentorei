/* Acesso aos dados de verdade (Supabase): login, posts, arquivos e check-ins.
   O modo demonstração (api-demo.js) tem exatamente as mesmas funções. */
window.CAL = window.CAL || {};

CAL.criarApiSupabase = function (cfg) {
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseChave, {
    auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' },
  });
  const COM_MIDIAS = '*, midias:cal_midias(*)';

  const falhou = (error) => { if (error) throw new Error(error.message || 'Erro ao falar com o servidor.'); };
  const ordenarMidias = (posts) => {
    (posts || []).forEach((p) => (p.midias || []).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)));
    return posts || [];
  };
  const nomeSeguro = (nome) => nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-80);

  // Envio com barra de progresso (XHR direto na API do Storage).
  async function subir(caminho, arquivo, aoProgredir) {
    const { data: { session } } = await sb.auth.getSession();
    await new Promise((ok, erro) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${cfg.supabaseUrl}/storage/v1/object/${cfg.bucket}/${caminho}`);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('apikey', cfg.supabaseChave);
      xhr.setRequestHeader('Content-Type', arquivo.type || 'application/octet-stream');
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => e.lengthComputable && aoProgredir && aoProgredir(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? ok() : erro(new Error(
        xhr.status === 413 ? `O arquivo "${arquivo.name}" passa do limite de ${cfg.limiteArquivoMB} MB.`
          : `Não consegui enviar "${arquivo.name}" (erro ${xhr.status}).`)));
      xhr.onerror = () => erro(new Error(`A conexão caiu ao enviar "${arquivo.name}". Tente de novo.`));
      xhr.send(arquivo);
    });
  }

  return {
    demo: false,

    async iniciar(aoMudar) {
      sb.auth.onAuthStateChange((evento, sessao) => aoMudar(evento, sessao));
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    async entrar(email, senha) {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message);
    },
    async sair() { await sb.auth.signOut(); },
    async esqueciSenha(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
      falhou(error);
    },
    async definirSenha(senha) {
      const { error } = await sb.auth.updateUser({ password: senha });
      falhou(error);
    },

    async meuPerfil() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const { data, error } = await sb.from('cal_perfis').select('*').eq('id', user.id).maybeSingle();
      falhou(error);
      return data ? { ...data, email: user.email } : { id: user.id, email: user.email, papel: null };
    },
    async perfis() {
      const { data, error } = await sb.from('cal_perfis').select('id, nome, papel');
      falhou(error);
      return data;
    },

    async posts(de, ate) {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico').eq('rede', 'instagram')
        .gte('data', de).lte('data', ate).order('data').order('hora', { nullsFirst: false });
      falhou(error);
      return ordenarMidias(data);
    },
    async caixa() {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico').eq('rede', 'instagram')
        .or('data.is.null,hora.is.null').neq('status', 'postado').order('criado_em', { ascending: false });
      falhou(error);
      return ordenarMidias(data);
    },
    // ---------- LinkedIn (página da Mentorei) ----------
    async postsLinkedin(de, ate) {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico').eq('rede', 'linkedin')
        .gte('data', de).lte('data', ate).order('data').order('hora', { nullsFirst: false });
      falhou(error);
      return ordenarMidias(data);
    },
    async caixaLinkedin() {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico').eq('rede', 'linkedin')
        .or('data.is.null,hora.is.null').neq('status', 'postado').order('criado_em', { ascending: false });
      falhou(error);
      return ordenarMidias(data);
    },
    async checkinsLinkedin() {
      const { data, error } = await sb.from('cal_checkins_linkedin').select('*').order('semana');
      falhou(error);
      return data;
    },
    async salvarCheckinLinkedin(checkin) {
      const { data, error } = await sb.from('cal_checkins_linkedin').upsert(checkin, { onConflict: 'semana' }).select().single();
      falhou(error);
      return data;
    },
    // ---------- Mala direta (e-mails para clientes, disparados pelo RD Station) ----------
    async postsEmail(de, ate) {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico').eq('rede', 'email')
        .gte('data', de).lte('data', ate).order('data').order('hora', { nullsFirst: false });
      falhou(error);
      return ordenarMidias(data);
    },
    async caixaEmail() {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico').eq('rede', 'email')
        .is('data', null).neq('status', 'postado').order('criado_em', { ascending: false });
      falhou(error);
      return ordenarMidias(data);
    },

    async anuncios() {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'anuncio')
        .order('criado_em', { ascending: false });
      falhou(error);
      return ordenarMidias(data);
    },
    async meusEnvios(autorId) {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS)
        .eq('autor_id', autorId).order('criado_em', { ascending: false }).limit(60);
      falhou(error);
      return ordenarMidias(data);
    },

    async salvarPost(post) {
      const { id, midias, ...campos } = post;
      const consulta = id
        ? sb.from('cal_posts').update(campos).eq('id', id)
        : sb.from('cal_posts').insert(campos);
      const { data, error } = await consulta.select(COM_MIDIAS).single();
      if (error && /cal_posts_(rede|formato)_check|'email' column/.test(error.message)) {
        throw new Error('A Mala direta ainda não foi ligada no banco de dados: falta rodar o script supabase/05-mala-direta.sql.');
      }
      falhou(error);
      return ordenarMidias([data])[0];
    },
    async excluirPost(post) {
      const caminhos = (post.midias || []).map((m) => m.caminho);
      if (caminhos.length) await sb.storage.from(cfg.bucket).remove(caminhos);
      const { error } = await sb.from('cal_posts').delete().eq('id', post.id);
      falhou(error);
    },

    // posts que aparecem na grade do perfil até a data escolhida (stories não entram na grade)
    async feed(ate) {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico').eq('rede', 'instagram')
        .in('formato', ['carrossel', 'estatico', 'reels']).not('data', 'is', null).lte('data', ate)
        .order('data', { ascending: false }).order('hora', { ascending: false, nullsFirst: false }).limit(120);
      falhou(error);
      return ordenarMidias(data);
    },

    async destaques() {
      const { data, error } = await sb.from('cal_destaques').select('*, stories:cal_posts(*, midias:cal_midias(*))')
        .order('ordem').order('criado_em');
      falhou(error);
      (data || []).forEach((d) => { d.stories = ordenarMidias(d.stories || []); });
      return data || [];
    },
    async salvarDestaque(destaque) {
      const { id, stories, ...campos } = destaque;
      const consulta = id ? sb.from('cal_destaques').update(campos).eq('id', id) : sb.from('cal_destaques').insert(campos);
      const { data, error } = await consulta.select().single();
      falhou(error);
      return data;
    },
    async excluirDestaque(destaque) {
      if (destaque.capa) await sb.storage.from(cfg.bucket).remove([destaque.capa]);
      const { error } = await sb.from('cal_destaques').delete().eq('id', destaque.id);
      falhou(error);
    },
    async enviarCapaDestaque(destaqueId, arquivo, aoProgredir) {
      const caminho = `destaques/${destaqueId}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
      await subir(caminho, arquivo, aoProgredir);
      return caminho;
    },

    // ---------- pasta de arquivos da equipe (fotos e vídeos soltos, fora dos posts) ----------
    // Fica em arquivos/<pasta>/ no Storage. Pasta vazia guarda um arquivo ".pasta" para existir.
    async pastasArquivos() {
      const { data, error } = await sb.storage.from(cfg.bucket).list('arquivos', { limit: 200, sortBy: { column: 'name', order: 'asc' } });
      falhou(error);
      return (data || []).filter((i) => !i.id).map((i) => i.name);
    },
    async arquivosDaPasta(pasta) {
      const { data, error } = await sb.storage.from(cfg.bucket).list(`arquivos/${pasta}`, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
      falhou(error);
      return (data || []).filter((i) => i.id && i.name !== '.pasta').map((i) => ({
        caminho: `arquivos/${pasta}/${i.name}`, nome: i.name.replace(/^\d{10,}-/, ''),
        tipo: (i.metadata && i.metadata.mimetype) || '', tamanho: (i.metadata && i.metadata.size) || 0, criado_em: i.created_at,
      }));
    },
    async criarPasta(pasta) {
      await subir(`arquivos/${pasta}/.pasta`, new Blob([''], { type: 'text/plain' }));
    },
    async enviarParaPasta(pasta, arquivo, aoProgredir) {
      const caminho = `arquivos/${pasta}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
      await subir(caminho, arquivo, aoProgredir);
      return caminho;
    },
    async apagarArquivos(caminhos) {
      const { error } = await sb.storage.from(cfg.bucket).remove(caminhos);
      falhou(error);
    },
    // copia um arquivo da pasta para dentro de um post (o original continua na pasta)
    async copiarParaPost(postId, arquivo, ordem) {
      const caminho = `posts/${postId}/${Date.now()}-${nomeSeguro(arquivo.nome)}`;
      const { error: erroCopia } = await sb.storage.from(cfg.bucket).copy(arquivo.caminho, caminho);
      falhou(erroCopia);
      const { data, error } = await sb.from('cal_midias').insert({
        post_id: postId, caminho, nome: arquivo.nome, tipo: arquivo.tipo || 'application/octet-stream', tamanho: arquivo.tamanho, ordem,
      }).select().single();
      falhou(error);
      return data;
    },

    async enviarArquivo(postId, arquivo, ordem, aoProgredir) {
      const caminho = `posts/${postId}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
      await subir(caminho, arquivo, aoProgredir);
      const { data, error } = await sb.from('cal_midias').insert({
        post_id: postId, caminho, nome: arquivo.name, tipo: arquivo.type || 'application/octet-stream',
        tamanho: arquivo.size, ordem,
      }).select().single();
      falhou(error);
      return data;
    },
    async removerMidia(midia) {
      await sb.storage.from(cfg.bucket).remove([midia.caminho]);
      const { error } = await sb.from('cal_midias').delete().eq('id', midia.id);
      falhou(error);
    },
    // Links temporários (1 hora). Com "baixarComo", o navegador baixa o arquivo com esse nome.
    async linkArquivo(midia, baixarComo) {
      const { data, error } = await sb.storage.from(cfg.bucket)
        .createSignedUrl(midia.caminho, 3600, baixarComo ? { download: baixarComo } : undefined);
      falhou(error);
      return data.signedUrl;
    },
    async linksVisualizacao(midias) {
      if (!midias.length) return {};
      const { data, error } = await sb.storage.from(cfg.bucket).createSignedUrls(midias.map((m) => m.caminho), 3600);
      falhou(error);
      const mapa = {};
      data.forEach((d) => { if (d.signedUrl) mapa[d.path] = d.signedUrl; });
      return mapa;
    },

    async checkins() {
      const { data, error } = await sb.from('cal_checkins').select('*').order('semana');
      falhou(error);
      return data;
    },
    async salvarCheckin(checkin) {
      const { data, error } = await sb.from('cal_checkins')
        .upsert(checkin, { onConflict: 'semana' }).select().single();
      falhou(error);
      return data;
    },
  };
};
