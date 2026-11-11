/**
 * Config schema and pure resolution helpers for `dsh-fallback-models`.
 *
 * The plugin's Config is the single durable store for both layers the product
 * exposes:
 *
 * - the global failover chain, edited from the plugin's own settings page;
 * - per-Session overrides, edited from the composer menu. A Session key is
 *   present only after the user loaded or edited the chain for that Session,
 *   so an absent key means "follow the global chain" without a second flag.
 *
 * Every field is `volatile`: the live settings form may rewrite it without
 * remounting the owning plugin, which is what lets the browser edit the chain
 * while the Host listener reads the same Config instance on the next request.
 *
 * @module dsh-fallback-models/config
 */

import z from '@deepseek-ai/schemastery'

/**
 * Canonical code for a request that an image-capable route cannot send until
 * more retained images are offloaded. It is a recovery the image-offload
 * plugin owns, so the default chain does not swallow it.
 */
export const IMAGE_OFFLOAD_REQUIRED = 'IMAGE_OFFLOAD_REQUIRED'

/** One provider/model route in the chain. */
export const RouteSchema = z
  .object({
    provider: z
      .string()
      .min(1)
      .required()
      .description('Registered provider route, such as `workbuddy-cn-tap`.'),
    model: z
      .string()
      .min(1)
      .required()
      .description('Provider-owned model id, exactly as the adapter advertises it.'),
    reasoningEffort: z
      .string()
      .min(1)
      .description('Optional adapter-owned reasoning level; omitted uses the model default.'),
  })
  .description('One fallback route. Routes are tried in list order.')

/** One provider/model selection, used as the pre-fallback model to restore. */
export const SelectionSchema = z
  .object({
    provider: z.string().min(1).required().description('Provider route of the selection to restore.'),
    model: z.string().min(1).required().description('Model id of the selection to restore.'),
    reasoningEffort: z.string().min(1).description('Optional reasoning level to restore.'),
  })
  .description('One provider/model selection, used as the pre-fallback model to restore when the switch is turned off.')

/** One Session's override. Its presence means the Session no longer follows the global chain. */
export const SessionSchema = z
  .object({
    enabled: z.boolean().default(true).description('Whether failover runs for this Session.'),
    fallbacks: z.array(RouteSchema).default([]).description('This Session’s ordered fallback routes.'),
    base: z.union([SelectionSchema, z.const(undefined)]).description('Model selected before fallback was enabled; restored when it is switched off.'),
  })
  .description('A per-Session fallback chain loaded from a global chain, then edited independently.')

/** Complete plugin Config. */
export const Config = z.object({
  enabled: z
    .boolean()
    .default(true)
    .volatile()
    .description('Global switch for the fallback chain. A Session override carries its own switch.'),
  fallbacks: z
    .array(RouteSchema)
    .default([])
    .volatile()
    .description('Global fallback routes, tried in order after the selected model fails.'),
  maxFallbacks: z
    .natural()
    .min(1)
    .max(10)
    .default(3)
    .volatile()
    .description('Maximum fallback routes attempted for one request, counted after the selected model.'),
  skipCodes: z
    .array(z.string().min(1))
    .default([IMAGE_OFFLOAD_REQUIRED])
    .volatile()
    .description('Failure codes that never trigger failover. Empty disables every exception.'),
  sessions: z
    .dict(SessionSchema)
    .default({})
    .volatile()
    .description('Per-Session overrides keyed by Session id; an absent key follows the global chain.'),
})

/**
 * Read one Config field, whether it arrives as a schemastery observable or as a
 * plain value. `Config` fields resolve to observables in a live plugin.
 * @param {unknown} value field value
 * @returns {unknown} the current plain value
 */
export function readValue(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get()
    } catch {
      return undefined
    }
  }
  return value
}

/**
 * Detach and validate one route. Invalid routes are dropped rather than
 * crashing a model request: a corrupt settings document must not take the
 * conversation path down.
 * @param {unknown} candidate raw route
 * @returns {{provider: string, model: string, reasoningEffort?: string} | undefined} a detached route
 */
