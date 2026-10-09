/* Utilidades: datas no fuso do computador (sempre como texto AAAA-MM-DD), textos e elementos. */
window.CAL = window.CAL || {};

CAL.datas = (() => {
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const doisDig = (n) => String(n).padStart(2, '0');

  const iso = (d) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;
  const parse = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
  const hoje = () => iso(new Date());
  const somar = (s, dias) => { const d = parse(s); d.setDate(d.getDate() + dias); return iso(d); };
  const segunda = (s) => { const d = parse(s); return somar(s, -((d.getDay() + 6) % 7)); };
  const horaAgora = () => { const d = new Date(); return `${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`; };

  return {
    DIAS, DIAS_CURTOS, MESES, iso, parse, hoje, somar, segunda, horaAgora,
    hora: (h) => (h ? h.slice(0, 5) : ''),
    diaSemana: (s) => DIAS[parse(s).getDay()],
    curto: (s) => { const d = parse(s); return `${DIAS_CURTOS[d.getDay()]}, ${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}`; },
    ddmm: (s) => { const d = parse(s); return `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}`; },
    longo: (s) => { const d = parse(s); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; },
    mesAno: (s) => { const d = parse(s); return `${MESES[d.getMonth()]} de ${d.getFullYear()}`; },
    primeiroDoMes: (s) => s.slice(0, 8) + '01',
    somarMeses: (s, n) => { const d = parse(s.slice(0, 8) + '01'); d.setMonth(d.getMonth() + n); return iso(d); },
  };
})();

CAL.esc = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

CAL.num = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR'));

CAL.FORMATOS = { reels: 'Reels', carrossel: 'Carrossel', estatico: 'Post estático', stories: 'Stories' };
// formatos de post da página da Mentorei no LinkedIn
CAL.FORMATOS_LI = { texto: 'Só texto', estatico: 'Imagem', carrossel: 'Carrossel (PDF)', video: 'Vídeo', artigo: 'Artigo' };
// mala direta (e-mails para clientes, disparados pelo RD Station)
CAL.FORMATOS_EMAIL = { email: 'E-mail com arte', html: 'E-mail em HTML', texto: 'Só texto' };
CAL.formatoDe = (p) => ((p && p.rede === 'linkedin') ? CAL.FORMATOS_LI[p.formato]
  : (p && p.rede === 'email') ? CAL.FORMATOS_EMAIL[p.formato] : CAL.FORMATOS[p.formato]) || p.formato;
CAL.STATUS = { producao: 'Em produção', pronto: 'Pronto para postar', postado: 'Postado' };
CAL.STATUS_EMAIL = { producao: 'Em produção', pronto: 'Pronto para enviar', postado: 'Enviado' };
CAL.statusDe = (p, s = p.status) => ((p && p.rede === 'email') ? CAL.STATUS_EMAIL : CAL.STATUS)[s];

CAL.tamanho = (bytes) => (bytes > 1048576 ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB'
  : Math.max(1, Math.round(bytes / 1024)) + ' KB');
