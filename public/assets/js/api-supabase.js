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
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico')
        .gte('data', de).lte('data', ate).order('data').order('hora', { nullsFirst: false });
      falhou(error);
      return ordenarMidias(data);
    },
    async caixa() {
      const { data, error } = await sb.from('cal_posts').select(COM_MIDIAS).eq('tipo', 'organico')
        .or('data.is.null,hora.is.null').neq('status', 'postado').order('criado_em', { ascending: false });
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
      falhou(error);
      return ordenarMidias([data])[0];
    },
    async excluirPost(post) {
      const caminhos = (post.midias || []).map((m) => m.caminho);
      if (caminhos.length) await sb.storage.from(cfg.bucket).remove(caminhos);
      const { error } = await sb.from('cal_posts').delete().eq('id', post.id);
      falhou(error);
    },

    // Envio com barra de progresso (XHR direto na API do Storage).
    async enviarArquivo(postId, arquivo, ordem, aoProgredir) {
      const { data: { session } } = await sb.auth.getSession();
      const caminho = `posts/${postId}/${Date.now()}-${nomeSeguro(arquivo.name)}`;
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