export function normalizeRoute(candidate) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined
  const provider = candidate.provider
  const model = candidate.model
  if (typeof provider !== 'string' || provider.length === 0) return undefined
  if (typeof model !== 'string' || model.length === 0) return undefined
  const effort = candidate.reasoningEffort
  const route = { provider, model }
  if (typeof effort === 'string' && effort.length > 0) route.reasoningEffort = effort
  return route
}

/**
 * Stable identity of one route. Reasoning effort is deliberately excluded: a
 * chain that repeats a provider/model pair would retry the same upstream twice
 * even if the effort differed.
 * @param {{provider: string, model: string}} route a route
 * @returns {string} opaque identity
 */
export function routeKey(route) {
  return `${route.provider}\u0000${route.model}`
}

/**
 * The first occurrence of every distinct provider/model pair, in order.
 * @param {ReadonlyArray<unknown>} candidates raw routes
 * @returns {Array<{provider: string, model: string, reasoningEffort?: string}>} detached routes
 */
export function dedupeRoutes(candidates) {
  const seen = new Set()
  const routes = []
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const route = normalizeRoute(candidate)
    if (route === undefined) continue
    const key = routeKey(route)
    if (seen.has(key)) continue
    seen.add(key)
    routes.push(route)
  }
  return routes
}

/**
 * Read the global layer from a live or plain Config.
 * @param {unknown} config plugin Config
 * @returns {{enabled: boolean, fallbacks: Array<object>, maxFallbacks: number, skipCodes: string[]}} the global chain
 */
export function readGlobal(config) {
  const source = config !== null && typeof config === 'object' ? config : {}
  const enabled = readValue(source.enabled) !== false
  const maxFallbacksRaw = readValue(source.maxFallbacks)
  const maxFallbacks = Number.isSafeInteger(maxFallbacksRaw)
    ? Math.min(10, Math.max(1, maxFallbacksRaw))
    : 3
  const skipCodesRaw = readValue(source.skipCodes)
  const skipCodes = Array.isArray(skipCodesRaw)
    ? [...new Set(skipCodesRaw.filter((code) => typeof code === 'string' && code.length > 0))]
    : [IMAGE_OFFLOAD_REQUIRED]
  return {
    enabled,
    fallbacks: dedupeRoutes(readValue(source.fallbacks)),
    maxFallbacks,
    skipCodes,
  }
}

/**
 * Read every durable Session override.
 * @param {unknown} config plugin Config
 * @returns {Map<string, {enabled: boolean, fallbacks: Array<object>}>} overrides by Session id
 */
export function readSessionOverrides(config) {
  const source = config !== null && typeof config === 'object' ? config : {}
  const raw = readValue(source.sessions)
  const overrides = new Map()
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return overrides
  for (const [sessionId, value] of Object.entries(raw)) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) continue
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue
    overrides.set(sessionId, {
      enabled: value.enabled !== false,
      fallbacks: dedupeRoutes(value.fallbacks),
    })
  }
  return overrides
}

/**
 * Resolve the chain one Session uses right now.
 *
 * A Session override replaces the global list entirely; it never appends to it.
 * The retry budget and the skip list stay global because they describe the
 * failover policy, not a route list.
 *
 * @param {unknown} config plugin Config
 * @param {string} sessionId Session whose chain is resolved
 * @returns {{enabled: boolean, fallbacks: Array<object>, maxFallbacks: number, skipCodes: string[], source: 'global' | 'session'}} the effective chain
 */
export function resolveChain(config, sessionId) {
  const global = readGlobal(config)
  const override = readSessionOverrides(config).get(sessionId)
  if (override === undefined) return { ...global, source: 'global' }
  return {
    enabled: override.enabled,
    fallbacks: override.fallbacks,
    maxFallbacks: global.maxFallbacks,
    skipCodes: global.skipCodes,
    source: 'session',
  }
}
