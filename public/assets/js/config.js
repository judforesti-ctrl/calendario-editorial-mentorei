/* Configuração do Calendário Editorial Mentorei.
   Enquanto supabaseChave estiver vazia, o site abre em MODO DEMONSTRAÇÃO (dados de exemplo, nada é salvo). */
window.CAL = window.CAL || {};

CAL.config = {
  supabaseUrl: 'https://ywdkpmwdgsjhepaxehpo.supabase.co',
  // Chave PUBLICÁVEL do Supabase (Project Settings → API Keys → "Publishable key", começa com sb_publishable_).
  // Ela pode ficar no navegador: quem protege os dados são as regras do arquivo supabase/01-calendario.sql.
  supabaseChave: 'sb_publishable__BVQtBJeU8QVptidRX2PkA_o3svbqzA',
  bucket: 'calendario',

  // Cabeçalho da simulação do feed ("Ver feed"). Ajuste quando a bio do Instagram mudar.
  perfil: {
    usuario: 'mentorei_',
    nome: 'Mentorei',
    avatarLetra: 'M',
    bio: 'Desenvolvemos líderes, equipes e negócios em cooperativas e empresas de todo o Brasil. Gente, negócio e números.',
    link: 'radardalideranca.netlify.app',
  },
  limiteArquivoMB: 50,

  // Horários padrão de postagem por dia da semana (0 = domingo ... 6 = sábado).
  // Horário sem post aparece como "horário livre" no calendário.
  // LinkedIn (página da Mentorei): terça, quarta e quinta de manhã costumam ter mais alcance
  horariosLinkedin: { 2: ['08:30'], 3: ['08:30'], 4: ['08:30'] },

  horarios: {
    0: [],
    1: ['09:00', '12:30', '19:00'],
    2: ['09:00', '12:30', '19:00'],
    3: ['09:00', '12:30', '19:00'],
    4: ['09:00', '12:30', '19:00'],
    5: ['09:00', '12:30', '19:00'],
    6: ['10:00'],
  },
};

CAL.config.demo = !CAL.config.supabaseChave || /[?&]demo\b/.test(location.search);
