// Side service: runs inside the Zepp phone app. The watch can only talk to it over Bluetooth;
// it forwards requests to the Recomp relay using the server URL and pairing code entered in the
// mini-app settings (Zepp app → Perfil → Recomp → Ajustes).
import { BaseSideService } from '@zeppos/zml/base-side'
import { DEFAULT_LINK } from '../shared/defaults'

function config(settings) {
  const url = String(settings.getItem('serverUrl') || DEFAULT_LINK.serverUrl).trim().replace(/\/+$/, '')
  const code = String(settings.getItem('pairCode') || DEFAULT_LINK.pairCode).trim().toUpperCase()
  return { url, code, ok: /^https?:\/\//.test(url) && /^[A-Z0-9]{6,12}$/.test(code) }
}

// @ts-ignore — global provided by the Zepp side-service runtime
AppSideService(
  BaseSideService({
    onInit() {},
    onRun() {},
    onDestroy() {},

    async relay(method, path, body) {
      const c = config(this.settings)
      if (!c.ok) return { error: 'config' }
      try {
        const res = await this.fetch({
          method,
          url: `${c.url}/v1/${c.code}/${path}`,
          headers: { 'Content-Type': 'application/json' },
          body: /** @type {any} */ (body ? JSON.stringify(body) : undefined),
        })
        const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
        return { status: res.status, ...data }
      } catch (e) {
        return { error: 'network', message: String(e) }
      }
    },

    onRequest(req, res) {
      const p = req.params || {}
      const run = (promise) => promise.then((r) => res(null, r), (e) => res(null, { error: 'network', message: String(e) }))
      switch (req.method) {
        case 'session.get':
          return run(this.relay('GET', 'session'))
        case 'set.post':
          return run(this.relay('POST', 'sets', { sessionId: p.sessionId, log: p.log }))
        case 'daily.post':
          return run(this.relay('POST', 'daily', p))
        case 'live.post':
          return run(this.relay('POST', 'live', { hr: p.hr, mode: p.mode, qi: p.qi }))
        default:
          return res(null, { error: 'unknown method' })
      }
    },
  }),
)
