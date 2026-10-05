/* Gráficos simples em SVG (linha e barras), com dica ao passar o dedo ou o mouse.
   Uma série por gráfico, sem legenda: o título do cartão diz o que é. */
window.CAL = window.CAL || {};

CAL.graficos = (() => {
  const L = 640, A = 240, M = { t: 16, r: 16, b: 30, l: 52 };
  const larg = L - M.l - M.r, alt = A - M.t - M.b;

  function escala(valores, comZero) {
    let min = comZero ? 0 : Math.min(...valores), max = Math.max(...valores);
    if (min === max) { min = comZero ? 0 : min * 0.95; max = max * 1.05 || 1; }
    const passo = Math.pow(10, Math.floor(Math.log10((max - min) / 4 || 1)));
    const nice = [1, 2, 2.5, 5, 10].map((f) => f * passo).find((p) => (max - min) / p <= 5) || passo * 10;
    const lo = comZero ? 0 : Math.floor(min / nice) * nice, hi = Math.ceil(max / nice) * nice;
    const marcas = [];
    for (let v = lo; v <= hi + 1e-9; v += nice) marcas.push(v);
    return { lo, hi, marcas, y: (v) => M.t + alt - ((v - lo) / (hi - lo || 1)) * alt };
  }

  const curtoNum = (v) => (v >= 10000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : v.toLocaleString('pt-BR'));

  function moldura(el, pontos, e, desenharMarcas, rotuloAria) {
    const passoX = larg / pontos.length;
    const grade = e.marcas.map((v) => `<line x1="${M.l}" x2="${L - M.r}" y1="${e.y(v)}" y2="${e.y(v)}" class="g-grade"/>`
      + `<text x="${M.l - 8}" y="${e.y(v) + 4}" class="g-eixo" text-anchor="end">${curtoNum(v)}</text>`).join('');
    const pularRotulo = pontos.length > 8 ? 2 : 1;
    const rotulos = pontos.map((p, i) => (i % pularRotulo && i !== pontos.length - 1) ? ''
      : `<text x="${M.l + passoX * (i + 0.5)}" y="${A - 8}" class="g-eixo" text-anchor="middle">${CAL.esc(p.rotulo)}</text>`).join('');
    const alvos = pontos.map((_, i) => `<rect class="g-alvo" data-i="${i}" x="${M.l + passoX * i}" y="${M.t}" width="${passoX}" height="${alt}"/>`).join('');
    el.innerHTML = `<div class="grafico"><svg viewBox="0 0 ${L} ${A}" role="img" aria-label="${CAL.esc(rotuloAria)}">`
      + grade + `<line x1="${M.l}" x2="${L - M.r}" y1="${M.t + alt}" y2="${M.t + alt}" class="g-base"/>`
      + desenharMarcas(passoX) + rotulos + `<line class="g-mira" y1="${M.t}" y2="${M.t + alt}" hidden/>` + alvos
      + `</svg><div class="g-dica" hidden></div></div>`;

    const svg = el.querySelector('svg'), dica = el.querySelector('.g-dica'), mira = el.querySelector('.g-mira');
    const mostrar = (i) => {
      const p = pontos[i], x = M.l + passoX * (i + 0.5);
      mira.setAttribute('x1', x); mira.setAttribute('x2', x); mira.hidden = false;
      el.querySelectorAll('[data-ponto]').forEach((n) => n.classList.toggle('ativo', +n.dataset.ponto === i));
      dica.innerHTML = `<strong>${CAL.esc(p.dica || p.rotulo)}</strong><span>${CAL.esc(p.texto)}</span>`;
      dica.hidden = false;
      const caixa = svg.getBoundingClientRect(), px = (x / L) * caixa.width;
      dica.style.left = Math.min(Math.max(px, 70), caixa.width - 70) + 'px';
    };
    const esconder = () => { dica.hidden = true; mira.hidden = true; el.querySelectorAll('.ativo').forEach((n) => n.classList.remove('ativo')); };
    el.querySelectorAll('.g-alvo').forEach((r) => {
      r.addEventListener('mouseenter', () => mostrar(+r.dataset.i));
      r.addEventListener('click', () => mostrar(+r.dataset.i));
    });
    svg.addEventListener('mouseleave', esconder);
  }

  function linha(el, pontos, rotuloAria) {
    if (!pontos.length) { el.innerHTML = '<p class="vazio">Ainda sem dados.</p>'; return; }
    const e = escala(pontos.map((p) => p.valor), false);
    moldura(el, pontos, e, (passoX) => {
      const xy = pontos.map((p, i) => [M.l + passoX * (i + 0.5), e.y(p.valor)]);
      return `<polyline class="g-linha" points="${xy.map((c) => c.join(',')).join(' ')}"/>`
        + xy.map(([x, y], i) => `<circle data-ponto="${i}" class="g-ponto${i === xy.length - 1 ? ' ultimo' : ''}" cx="${x}" cy="${y}" r="4.5"/>`).join('');
    }, rotuloAria);
  }

  function barras(el, pontos, rotuloAria) {
    if (!pontos.length) { el.innerHTML = '<p class="vazio">Ainda sem dados.</p>'; return; }
    const e = escala(pontos.map((p) => p.valor), true);
    moldura(el, pontos, e, (passoX) => pontos.map((p, i) => {
      const w = Math.min(36, passoX * 0.6), x = M.l + passoX * (i + 0.5) - w / 2;
      const y = e.y(p.valor), h = Math.max(0, M.t + alt - y), r = Math.min(4, h / 2, w / 2);
      // barra com cantos arredondados só em cima, apoiada na linha de base
      return `<path data-ponto="${i}" class="g-barra" d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z"/>`;
    }).join(''), rotuloAria);
  }

  return { linha, barras };
})();
