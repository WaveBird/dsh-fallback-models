/**
 * The failover engine: an `llm/stream` waterfall wrapper that retries a failed
 * model call on the next configured fallback route before the failure reaches
 * the Agent loop.
 *
 * Why the LLM boundary and not `agent/request-error`: the loop fixes one
 * `ModelSelection` per step (`AgentLoop.step()` passes `decision.selection` to
 * every retry), so changing `agent.model.select()` inside a request-error
 * listener cannot change the model of the retry it asks for. The `llm/stream`
 * waterfall is documented as the routing seam ("retry, replay, routing") and
 * runs after the loop has logged the request, so a fallback replaces only the
 * provider dispatch for that in-flight attempt.
 *
 * Safety rules:
 * - Fail over only before any content chunk is exposed. Leading `block-start`
 *   chunks are held so an error that arrives after a block began, but before
 *   any delta/finish, can still start a clean fallback stream.
 * - Never fail over an aborted request, or a failure the user excluded by code.
 * - A thrown iterator error is not a normalized provider failure (the runtime
 *   turns adapter failures into a terminal `finish` chunk), so it propagates
 *   unchanged to the loop and its retry policy.
 *
 * @module dsh-fallback-models/fallback-stream
 */

import { normalizeRoute, routeKey } from './config.js'

/**
 * Internal marker on a fallback dispatch. `prepared.stream()` re-enters the
 * `llm/stream` waterfall; the marker keeps this wrapper from treating its own
 * fallback call as a new request.
 */
export const FALLBACK_MARK = Symbol.for('dsh-fallback-models/fallback-attempt')

/**
 * One attempt's chunk stream with the leading-block hold that makes safe
 * failover possible. It never yields a terminal `finish`; the caller inspects
 * {@link terminal} after {@link next} reports `done`.
 */
export class FallbackAttempt {
  /** @type {AsyncIterator<object>} */
  #iterator
  /** @type {object[]} */
  #queue = []
  /** @type {object[]} */
  #held = []
  /** @type {boolean} */
  #committed = false
  /** @type {boolean} */
  #finished = false
  /** @type {object | undefined} */
  #terminal

  /**
   * @param {AsyncIterable<object>} source the provider chunk stream
   */
  constructor(source) {
    this.#iterator = source[Symbol.asyncIterator]()
  }

  /** @returns {object[]} leading `block-start` chunks held until content proves the attempt is viable */
  get held() {
    return this.#held
  }

  /** @returns {boolean} whether any non-`block-start` chunk (content or usage) was exposed */
  get committed() {
    return this.#committed
  }

  /** @returns {object | undefined} the terminal `finish` chunk, stored instead of yielded */
  get terminal() {
    return this.#terminal
  }

