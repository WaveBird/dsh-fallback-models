import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Load `client.js` outside a browser: the module registers its factory with
 * `window.__ModuleLoader__`, so a fake loader captures that factory and the
 * smoke test runs `apply` against a minimal Cordis-like context. No component
 * is rendered here; the real surfaces are exercised in the Web GUI.
 */

/** Minimal React stub: only what `client.js` touches at module scope and in apply. */
const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: Symbol('Fragment'),
  useReducer: (reducer, initial) => [initial, () => {}],
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (initial) => ({ current: initial }),
  useCallback: (fn) => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
}

/** Minimal document stub for the stylesheet effect. */
function createDocumentStub() {
  const head = []
  return {
    head: {
      appendChild(node) {
        head.push(node)
      },
    },
    querySelector() {
      return null
    },
    createElement() {
      return {
        dataset: {},
        textContent: '',
        remove() {},
      }
    },
    body: {},
    querySelectorAll() {
      return []
    },
    _head: head,
  }
}

test('client module registers both surfaces', async () => {
  const registrations = []
  const slots = []
  const watched = []
  let localeRegistration
  let capturedFactory

  globalThis.window = {
    __ModuleLoader__: {
      load(definition) {
        capturedFactory = definition.factory
      },
    },
  }
  globalThis.document = createDocumentStub()
  // The model-menu extension is a browser-only surface; the smoke test covers
  // registration, not DOM mutation.
  globalThis.MutationObserver = undefined

  await import('../client.js')
  assert.equal(typeof capturedFactory, 'function')

  const form = { id: 'fallback-models' }
  const ctx = {
    effect(fn) {
      return fn()
    },
    locale: {
      bind: () => (key) => key,
      getSnapshot: () => ({ active: 'zh' }),
      register(namespace, dictionaries) {
        localeRegistration = { namespace, dictionaries }
        return () => {}
      },
    },
    configForms: {
      get: (id) => {
        assert.equal(id, 'fallback-models')
        return form
      },
      whileServed(namespaces, register) {
        watched.push(namespaces)
        return register(new Set(namespaces))
      },
    },
    slots: {
      inject(name, factory) {
        slots.push(name)
        return factory()
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
    remote: {
      $on: () => () => {},
      session: {
        async modelCatalog() {
          return { ok: true, value: { groups: [] } }
        },
      },
    },
  }

  const api = capturedFactory((id) => {
    assert.equal(id, 'react')
    return ReactStub
  })
  assert.equal(typeof api.apply, 'function')
  assert.deepEqual(api.inject, ['slots', 'locale', 'configForms', 'remote', 'remote.session'])

  api.apply(ctx)

  assert.equal(localeRegistration.namespace, 'fallback-models')
  assert.ok(localeRegistration.dictionaries.zh['settings.title'])
  assert.ok(localeRegistration.dictionaries.en['settings.title'])
  assert.deepEqual(watched, [['fallback-models']])
  assert.deepEqual(slots, ['settings.section', 'settings.section.icon', 'conversation.input.model.label'])

  const section = registrations.find((entry) => entry.options.name === 'settings.section')
  assert.ok(section)
  assert.equal(section.options.id, 'fallback-models')
  assert.equal(section.options.order, 12)
  const injected = section.options.inject()
  assert.equal(injected.form, form)
  assert.equal(typeof injected.t, 'function')
  assert.ok(injected.catalog)

  const icon = registrations.find((entry) => entry.options.name === 'settings.section.icon')
  assert.ok(icon)
  assert.equal(icon.options.id, 'fallback-models')

  const label = registrations.find((entry) => entry.options.name === 'conversation.input.model.label')
  assert.ok(label)
  assert.equal(label.options.locale, 'fallback-models')
  const labelInjected = label.options.inject()
  assert.equal(labelInjected.form, form)
  assert.equal(typeof labelInjected.t, 'function')
  assert.ok(labelInjected.catalog)
  assert.equal(labelInjected.getLocale(), 'zh')

  // The stylesheet effect appended exactly one owned tag.
  assert.equal(document._head.length, 1)
  assert.equal(document._head[0].dataset.plugin, 'dsh-fallback-models')

  delete globalThis.window
  delete globalThis.document
})
