# Design notes

This document records the decisions behind `dsh-fallback-models` for maintainers and reviewers. The observable behavior is in [README.md](../README.md).

## Goals

- Let a user declare an ordered list of backup `provider/model` routes.
- Apply it globally, with a per-Session override that can be loaded from the global list and edited independently.
- Fail over without showing the user a provider error that a backup could have absorbed.
- Keep the configuration editable while the Host runs; the next request sees the edit.
- Stay installable as an ordinary DSH bundle: one Host row, one browser module, no build step.

## Non-goals (1.0)

- Cross-provider prompt adaptation beyond what the adapter's own `prepareCall` does.
- Health tracking or circuit breaking across requests.
- A per-request timeout that aborts a slow primary before its adapter would.
- Rewriting the transcript's model attribution after a fallback.
- Persistent fallback history in the Session log.

## Where the failover lives

The Agent loop's request path is:

1. `preStep()` resolves `agent.model.current()` once and fixes it in `decision.selection`.
2. `step()` calls `prepareRequest(turn, step, decision.selection, signal)` for every attempt.
3. The attempt builds a request, calls `preparedCall.stream(request)`, and inspects the terminal `finish` chunk.
4. On `finish.reason.kind === 'error' | 'aborted'`, it dispatches `agent/request-error`; a listener may return `{ kind: 'retry' }`.
5. A retry loops back to step 2 **with the same `decision.selection`**.

Two consequences:

- `agent.model.select()` inside an `agent/request-error` listener changes the next **step** or **turn**, not the retry the listener asked for.
- The only documented seam that can replace the provider dispatch of the in-flight attempt is `llm/stream`.

`LlmRuntime.streamWithRegistration()` calls `ctx.waterfall(this, 'llm/stream', options, () => adapterStream(...))`. The waterfall is described as the place for "retry, replay, routing". Our listener registers with `prepend: true` and returns a generator that either delegates to `next()` or runs the fallback chain.

### Why not replace `AgentOptions.provider/model`?

Those are the live options for a Session that has not recorded a selection. Mutating them would affect later steps and other requests, and would not be a per-request fallback. The chain must be a read-only input to the current dispatch.

## Safe streaming

The adapter contract normalizes dispatch and iteration failures to a terminal `finish` chunk:

- `{ type: 'finish', reason: { kind: 'error', failure } }`
- `{ type: 'finish', reason: { kind: 'aborted', failure } }`

`FallbackAttempt` wraps the source iterator and holds leading `block-start` chunks. It exposes a chunk only when the attempt proves it is producing something:

- `block-start` → held, not yielded.
- first `text-delta`, `reasoning-delta`, `tool-call-delta`, `block-end`, or `usage` → release the held block starts and this chunk, mark the attempt `committed`.
- `finish` → stored as `terminal`, never yielded by the attempt.
- After `committed`, a later `finish` with `kind: 'error'` is exposed unchanged; no fallback.

This gives three invariants:

1. A fallback never follows content the loop has already observed.
2. A fallback never follows an aborted request.
3. A provider that opens a block and immediately fails can still be replaced: nothing was exposed, so the held `block-start` is dropped.

A thrown iterator error is **not** a normalized provider failure. The runtime turns adapter failures into terminal chunks; a throw is a middleware/consumer/plugin error, so `runFallback` rethrows it and lets the loop and retry policy own it.

## Fallback preparation

`prepareFallbackStream()` constructs a `LlmCallConfig` and calls `llm.prepareCall(config, signal)`. The returned handle is bound to the adapter registration captured at preparation, which is what avoids mixing one adapter's capability result with another adapter during HMR.

The dispatch options must satisfy `callConfigEquals(options, prepared.config)`. The implementation copies `provider`, `model`, `reasoningEffort`, `temperature`, `maxTokens`, and `stop` from `prepared.config`, and deletes any field the prepared config omits.

A route may reject the primary's optional controls:

