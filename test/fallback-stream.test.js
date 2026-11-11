import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FALLBACK_MARK,
  FallbackAttempt,
  createFallbackStream,
  prepareFallbackStream,
  runFallback,
} from '../lib/fallback-stream.js'
import { Config, dedupeRoutes, readGlobal, resolveChain } from '../lib/config.js'

/** Build an async iterable from a chunk list. */
async function* fromChunks(chunks) {
  for (const chunk of chunks) yield chunk
}

/** Collect an async iterable. */
async function collect(iterable) {
  const chunks = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

/** A successful text response. */
function success(text) {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

/** A provider failure delivered as a terminal chunk. */
function failure(code = 'RATE_LIMIT') {
  return [{ type: 'finish', reason: { kind: 'error', failure: { code, message: 'boom', status: 429 } } }]
}

/** A primary request shape sufficient for the engine. */
function options(overrides = {}) {
  return { provider: 'primary', model: 'main', messages: [], sessionId: 'session-1', ...overrides }
}

/** One effective chain. */
function chain(overrides = {}) {
  return { enabled: true, fallbacks: [{ provider: 'backup', model: 'alt' }], maxFallbacks: 3, skipCodes: [], ...overrides }
}

/** A fake llm that prepares any route except names starting with `broken`. */
function fakeLlm({ broken = new Set(), streamFor = () => fromChunks(success('fallback ok')) } = {}) {
  const prepared = []
  const dispatched = []
  return {
    prepared,
    dispatched,
    async prepareCall(config) {
      prepared.push({ ...config })
      if (broken.has(`${config.provider}/${config.model}`)) throw new Error('route unavailable')
      const resolved = { ...config }
      return {
        config: resolved,
        stream(options) {
          dispatched.push(options)
          return streamFor(config, options)
        },
      }
    },
  }
}

test('FallbackAttempt holds leading block starts and stores the terminal chunk', async () => {
  const attempt = new FallbackAttempt(fromChunks([...success('hi')]))
  const first = await attempt.next()
  assert.equal(first.done, false)
  assert.equal(first.chunk.type, 'block-start')
  // The first chunk is a block start, so it is released together with the
  // first content chunk, not before it.
  const second = await attempt.next()
  assert.equal(second.done, false)
  assert.equal(second.chunk.type, 'text-delta')
  let step = await attempt.next()
  assert.equal(step.done, false)
  assert.equal(step.chunk.type, 'block-end')
  step = await attempt.next()
  assert.equal(step.done, true)
  assert.equal(attempt.terminal.reason.kind, 'stop')
  assert.equal(attempt.committed, true)
  assert.deepEqual(attempt.held, [])
})

test('FallbackAttempt keeps an error terminal with only held block starts', async () => {
  const attempt = new FallbackAttempt(fromChunks([
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'boom' } } },
  ]))
  assert.equal((await attempt.next()).done, true)
  assert.equal(attempt.committed, false)
  assert.equal(attempt.held.length, 1)
  assert.equal(attempt.terminal.reason.kind, 'error')
})

test('a primary failure before content falls over to the next route', async () => {
  const llm = fakeLlm()
  const used = []
  const chunks = await collect(runFallback({
    options: options({ signal: undefined }),
    next: () => fromChunks(failure()),
    llm,
    chain: chain(),
    onUsed: (record) => used.push(record),
    logger: undefined,
  }))
  assert.deepEqual(chunks.map((chunk) => chunk.type), ['block-start', 'text-delta', 'block-end', 'finish'])
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(used.length, 1)
  assert.deepEqual(used[0].from, { provider: 'primary', model: 'main' })
  assert.deepEqual(used[0].to, { provider: 'backup', model: 'alt' })
  assert.equal(llm.prepared.length, 1)
  assert.equal(llm.dispatched.length, 1)
  assert.equal(llm.dispatched[0].provider, 'backup')
  assert.equal(llm.dispatched[0].model, 'alt')
  assert.equal(llm.dispatched[0][FALLBACK_MARK], true)
})

test('a primary failure after partial content is surfaced instead of replayed', async () => {
  const llm = fakeLlm()
  const used = []
  const chunks = await collect(runFallback({
    options: options(),
    next: () => fromChunks([
      { type: 'block-start', index: 0, blockType: 'text' },
      { type: 'text-delta', index: 0, text: 'partial' },
      { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'boom' } } },
    ]),
    llm,
    chain: chain(),
    onUsed: (record) => used.push(record),
    logger: undefined,
  }))
  assert.deepEqual(chunks.map((chunk) => chunk.type), ['block-start', 'text-delta', 'finish'])
  assert.equal(chunks.at(-1).reason.kind, 'error')
  assert.equal(used.length, 0)
  assert.equal(llm.prepared.length, 0)
})

