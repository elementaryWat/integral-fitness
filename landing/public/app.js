(() => {
  'use strict';

  const Q = [
    { id: 'goal', t: '¿Tu objetivo principal?', s: 'Elige uno.', o: ['Ganar músculo', 'Perder grasa', 'Recomposición (ambas)', 'Fuerza / rendimiento'] },
    { id: 'phone', t: '¿Qué móvil usas?', s: 'Hoy Wrep funciona en iPhone.', o: ['iPhone', 'Android'] },
    { id: 'watch', t: '¿Qué reloj usas?', s: 'Ahora mismo Wrep es compatible con Amazfit.', o: ['Amazfit', 'Apple Watch', 'Garmin', 'Otro reloj', 'Ninguno'] },
    { id: 'need', t: '¿Qué te interesa más?', s: 'Hasta dos.', multi: true, max: 2, o: ['Registrar series en el reloj', 'Sesiones generadas', 'Recuperación diaria', 'Escaneo de comida con IA', 'Coach IA semanal', 'Fotos y medidas'] },
    { id: 'email', t: '¿Dónde te avisamos?', s: 'Solo para el lanzamiento y tu descuento.' },
  ];
  const CAPTIONS = ['LA SESIÓN, EN VIVO DESDE EL RELOJ', 'UNA FOTO, LOS MACROS', 'TU COACH REVISA LA SEMANA'];
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const $ = (id) => document.getElementById(id);
  // Analítica (PostHog, ver analytics.js). Nunca enviamos el email.
  const trackEvent = (event, props) => window.track && window.track(event, props);
  const SLIDES = ['entreno', 'nutricion', 'coach'];

  // Por ahora no mostramos el número de la lista de espera (ni contador ni posición).

  /* ---------- Carrusel ---------- */
  const track = $('track');
  const watch = $('watch');
  const dots = [...$('dots').children];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slide = 0;
  let timer = null;

  function show(i) {
    slide = i;
    track.style.transform = `translateX(${-100 * i}%)`;
    watch.classList.toggle('off', i !== 0);
    dots.forEach((d, j) => {
      d.setAttribute('aria-current', String(j === i));
      d.setAttribute('aria-selected', String(j === i));
    });
    $('caption').textContent = CAPTIONS[i];
  }
  function startAuto() {
    clearInterval(timer);
    if (!reduced) timer = setInterval(() => show((slide + 1) % 3), 4500);
  }
  dots.forEach((d, i) => d.addEventListener('click', () => {
    show(i);
    startAuto();
    trackEvent('carousel_slide_selected', { slide: SLIDES[i] });
  }));
  document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : startAuto()));

  // Deslizar con el dedo sobre el móvil
  let x0 = null;
  track.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) { show((slide + (dx < 0 ? 1 : 2)) % 3); startAuto(); }
  });

  show(0);
  startAuto();

  /* ---------- Lista de espera ---------- */
  const overlay = $('overlay');
  const emailInput = $('email');
  const nextBtn = $('next');
  let st = null;
  let lastFocus = null;
  let pickTimer = null;

  function openWith(plan, source) {
    st = { plan, source, step: 0, ans: {}, sending: false, done: false };
    trackEvent('waitlist_opened', { plan, source });
    lastFocus = document.activeElement;
    emailInput.value = '';
    setEmailError('');
    $('survey').hidden = false;
    $('done').hidden = true;
    const prem = plan === 'premium';
    $('plan-tag').textContent = prem ? 'PREMIUM · −75% RESERVADO' : 'PLAN GRATIS';
    $('plan-tag').style.color = prem ? 'var(--lime)' : 'var(--mute)';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    render();
    $('close').focus();
  }

  function close() {
    clearTimeout(pickTimer);
    if (st && !st.done) {
      trackEvent('waitlist_abandoned', { plan: st.plan, source: st.source, step: st.step + 1, question: Q[st.step].id });
    }
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  function answered() {
    const q = Q[st.step];
    if (q.id === 'email') return true;
    const a = st.ans[q.id];
    return q.multi ? !!a && a.length > 0 : !!a;
  }

  function setEmailError(msg) {
    $('email-msg').textContent = msg;
    emailInput.classList.toggle('err', !!msg);
  }

  function render() {
    const q = Q[st.step];
    $('progress').innerHTML = Q.map((_, i) => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('');
    $('step-text').textContent = `${st.step + 1} / ${Q.length}`;
    $('q-title').textContent = q.t;
    $('q-sub').textContent = q.s;

    const isEmail = q.id === 'email';
    $('email-form').hidden = !isEmail;
    const opts = $('opts');
    opts.hidden = isEmail;
    opts.textContent = '';
    if (!isEmail) {
      const sel = q.multi ? st.ans[q.id] || [] : [st.ans[q.id]];
      q.o.forEach((v) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = v;
        b.setAttribute('aria-pressed', String(sel.includes(v)));
        b.addEventListener('click', () => pick(q, v));
        opts.appendChild(b);
      });
    } else {
      setTimeout(() => emailInput.focus(), 0);
    }

    $('back').disabled = st.step === 0;
    nextBtn.textContent = st.sending ? 'Enviando…' : isEmail ? 'Unirme' : 'Siguiente';
    nextBtn.classList.toggle('idle', !answered());
    nextBtn.disabled = st.sending;
  }

  function pick(q, v) {
    if (q.multi) {
      const cur = st.ans[q.id] || [];
      if (cur.includes(v)) st.ans[q.id] = cur.filter((x) => x !== v);
      else if (cur.length < q.max) st.ans[q.id] = [...cur, v];
      else st.ans[q.id] = [...cur.slice(1), v];
      render();
    } else {
      st.ans[q.id] = v;
      render();
      stepDone(q);
      clearTimeout(pickTimer);
      pickTimer = setTimeout(() => {
        st.step = Math.min(st.step + 1, Q.length - 1);
        render();
      }, 180);
    }
  }

  function stepDone(q) {
    trackEvent('waitlist_step_completed', { plan: st.plan, step: Q.indexOf(q) + 1, question: q.id, answer: st.ans[q.id] });
  }

  async function next() {
    const q = Q[st.step];
    if (q.id !== 'email') {
      if (answered()) {
        if (q.multi) stepDone(q);
        st.step += 1;
        render();
      }
      return;
    }
    const email = emailInput.value.trim();
    if (!EMAIL_RE.test(email)) { setEmailError('Introduce un email válido'); return; }
    st.sending = true;
    render();
    try {
      const r = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...st.ans, email, plan: st.plan }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar. Inténtalo de nuevo.');
      st.done = true;
      const { goal, phone, watch, need } = st.ans;
      trackEvent('waitlist_joined', { plan: st.plan, source: st.source, goal, phone, watch, need, existing: !!d.existing });
      $('done-text').textContent = st.plan === 'premium'
        ? `Tu 75% de descuento queda reservado para el primer año de Premium. Te escribiremos a ${email} antes del lanzamiento.`
        : `Te escribiremos a ${email} cuando abramos el acceso. Podrás pasar a Premium con el 75% de descuento hasta el lanzamiento.`;
      $('survey').hidden = true;
      $('done').hidden = false;
      $('done-close').focus();
    } catch (err) {
      trackEvent('waitlist_error', { plan: st.plan, error: err.message });
      setEmailError(err.message === 'Failed to fetch' ? 'Sin conexión. Inténtalo de nuevo.' : err.message);
    } finally {
      st.sending = false;
      if (!$('survey').hidden) render();
    }
  }

  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openWith(b.dataset.open, b.dataset.source)));
  $('close').addEventListener('click', close);
  $('done-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  $('back').addEventListener('click', () => { clearTimeout(pickTimer); st.step = Math.max(0, st.step - 1); render(); });
  nextBtn.addEventListener('click', next);
  $('email-form').addEventListener('submit', (e) => { e.preventDefault(); next(); });
  emailInput.addEventListener('input', () => setEmailError(''));
  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...overlay.querySelectorAll('button:not([disabled]),input')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