- `UNSUPPORTED_REASONING_EFFORT` when the route does not advertise the requested effort.
- A provider that rejects `max_tokens` above its own cap.

The preparation therefore retries once without the configured effort and without the primary's output cap. If that also fails, the route is skipped (and logged); the chain continues. `temperature` and `stop` are not optional in the same sense and remain.

The dispatch object carries a non-enumerable `Symbol.for('dsh-fallback-models/fallback-attempt')`. `prepared.stream()` re-enters the `llm/stream` waterfall; the marker makes this listener delegate immediately for its own fallback dispatch instead of starting a nested chain.

## Chain construction

```
candidates = dedupe([primary, ...effective.fallbacks])   // by provider/model
budget     = min(maxFallbacks, candidates.length - 1)
```

- A route repeated in the list is tried once; the first occurrence's optional effort wins.
- The primary is always first; a fallback equal to the primary is dropped.
- `maxFallbacks` is a count of backup routes attempted, not of prepared calls. An unavailable route still consumes a slot, so a long list of broken routes cannot make one request unbounded.
- A skipped route (`skipCodes`) does not consume a slot; the failure is terminal.

## The first entry is the primary

The product model the UI exposes is a single ordered list: the first entry is the active model, and later entries are fallbacks. The Host engine still sees a normal `llm/stream` primary request plus a fallback list, so the shipped waterfall (checkpoint, replay, title observers) is preserved.

The client aligns the two views through `session.selectModel`:

- Enabling fallback, adding the first route, reordering the list, or rendering the composer trigger selects the first route through the Session Remote. The trigger effect is what makes an older session self-heal on the next page load.
- The outer model name is rendered by the shipped seat, so it follows the selection without a custom label override.
- The Session override stores `base`, the selection captured when fallback was enabled. Switching off restores it; resetting to global either selects the global first route (global enabled) or restores `base`.
- If selection fails (unavailable route, writer conflict), the old selection remains the primary and the configured first entry is simply the first fallback. The editor keeps the configured order.

This keeps the first attempt on the normal `next()` path instead of dispatching a prepared fallback as the first attempt, which would bypass downstream `llm/stream` listeners such as the checkpoint policy.

## Configuration storage

The Host row's `Config` is the durable store for both layers:

- global fields (`enabled`, `fallbacks`, `maxFallbacks`, `skipCodes`);
- `sessions`, a `z.dict` keyed by Session id, whose presence means "this Session no longer follows global".

Why not the Session log:

- A projection can read Session events, but a **client** cannot append a custom event without a Host Remote or the experimental `appendPluginRecord` seam. The plugin has no generated Remote, and using an experimental record API from a third-party package would be a compatibility liability.
- The settings document is the sanctioned client-writable store (`ctx.configForms` over `remote.settings`), supports atomic path mutations and revision fencing, and is shared by every browser on the same Host.

Why not a second Host row as a dedicated store: one row means one namespace, one settings page, one Config instance for the listener. The listener reads the same live object the page edits.

Every field is marked `.volatile()` so the settings form can rewrite it without remounting the owning plugin. The global settings page writes arrays and nested Session entries through `form.mutate()`; the Session menu writes `sessions.<id>` (set or unset).

### Trade-off

Per-Session overrides live in the profile patch, not in the Session. They are shared across browsers, survive restarts, and accumulate until removed. The UI exposes **Follow global again** to remove one; deployments with many short-lived Sessions may want a periodic cleanup. A future version can move Session state into the log once a Remote or a stable plugin-record seam is available.

## Interaction with `dsh-llm-retry`

`dsh-llm-retry` listens on `agent/request-error`, which is downstream of `llm/stream`. If a fallback absorbs a failure, `llm-retry` never sees it. If every candidate fails, the last failure reaches `agent/request-error` and the primary's policy runs.

This ordering is intentional:

