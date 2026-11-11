/**
 * Host half of `dsh-fallback-models`.
 *
 * Owns the one behavior that cannot live in the browser: wrapping the
 * `llm/stream` waterfall so a failed model call is retried on the next
 * configured route before the Agent loop sees the failure. The Config schema is
 * also declared here because it is the durable store both the plugin settings
 * page and the per-Session composer menu edit.
 *
 * The listener reads the live Config per request, so a settings-page edit or a
 * composer edit applies to the next model call without a reload.
 *
 * @module dsh-fallback-models
 */

import { Config, resolveChain } from './lib/config.js'
import { createFallbackStream } from './lib/fallback-stream.js'

/** Cordis plugin identity. */
export const name = 'fallback-models'

/**
 * The LLM registry is the only required service. `settings` is optional: a
 * headless composition still gets the configured chain, it just cannot edit it
 * from a browser.
 */
export const inject = ['llm']

/** Config schema; also the settings namespace the browser half edits. */
export { Config }

/**
 * Install the failover listener.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context
 * @param {object} config - live Config observables
 */
export function apply(ctx, config) {
  const listener = createFallbackStream({
    llm: ctx.llm,
    resolveChain: (sessionId) => resolveChain(config, sessionId),
    onUsed: (record) => {
      // Extension point for other Host plugins (metrics, notices, audit).
      // Client-visible surfaces cannot subscribe to Host events without a
      // generated Remote, so this stays Host-local.
      ctx.emit('fallback-models/used', record)
    },
    logger: ctx.logger,
  })

  ctx.on('llm/stream', listener, { prepend: true })

  // The plugin owns a dedicated page for its global layer; keep the generic,
  // auto-generated form out of the Plugins page so the per-Session map never
  // shows up as a raw textarea there.
  ctx.inject(['settings'], (scope) => {
    scope.effect(() => scope.settings.configure({ auto: false }), 'fallback-models: dedicated settings page')
  })

  ctx.logger.info('fallback-models: llm/stream failover listener installed')
}
