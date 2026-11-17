// Settings page shown in the Zepp phone app (Developer Mode → Wrep → Settings). Stores the relay
// URL and the pairing code that the Wrep app shows in Hoy → Bip 6 → Reloj.
import { DEFAULT_LINK } from '../shared/defaults'

const block = (style, children) => View({ style: { display: 'block', ...style } }, children)

function field(props, key, label, placeholder, transform, fallback) {
  const value = props.settingsStorage.getItem(key) || fallback || ''
  return block({ marginTop: '18px', padding: '14px 16px', borderRadius: '12px', background: '#ffffff', border: '1px solid #dcdcdc' }, [
    block({ fontSize: '13px', color: '#6b6b6b', marginBottom: '6px' }, [Text({}, [label])]),
    TextInput({
      label: value || placeholder,
      value,
      placeholder,
      maxLength: 120,
      onChange: (v) => props.settingsStorage.setItem(key, transform(String(v))),
      labelStyle: { fontSize: '18px', color: value ? '#111111' : '#9a9a9a', fontWeight: '600' },
      subStyle: { display: 'none' },
    }),
    block({ fontSize: '12px', color: '#9a9a9a', marginTop: '6px' }, [Text({}, ['Toca para editar'])]),
  ])
}

AppSettingsPage({
  build(props) {
    const url = props.settingsStorage.getItem('serverUrl') || DEFAULT_LINK.serverUrl
    const code = props.settingsStorage.getItem('pairCode') || DEFAULT_LINK.pairCode
    const ok = !!url && !!code
    return block({ padding: '16px 20px 40px' }, [
      block({ fontSize: '24px', fontWeight: 'bold', color: '#111111' }, [Text({}, ['Wrep · Reloj'])]),
      block({ fontSize: '14px', color: '#6b6b6b', marginTop: '6px', lineHeight: '20px' }, [
        Text({}, ['Copia la URL del servidor y el código que muestra la app Wrep en Hoy → Bip 6 → Reloj.']),
      ]),
      field(props, 'serverUrl', 'URL DEL SERVIDOR', 'https://tu-servidor.up.railway.app', (v) => v.trim().replace(/\/+$/, ''), DEFAULT_LINK.serverUrl),
      field(props, 'pairCode', 'CÓDIGO DE EMPAREJAMIENTO', 'ABC123', (v) => v.trim().toUpperCase(), DEFAULT_LINK.pairCode),
      block({ fontSize: '14px', marginTop: '18px', color: ok ? '#3a7d0a' : '#b4441e' }, [
        Text({}, [ok ? `Listo: el reloj usa ${code} · ${url}. No hace falta cambiar nada.` : 'Faltan datos: el reloj no podrá sincronizar.']),
      ]),
    ])
  },
})