- The primary's provider retry policy describes **that provider**, not the chain.
- A fallback is a different route and should not inherit the primary's retry budget.
- A user who wants the primary retried before failover can still configure the provider's own `retryPolicy`; the primary's retries happen inside its adapter/runtime boundary only if the adapter retries. `dsh-llm-retry` retries are step-level and therefore run after the whole chain.

This is documented in the README's limitations so users can reason about attempt counts.

## Observability and attribution

The Agent loop builds the assistant message from the request it assembled:

```js
source: { provider: request.provider, model: request.model }
```

That request object is deep-frozen for loop-built requests, and the fallback happens below the loop, so the transcript's model label stays the selected route. The actual route is observable in:

- the adapter's `replayState.response` on the assistant message (adapters that report provider/model there; the pi-ai adapter does);
- the Host warning log line emitted before each fallback dispatch;
- the `fallback-models/used` Cordis event, an extension point for other Host plugins:

```js
{
  sessionId,
  from: { provider, model },
  to: { provider, model },
  failure: { code, message, status? },
  at
}
```

There is no client-visible toast in 1.0. A future version can add one with a generated Remote or a Session projection that carries the actual route; both are outside the "no build step" constraint of this package.

## Security

- The plugin stores only provider/model ids and an optional effort id. It never reads, writes, or logs credentials.
- The settings writes go through the existing `remote.settings` authorization and revision fencing; the plugin adds no new HTTP route.
- The listener runs in the Host, inside the same trust boundary as the LLM service. It cannot widen model or credential access: `prepareCall` resolves the fallback route through the same adapter registry and credential resolution as a normal request.

## Testing strategy

- `FallbackAttempt` is tested for hold/release/terminal behavior without a Host.
- `runFallback` is tested with fake streams for: failover before content, no failover after content, aborted, disabled/empty, skip codes, dedupe, budget, unavailable routes, and observer timing.
- `prepareFallbackStream` is tested for the optional-constraint retry and for exact dispatch config.
- Config normalization and Session resolution are tested through the real schemastery schema for valid values and through defensive readers for malformed values.
- `client.js` is loaded with a fake `window.__ModuleLoader__` and a minimal React/document stub; `apply` must register the locale dictionaries, the settings section, its icon, and the model label with the expected ids and inject faces.

The real GUI was verified manually: settings page, model-menu switch card, Session override edit/reset through the switch and its reset button, and an end-to-end request where the primary provider's base URL was temporarily unreachable and the answer's `replayState.response` named the fallback provider. That test procedure is in [INSTALL.md](../INSTALL.md).

## Future work

- Client-visible "answered by fallback" notice (Remote event or Session projection).
- Optional per-attempt timeout and a per-entry health/circuit-breaker policy.
- A Session-key cleanup command or a retention policy for `sessions`.
- Optional per-fallback `maxTokens`/`temperature` overrides.
- A `plugins.item` card in addition to the settings section, for discoverability on the Plugins page.

## API references

| Contract | Package / file |
|---|---|
| `llm/stream` waterfall, `GenerateOptions`, `StreamChunk`, `LlmRuntime.prepareCall` | `@deepseek-ai/dsh-llm` (`lib/types/index.d.ts`, `lib/types/types.d.ts`) |
| `callConfigEquals`, `PreparedLlmCall.stream` | `@deepseek-ai/dsh-llm` (`lib/index.js`) |
| `agent/request-error` and `ModelSelection` | `@deepseek-ai/dsh-agent` (`lib/types/runtime-types.d.ts`) |
| Step selection fix | `@deepseek-ai/dsh-agent-loop` (`step`, `prepareRequest`) |
| `settings` / `ctx.settings` forms | `@deepseek-ai/dsh-settings` |
| `ctx.configForms`, `settings.section` | `@deepseek-ai/dsh-client-ui-settings` |
| `conversation.input.model.label`, composer model seat | `@deepseek-ai/dsh-client-ui-conversation`, `@deepseek-ai/dsh-client-ui-model-selection` |
| `ctx.remote.session.modelCatalog` | `@deepseek-ai/dsh-api-session-controller` |