test('an aborted terminal never fails over', async () => {
  const llm = fakeLlm()
  const chunks = await collect(runFallback({
    options: options(),
    next: () => fromChunks([{ type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: 'stopped' } } }]),
    llm,
    chain: chain(),
    logger: undefined,
  }))
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].reason.kind, 'aborted')
  assert.equal(llm.prepared.length, 0)
})

test('a disabled chain or an empty fallback list passes the primary through untouched', async () => {
  for (const effective of [chain({ enabled: false }), chain({ fallbacks: [] })]) {
    const llm = fakeLlm()
    const chunks = await collect(runFallback({
      options: options(),
      next: () => fromChunks(failure()),
      llm,
      chain: effective,
      logger: undefined,
    }))
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0].reason.kind, 'error')
    assert.equal(llm.prepared.length, 0)
  }
})

test('skipCodes prevents failover for the named failure code', async () => {
  const llm = fakeLlm()
  const chunks = await collect(runFallback({
    options: options(),
    next: () => fromChunks(failure('IMAGE_OFFLOAD_REQUIRED')),
    llm,
    chain: chain({ skipCodes: ['IMAGE_OFFLOAD_REQUIRED'] }),
    logger: undefined,
  }))
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].reason.failure.code, 'IMAGE_OFFLOAD_REQUIRED')
  assert.equal(llm.prepared.length, 0)
})

test('the selected route is deduplicated out of the fallback list', async () => {
  const llm = fakeLlm()
  const chunks = await collect(runFallback({
    options: options({ provider: 'backup', model: 'alt' }),
    next: () => fromChunks(failure()),
    llm,
    chain: chain(),
    logger: undefined,
  }))
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].reason.kind, 'error')
  assert.equal(llm.prepared.length, 0)
})

test('maxFallbacks caps the number of fallback routes tried', async () => {
  const llm = fakeLlm()
  const used = []
  const chunks = await collect(runFallback({
    options: options(),
    next: () => fromChunks(failure()),
    llm,
    chain: chain({
      fallbacks: [
        { provider: 'backup-1', model: 'alt' },
        { provider: 'backup-2', model: 'alt' },
        { provider: 'backup-3', model: 'alt' },
      ],
      maxFallbacks: 2,
    }),
    onUsed: (record) => used.push(record),
    logger: undefined,
  }))
  // The fake streams succeed, so the first fallback wins; the cap is not
  // reached. Force every fallback to fail instead.
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(used.length, 1)

  const failingLlm = fakeLlm({ streamFor: () => fromChunks(failure()) })
  const failingUsed = []
  const failed = await collect(runFallback({
    options: options(),
    next: () => fromChunks(failure()),
    llm: failingLlm,
    chain: chain({
      fallbacks: [
        { provider: 'backup-1', model: 'alt' },
        { provider: 'backup-2', model: 'alt' },
        { provider: 'backup-3', model: 'alt' },
      ],
      maxFallbacks: 2,
    }),
    onUsed: (record) => failingUsed.push(record),
    logger: undefined,
  }))
  assert.equal(failingUsed.length, 2)
  assert.equal(failingLlm.prepared.length, 2)
  assert.equal(failed.length, 1)
  assert.equal(failed[0].reason.kind, 'error')
})

test('an unavailable fallback route is skipped for the next one', async () => {
  const llm = fakeLlm({ broken: new Set(['backup-1/alt']) })
  const used = []
  const chunks = await collect(runFallback({
    options: options(),
    next: () => fromChunks(failure()),
    llm,
    chain: chain({
      fallbacks: [
        { provider: 'backup-1', model: 'alt' },
        { provider: 'backup-2', model: 'alt' },
      ],
    }),
    onUsed: (record) => used.push(record),
    logger: undefined,
  }))
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(used.length, 1)
  assert.equal(used[0].to.provider, 'backup-2')
  // The unavailable route is prepared twice: once with the primary's optional
  // controls, then once without them, before it is given up.
  assert.deepEqual(llm.prepared.map((route) => route.model), ['alt', 'alt', 'alt'])
  assert.deepEqual(llm.prepared.map((route) => route.provider), ['backup-1', 'backup-1', 'backup-2'])
})