  /**
   * Advance the wrapped stream.
   * @returns {Promise<{done: false, chunk: object} | {done: true}>} the next chunk the caller may expose
   */
  async next() {
    for (;;) {
      if (this.#queue.length > 0) return { done: false, chunk: this.#queue.shift() }
      if (this.#finished) return { done: true }
      const step = await this.#iterator.next()
      if (step.done === true) {
        this.#finished = true
        return { done: true }
      }
      const chunk = step.value
      if (chunk === null || typeof chunk !== 'object') {
        throw new TypeError('fallback-models: model stream yielded a non-object chunk')
      }
      if (!this.#committed) {
        if (chunk.type === 'block-start') {
          this.#held.push(chunk)
          continue
        }
        if (chunk.type === 'finish') {
          this.#terminal = chunk
          this.#finished = true
          return { done: true }
        }
        // First chunk that proves the attempt produced output: release the
        // held block starts and this chunk together.
        this.#committed = true
        this.#queue.push(...this.#held, chunk)
        this.#held = []
        continue
      }
      if (chunk.type === 'finish') {
        this.#terminal = chunk
        this.#finished = true
        return { done: true }
      }
      return { done: false, chunk }
    }
  }
}

/**
 * Render one failure for a log line.
 * @param {unknown} failure normalized failure facts
 * @returns {string} a short description
 */
function describeFailure(failure) {
  if (failure === null || typeof failure !== 'object') return 'unknown failure'
  const code = typeof failure.code === 'string' ? failure.code : 'UNKNOWN'
  const message = typeof failure.message === 'string' ? failure.message : ''
  return message.length > 0 ? `${code}: ${message}` : code
}

/**
 * Prepare one fallback dispatch under its own adapter registration.
 *
 * The dispatch options must equal the prepared config exactly
 * (`callConfigEquals`), so every call-config field is copied from
 * `prepared.config` rather than from the primary request.
 *
 * A route may not support the primary's reasoning level or output cap. The
 * first preparation keeps both; a rejection retries without the optional
 * constraints instead of dropping the fallback.
 *
 * @param {object} llm the `ctx.llm` service
 * @param {object} options the primary request
 * @param {{provider: string, model: string, reasoningEffort?: string}} route the fallback route
 * @param {{warn?: (...args: any[]) => void} | undefined} logger optional host logger
 * @returns {Promise<AsyncIterable<object> | undefined>} the prepared stream, or undefined when the route is unusable
 */
export async function prepareFallbackStream(llm, options, route, logger) {
  if (options.signal?.aborted === true) return undefined
  const temperature = options.temperature
  const stop = options.stop === undefined ? undefined : [...options.stop]
  const maxTokens = options.maxTokens

  /**
   * @param {boolean} withEffort keep the configured reasoning level
   * @param {boolean} withMaxTokens keep the primary's output cap
   * @returns {object} a prepared-call config
   */
  const config = (withEffort, withMaxTokens) => ({
    provider: route.provider,
    model: route.model,
    ...(withEffort && route.reasoningEffort !== undefined ? { reasoningEffort: route.reasoningEffort } : {}),
    ...(withMaxTokens && maxTokens !== undefined ? { maxTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(stop !== undefined ? { stop: [...stop] } : {}),
  })

  let prepared
  try {
    prepared = await llm.prepareCall(config(true, true), options.signal)
  } catch (error) {
    try {
      prepared = await llm.prepareCall(config(false, false), options.signal)
    } catch (second) {
      logger?.warn?.(
        'fallback-models: fallback route %s/%s is unavailable (%s)',
        route.provider,
        route.model,
        second instanceof Error ? second.message : String(second),
      )
      return undefined
    }
  }
  if (options.signal?.aborted === true) return undefined

  const resolved = prepared.config
  const dispatch = { ...options }
  dispatch.provider = resolved.provider
  dispatch.model = resolved.model
  if (resolved.reasoningEffort === undefined) delete dispatch.reasoningEffort
  else dispatch.reasoningEffort = resolved.reasoningEffort
  if (resolved.temperature === undefined) delete dispatch.temperature
  else dispatch.temperature = resolved.temperature
  if (resolved.maxTokens === undefined) delete dispatch.maxTokens
  else dispatch.maxTokens = resolved.maxTokens
  if (resolved.stop === undefined) delete dispatch.stop
  else dispatch.stop = [...resolved.stop]
  // Keep this wrapper out of its own dispatch. The marker rides the exact
  // object through `prepared.stream()` and the waterfall.
  Object.defineProperty(dispatch, FALLBACK_MARK, { value: true, enumerable: false })
  return prepared.stream(dispatch)
}

/**
 * Run one request through the effective chain.
 *
 * @param {object} input
 * @param {object} input.options the primary `GenerateOptions`
 * @param {() => AsyncIterable<object>} input.next continue the waterfall
 * @param {object} input.llm the `ctx.llm` service
 * @param {{enabled: boolean, fallbacks: object[], maxFallbacks: number, skipCodes: string[]}} input.chain effective chain
 * @param {((record: object) => void) | undefined} input.onUsed observer called before each fallback dispatch
 * @param {{warn?: (...args: any[]) => void} | undefined} input.logger optional host logger
 * @returns {AsyncGenerator<object>} the chunk stream the loop consumes
 */
export async function* runFallback({ options, next, llm, chain, onUsed, logger }) {
  if (options[FALLBACK_MARK] === true) {
    yield* next()
    return
  }
  if (chain.enabled !== true || chain.fallbacks.length === 0) {
    yield* next()
    return
  }

  const primary = normalizeRoute({ provider: options.provider, model: options.model, reasoningEffort: options.reasoningEffort })
  if (primary === undefined) {
    yield* next()
    return
  }
  const candidates = [primary]
  const seen = new Set([routeKey(primary)])
  for (const candidate of chain.fallbacks) {
    const route = normalizeRoute(candidate)
    if (route === undefined) continue
    const key = routeKey(route)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(route)
  }
  const budget = Math.min(chain.maxFallbacks, candidates.length - 1)
  if (budget <= 0) {
    yield* next()
    return
  }

  const skipCodes = new Set(chain.skipCodes)
  let previous = primary
  let pendingFailure
  let attempted = 0
  let lastTerminal

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    let stream
    if (index === 0) {
      stream = next()
    } else {
      if (attempted >= budget) break
      attempted += 1
      stream = await prepareFallbackStream(llm, options, candidate, logger)
      if (stream === undefined) continue
      // The route is about to be dispatched: this is the moment the failover
      // actually happens, not the moment the previous attempt failed.
      const record = {
        sessionId: typeof options.sessionId === 'string' ? options.sessionId : undefined,
        from: previous,
        to: candidate,
        failure: pendingFailure ?? { code: 'UNKNOWN', message: '' },
        at: Date.now(),
      }
      try {
        onUsed?.(record)
      } catch (error) {
        logger?.warn?.('fallback-models: fallback observer failed: %s', error instanceof Error ? error.message : String(error))
      }
      logger?.warn?.(
        'fallback-models: %s/%s failed (%s); trying fallback %s/%s',
        previous.provider,
        previous.model,
        describeFailure(pendingFailure),
        candidate.provider,
        candidate.model,
      )
      previous = candidate
    }

    const attempt = new FallbackAttempt(stream)
    for (;;) {
      const step = await attempt.next()
      if (step.done === true) break
      yield step.chunk
    }

    const terminal = attempt.terminal
    if (terminal === undefined) {
      // The runtime guarantees a terminal chunk; a stream that ends without
      // one is a plugin/protocol problem, not a provider failure. Expose what
      // was held and let the loop observe the missing finish.
      for (const chunk of attempt.held) yield chunk
      return
    }
    const reason = terminal.reason
    if (reason?.kind === 'aborted' || options.signal?.aborted === true) {
      for (const chunk of attempt.held) yield chunk
      yield terminal
      return
    }
    const failure = reason?.kind === 'error' ? reason.failure : undefined
    const canFailOver =
      failure !== undefined &&
      attempt.committed === false &&
      skipCodes.has(failure.code) === false &&
      index < candidates.length - 1 &&
      attempted < budget

    if (!canFailOver) {
      for (const chunk of attempt.held) yield chunk
      yield terminal
      return
    }

    // Nothing reached the loop: drop the held block starts and move on. The
    // next successfully prepared route reports this failure as its `from`.
    lastTerminal = terminal
    pendingFailure = {
      code: typeof failure.code === 'string' ? failure.code : 'UNKNOWN',
      message: typeof failure.message === 'string' ? failure.message : '',
      ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    }
  }

  // Every candidate failed before content; surface the last provider failure.
  if (lastTerminal !== undefined) yield lastTerminal
}

/**
 * Build the `llm/stream` listener for one plugin instance.
 *
 * @param {object} input
 * @param {object} input.llm the `ctx.llm` service
 * @param {(sessionId: string) => object} input.resolveChain effective-chain resolver
 * @param {((record: object) => void) | undefined} input.onUsed fallback observer
 * @param {{warn?: (...args: any[]) => void} | undefined} input.logger host logger
 * @returns {(options: object, next: () => AsyncIterable<object>) => AsyncIterable<object>} the waterfall listener
 */
export function createFallbackStream({ llm, resolveChain, onUsed, logger }) {
  return function fallbackStream(options, next) {
    if (options === null || typeof options !== 'object') return next()
    if (options[FALLBACK_MARK] === true) return next()
    if (typeof options.sessionId !== 'string' || options.sessionId.length === 0) return next()
    const chain = resolveChain(options.sessionId)
    if (chain === undefined || chain.enabled !== true || chain.fallbacks.length === 0) return next()
    return runFallback({ options, next, llm, chain, onUsed, logger })
  }
}
