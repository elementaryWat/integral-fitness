// Recomp on the wrist: shows the current set of the session started in the phone app, logs
// load / reps / RPE with a few taps, runs the rest timer (ends on time or when the heart rate
// recovers) with vibration, and syncs every set through the side service → relay → phone.
import { BasePage } from '@zeppos/zml/base-page'
import { align, createWidget, prop, text_style, widget } from '@zos/ui'
import { Accelerometer, FREQ_MODE_NORMAL, HeartRate, Sleep, Step, Vibrator, VIBRATOR_SCENE_SHORT_MIDDLE, VIBRATOR_SCENE_STRONG_REMINDER } from '@zos/sensor'
import { pauseDropWristScreenOff, resetDropWristScreenOff, resetPageBrightTime, setPageBrightTime } from '@zos/display'
import { localStorage } from '@zos/storage'
import { px } from '@zos/utils'
import { adjustLoad, adjustReps, enqueue, loadLabel, mmss, nextPending, RepDetector, repsLabel, restAfter, restEnd, RPES } from '../shared/logic'

const C = { bg: 0x000000, text: 0xf4f5f0, lime: 0xc8f53c, muted: 0x9a9e95, dim: 0x5f635c, coral: 0xff7a5c, chip: 0x1a1b1a, chipPress: 0x2a2c2a, dark: 0x050505 }
const W = 390

const heart = new HeartRate()
const accel = new Accelerometer()
const vibrator = new Vibrator()
const steps = new Step()
const sleep = new Sleep()

// ---------- tiny widget helpers (design units are px of a 390-wide screen) ----------
function text(o) {
  return createWidget(widget.TEXT, {
    x: px(o.x ?? 16), y: px(o.y), w: px(o.w ?? W - 32), h: px(o.h ?? 40),
    text: o.text ?? '', color: o.color ?? C.text, text_size: px(o.size ?? 24),
    align_h: o.align ?? align.CENTER_H, align_v: align.CENTER_V,
    text_style: o.wrap ? text_style.WRAP : text_style.ELLIPSIS,
  })
}
function button(o) {
  return createWidget(widget.BUTTON, {
    x: px(o.x), y: px(o.y), w: px(o.w), h: px(o.h), radius: px(o.r ?? 16),
    normal_color: o.bg ?? C.chip, press_color: o.press ?? C.chipPress,
    text: o.text, text_size: px(o.size ?? 30), color: o.color ?? C.text,
    click_func: o.onClick,
  })
}
const pad = (n) => String(n).padStart(2, '0')
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const setText = (w, t, extra) => w.setProperty(prop.MORE, { text: t, ...(extra || {}) })

// Widget refs, screens and handles live outside the page state (they are not data).
/** @type {Record<string, any>} */
const ui = {}
/** @type {Record<'set' | 'rest' | 'info', any[]>} */
const screens = { set: [], rest: [], info: [] }
/** @type {any} */
let timer = 0
let flushing = false
let onHr = () => {}
let onAccel = () => {}