test('prepareFallbackStream retries without unsupported optional constraints', async () => {
  const calls = []
  const llm = {
    async prepareCall(config) {
      calls.push({ ...config })
      if (config.reasoningEffort !== undefined || config.maxTokens !== undefined) throw new Error('unsupported controls')
      return {
        config: { provider: config.provider, model: config.model },
        stream() {
          return fromChunks(success('ok'))
        },
      }
    },
  }
  const stream = await prepareFallbackStream(
    llm,
    options({ temperature: 0.2, maxTokens: 999, reasoningEffort: 'high' }),
    { provider: 'backup', model: 'alt', reasoningEffort: 'high' },
    undefined,
  )
  assert.ok(stream !== undefined)
  const chunks = await collect(stream)
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].reasoningEffort, 'high')
  assert.equal(calls[0].maxTokens, 999)
  assert.equal(calls[1].reasoningEffort, undefined)
  assert.equal(calls[1].maxTokens, undefined)
  assert.equal(calls[1].temperature, 0.2)
})

test('createFallbackStream ignores auxiliary and already-fallback calls', async () => {
  const llm = fakeLlm()
  const seen = []
  const listener = createFallbackStream({
    llm,
    resolveChain: () => chain(),
    onUsed: () => {},
    logger: undefined,
  })
  const noSession = await collect(listener({ provider: 'primary', model: 'main', messages: [] }, () => {
    seen.push('no-session')
    return fromChunks(failure())
  }))
  assert.equal(seen.length, 1)
  assert.equal(noSession.length, 1)

  const marked = await collect(listener({ provider: 'primary', model: 'main', messages: [], sessionId: 's', [FALLBACK_MARK]: true }, () => {
    seen.push('marked')
    return fromChunks(failure())
  }))
  assert.equal(seen.length, 2)
  assert.equal(marked.length, 1)
})

test('config defaults, normalization and session resolution', () => {
  // The valid part goes through the real schema; malformed leftovers are
  // exercised through the defensive reader, because the schema refuses them
  // before a live Config can ever hold them.
  const config = Config({
    fallbacks: [
      { provider: 'a', model: 'one' },
      { provider: 'a', model: 'one' },
      { provider: 'b', model: 'two', reasoningEffort: 'high' },
    ],
    sessions: {
      'session-1': { enabled: false, fallbacks: [{ provider: 'c', model: 'three' }] },
      'session-2': { fallbacks: [] },
    },
  })
  const global = readGlobal(config)
  assert.equal(global.enabled, true)
  assert.deepEqual(global.fallbacks, [
    { provider: 'a', model: 'one' },
    { provider: 'b', model: 'two', reasoningEffort: 'high' },
  ])
  assert.equal(global.maxFallbacks, 3)
  assert.deepEqual(global.skipCodes, ['IMAGE_OFFLOAD_REQUIRED'])

  const sessionOne = resolveChain(config, 'session-1')
  assert.equal(sessionOne.source, 'session')
  assert.equal(sessionOne.enabled, false)
  assert.deepEqual(sessionOne.fallbacks, [{ provider: 'c', model: 'three' }])

  const sessionTwo = resolveChain(config, 'session-2')
  assert.equal(sessionTwo.source, 'session')
  assert.equal(sessionTwo.enabled, true)
  assert.deepEqual(sessionTwo.fallbacks, [])

  const malformed = readGlobal({
    fallbacks: [
      { provider: '', model: 'broken' },
      { provider: 'ok', model: 'route' },
      'not-a-route',
    ],
    sessions: { broken: 'not-an-object' },
  })
  assert.deepEqual(malformed.fallbacks, [{ provider: 'ok', model: 'route' }])
  assert.equal(resolveChain({ sessions: { broken: 'not-an-object' } }, 'broken').source, 'global')

  const unknown = resolveChain(config, 'session-unknown')
  assert.equal(unknown.source, 'global')
  assert.deepEqual(unknown.fallbacks, global.fallbacks)
})

test('dedupeRoutes keeps the first effort for a repeated route', () => {
  assert.deepEqual(dedupeRoutes([
    { provider: 'a', model: 'b', reasoningEffort: 'low' },
    { provider: 'a', model: 'b', reasoningEffort: 'high' },
    { provider: 'c', model: 'd' },
  ]), [
    { provider: 'a', model: 'b', reasoningEffort: 'low' },
    { provider: 'c', model: 'd' },
  ])
})