Page(
  BasePage({
    state: {
      mode: 'loading',
      session: null,
      queue: [],
      done: [],
      i: -1,
      cur: { load: 0, reps: 0, rpe: 8 },
      restSec: 90,
      threshold: 112,
      setStart: 0,
      restStart: 0,
      rest: { target: 90, hrRule: true },
      next: -1,
      hr: 0,
      peak: 0,
      rep: null,
      logged: {},
      outbox: [],
      ticks: 0,
    },

    onInit() {
      setPageBrightTime({ brightTime: 600000 })
      pauseDropWristScreenOff({ duration: 0 })
      try {
        const raw = /** @type {any} */ (localStorage.getItem('outbox', '[]'))
        this.state.outbox = JSON.parse(raw || '[]') || []
      } catch (e) {
        this.state.outbox = []
      }
      onHr = () => {
        const v = heart.getCurrent()
        if (v > 0) {
          this.state.hr = v
          if (this.state.mode === 'set' && v > this.state.peak) this.state.peak = v
        }
      }
      heart.onCurrentChange(onHr)
      onAccel = () => {
        const a = accel.getCurrent()
        if (this.state.rep) this.state.rep.push(a.x, a.y, a.z, Date.now())
      }
      accel.setFreqMode(FREQ_MODE_NORMAL)
    },

    build() {
      this.buildSetScreen()
      this.buildRestScreen()
      this.buildInfoScreen()
      this.show('info')
      setText(ui.infoTitle, 'CONECTANDO…')
      setText(ui.infoBody, 'Buscando la sesión de hoy en Recomp')
      timer = setInterval(() => this.tick(), 1000)
      this.loadSession()
      this.sendDaily()
    },

    onDestroy() {
      clearInterval(timer)
      heart.offCurrentChange(onHr)
      this.stopAccel()
      resetPageBrightTime()
      resetDropWristScreenOff()
    },

    // ---------- screens ----------
    buildSetScreen() {
      const s = screens.set
      s.push((ui.setHeader = text({ y: 8, h: 30, size: 20, color: C.lime })))
      s.push((ui.setName = text({ y: 38, h: 72, size: 30, wrap: true })))
      // load row
      s.push(button({ x: 16, y: 116, w: 72, h: 64, text: '−', onClick: () => this.adjust('load', -1) }))
      s.push((ui.setLoad = text({ x: 92, y: 116, w: 206, h: 64, size: 34 })))
      s.push(button({ x: 302, y: 116, w: 72, h: 64, text: '+', onClick: () => this.adjust('load', 1) }))
      // reps row
      s.push(button({ x: 16, y: 188, w: 72, h: 64, text: '−', onClick: () => this.adjust('reps', -1) }))
      s.push((ui.setReps = text({ x: 92, y: 188, w: 206, h: 64, size: 34 })))
      s.push(button({ x: 302, y: 188, w: 72, h: 64, text: '+', onClick: () => this.adjust('reps', 1) }))
      // RPE chips + selection ring
      RPES.forEach((r, k) => s.push(button({ x: 16 + k * 92, y: 262, w: 84, h: 52, r: 12, text: `${r}`, size: 26, onClick: () => this.setRpe(r) })))
      s.push((ui.rpeRing = createWidget(widget.STROKE_RECT, { x: px(16), y: px(262), w: px(84), h: px(52), radius: px(12), line_width: px(3), color: C.lime, angle: 0, id: 'rpe-ring' })))
      s.push((ui.setHr = text({ x: 16, y: 320, w: 179, h: 34, size: 20, color: C.muted, align: align.LEFT })))
      s.push((ui.setRir = text({ x: 195, y: 320, w: 179, h: 34, size: 20, color: C.muted, align: align.RIGHT })))
      s.push(button({ x: 16, y: 360, w: 358, h: 74, r: 37, text: 'HECHO', size: 34, bg: C.lime, press: 0xa9d12c, color: C.dark, onClick: () => this.finishSet() }))
    },

    buildRestScreen() {
      const s = screens.rest
      s.push((ui.restTitle = text({ y: 12, h: 34, size: 22, color: C.muted })))
      s.push((ui.restClock = text({ y: 52, h: 130, size: 110 })))
      s.push((ui.restHr = text({ y: 186, h: 40, size: 26, color: C.lime })))
      s.push(text({ y: 236, h: 28, size: 18, color: C.dim, text: 'SIGUIENTE' }))
      s.push((ui.restNext = text({ y: 264, h: 40, size: 26 })))
      s.push((ui.restNextLoad = text({ y: 304, h: 34, size: 22, color: C.muted })))
      s.push(button({ x: 16, y: 360, w: 358, h: 74, r: 37, text: 'EMPEZAR YA', size: 30, onClick: () => this.endRest('skip') }))
    },

    buildInfoScreen() {
      const s = screens.info
      s.push((ui.infoTitle = text({ y: 90, h: 50, size: 32, color: C.lime })))
      s.push((ui.infoBody = text({ y: 150, h: 150, size: 24, wrap: true, color: C.text })))
      s.push((ui.infoBtn = button({ x: 16, y: 360, w: 358, h: 74, r: 37, text: 'REINTENTAR', size: 28, onClick: () => this.loadSession() })))
    },

    show(name) {
      for (const k of /** @type {Array<'set' | 'rest' | 'info'>} */ (['set', 'rest', 'info'])) for (const w of screens[k]) w.setProperty(prop.VISIBLE, k === name)
    },

    info(title, body, mode) {
      this.state.mode = mode
      this.stopAccel()
      this.show('info')
      setText(ui.infoTitle, title)
      setText(ui.infoBody, body)
    },

    // ---------- session sync ----------
    loadSession() {
      this.request({ method: 'session.get', params: {} })
        .then((r) => this.applySession(r))
        .catch(() => this.info('SIN CONEXIÓN', 'No llego al móvil. Abre la app Zepp y acerca el teléfono.', 'offline'))
    },

    applySession(r) {
      if (!r || r.error === 'config') return this.info('CONFIGURA', 'App Zepp → Perfil → Recomp → Ajustes: pon la URL del servidor y el código que ves en Recomp.', 'config')
      if (r.error) return this.info('SIN SERVIDOR', 'El móvil no llega al servidor de Recomp. ¿Está encendido y en la misma red?', 'offline')
      if (!r.session) return this.info('SIN SESIÓN', 'Empieza la sesión en Recomp (pestaña Entreno) y aparecerá aquí.', 'empty')
      const st = this.state
      const fresh = !st.session || st.session.id !== r.session.id
      st.session = r.session
      st.queue = r.session.queue || []
      st.restSec = r.session.restSec || 90
      st.threshold = r.session.hrThreshold || 112
      st.done = [...new Set([...(fresh ? [] : st.done), ...(r.doneQis || [])])]
      if (fresh) st.logged = {}
      if (fresh || st.mode === 'empty' || st.mode === 'offline' || st.mode === 'config' || st.mode === 'loading') {
        const i = nextPending(st.queue, st.done, 0)
        if (i < 0) return this.finishSession()
        this.startSet(i)
      }
    },

    flush() {
      const st = this.state
      if (!st.outbox.length || flushing) return
      flushing = true
      const entry = st.outbox[0]
      this.request({ method: 'set.post', params: entry })
        .then((r) => {
          flushing = false
          if (r && (r.ok || r.status === 409 || r.status === 400)) {
            st.outbox = st.outbox.filter((e) => e !== entry)
            this.saveOutbox()
            if (r.doneQis && st.session && entry.sessionId === st.session.id) st.done = [...new Set([...st.done, ...r.doneQis])]
            this.flush()
          }
        })
        .catch(() => {
          flushing = false
        })
    },

    send(log) {
      const st = this.state
      st.outbox = enqueue(st.outbox, { sessionId: st.session.id, log })
      this.saveOutbox()
      this.flush()
    },

    saveOutbox() {
      localStorage.setItem('outbox', JSON.stringify(this.state.outbox))
    },

    // ---------- set ----------
    startSet(i) {
      const st = this.state
      const item = st.queue[i]
      const prev = st.logged[item.exerciseId]
      st.i = i
      st.mode = 'set'
      st.cur = prev ? { load: prev.load, reps: prev.reps, rpe: prev.rpe } : { load: item.load, reps: item.reps, rpe: 8 }
      st.setStart = Date.now()
      st.peak = st.hr
      st.rep = new RepDetector()
      accel.onChange(onAccel)
      accel.start()
      this.show('set')
      setText(ui.setHeader, `${item.block}${item.pos} · SERIE ${item.set}/${item.sets}`)
      setText(ui.setName, item.name)
      this.renderSet()
    },

    renderSet() {
      const st = this.state
      const item = st.queue[st.i]
      setText(ui.setLoad, item.loadMode === 'tiempo' ? '—' : loadLabel(item, st.cur.load), { color: item.step ? C.text : C.muted })
      setText(ui.setReps, repsLabel(item, st.cur.reps))
      ui.rpeRing.setProperty(prop.MORE, { x: px(16 + RPES.indexOf(st.cur.rpe) * 92), y: px(262), w: px(84), h: px(52) })
      setText(ui.setRir, `RPE ${st.cur.rpe} · RIR ${10 - st.cur.rpe}`)
      this.renderHr()
    },

    renderHr() {
      const st = this.state
      if (st.mode === 'set') setText(ui.setHr, st.hr ? `♥ ${st.hr} · ${mmss((Date.now() - st.setStart) / 1000)}` : `♥ — · ${mmss((Date.now() - st.setStart) / 1000)}`)
    },

    adjust(field, dir) {
      const st = this.state
      const item = st.queue[st.i]
      if (field === 'load') st.cur.load = adjustLoad(item, st.cur.load, dir)
      else st.cur.reps = adjustReps(item, st.cur.reps, dir)
      this.renderSet()
    },

    setRpe(r) {
      this.state.cur.rpe = r
      this.renderSet()
    },

    stopAccel() {
      accel.offChange(onAccel)
      accel.stop()
    },

    finishSet() {
      const st = this.state
      if (st.mode !== 'set') return
      this.stopAccel()
      const item = st.queue[st.i]
      const log = {
        id: `${st.session.id}-${item.qi}`,
        qi: item.qi,
        exerciseId: item.exerciseId,
        block: item.block,
        load: st.cur.load,
        reps: st.cur.reps,
        rpe: st.cur.rpe,
        startedAt: st.setStart,
        endedAt: Date.now(),
        hrPeak: st.peak || undefined,
        velocityLoss: st.rep ? st.rep.velocityLoss() : undefined,
      }
      st.rep = null
      st.logged[item.exerciseId] = log
      st.done = [...new Set([...st.done, item.qi])]
      this.send(log)
      vibrator.start({ mode: VIBRATOR_SCENE_SHORT_MIDDLE })

      // HRR-60: heart-rate drop one minute after the set, sent as an update of the same log.
      const hrEnd = st.hr
      const sessionId = st.session.id
      setTimeout(() => {
        if (hrEnd > 0 && this.state.hr > 0 && this.state.session && this.state.session.id === sessionId) {
          this.send({ ...log, hrr60: Math.max(0, hrEnd - this.state.hr) })
        }
      }, 60000)

      const next = nextPending(st.queue, st.done, st.i + 1)
      if (next < 0) return this.finishSession()
      this.startRest(st.i, next)
    },

    // ---------- rest ----------
    startRest(i, next) {
      const st = this.state
      st.mode = 'rest'
      st.next = next
      st.restStart = Date.now()
      st.rest = restAfter(st.queue, i, st.restSec)
      const n = st.queue[next]
      const prev = st.logged[n.exerciseId]
      this.show('rest')
      setText(ui.restTitle, st.rest.hrRule ? 'DESCANSO' : 'TRANSICIÓN SUPERSERIE')
      setText(ui.restNext, `${n.block}${n.pos} ${n.name}`)
      setText(ui.restNextLoad, `${n.loadMode === 'tiempo' ? '' : loadLabel(n, prev ? prev.load : n.load) + ' × '}${repsLabel(n, prev ? prev.reps : n.reps)}`)
      this.renderRest()
    },

    renderRest() {
      const st = this.state
      const t = (Date.now() - st.restStart) / 1000
      setText(ui.restClock, mmss(st.rest.target - t))
      setText(ui.restHr, st.rest.hrRule ? `♥ ${st.hr || '—'} → ${st.threshold}` : `♥ ${st.hr || '—'}`)
      const reason = restEnd({ t, hr: st.hr, target: st.rest.target, hrRule: st.rest.hrRule, threshold: st.threshold })
      if (reason) this.endRest(reason)
    },

    endRest(reason) {
      const st = this.state
      if (st.mode !== 'rest') return
      if (reason !== 'skip') vibrator.start({ mode: VIBRATOR_SCENE_STRONG_REMINDER })
      // The phone may have logged sets meanwhile: re-check before starting.
      const next = nextPending(st.queue, st.done, st.next)
      if (next < 0) return this.finishSession()
      this.startSet(next)
      this.loadSessionQuietly()
    },

    loadSessionQuietly() {
      this.request({ method: 'session.get', params: {} })
        .then((r) => {
          if (!r || !r.session || !this.state.session) return
          if (r.session.id !== this.state.session.id) return this.applySession(r)
          this.state.done = [...new Set([...this.state.done, ...(r.doneQis || [])])]
        })
        .catch(() => {})
    },

    finishSession() {
      const st = this.state
      const n = st.done.length
      vibrator.start({ mode: VIBRATOR_SCENE_STRONG_REMINDER })
      this.info('¡SESIÓN COMPLETA!', `${n} series registradas. Guárdala en Recomp para cerrar el día.`, 'done')
      setText(ui.infoBtn, 'BUSCAR NUEVA SESIÓN')
    },

    // ---------- daily metrics (steps, sleep, resting HR) for the phone's recovery card ----------
    sendDaily() {
      const params = { date: localDate(new Date()) }
      try { params.steps = steps.getCurrent() } catch (e) { /* not available */ }
      try { params.restingHr = heart.getResting() } catch (e) { /* not available */ }
      try {
        sleep.updateInfo()
        const info = sleep.getInfo()
        if (info && info.totalTime > 0) {
          params.deepSleepMin = info.deepTime
          params.sleepMin = info.totalTime
        }
      } catch (e) { /* no sleep record yet */ }
      this.request({ method: 'daily.post', params }).catch(() => {})
    },

    // ---------- clock ----------
    tick() {
      const st = this.state
      st.ticks += 1
      if (st.mode === 'set') this.renderHr()
      if (st.mode === 'rest') this.renderRest()
      if (st.ticks % 300 === 0) this.sendDaily()
      if (st.ticks % 5 === 0) {
        this.flush()
        if (st.mode === 'set' || st.mode === 'rest') {
          this.request({ method: 'live.post', params: { hr: st.hr || null, mode: st.mode, qi: st.queue[st.i] ? st.queue[st.i].qi : null } }).catch(() => {})
        }
        if (st.mode === 'empty' || st.mode === 'offline') this.loadSession()
      }
    },
  }),
)
