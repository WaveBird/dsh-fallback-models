/**
 * Client half of `dsh-fallback-models`.
 *
 * Three surfaces over one shared Config form:
 *
 * 1. `settings.section` — the plugin's own settings page. Edits the global
 *    failover chain, its switch, the retry budget, and the skip list.
 * 2. `conversation.input.model.label` — the shipped model seat's inline label.
 *    When the current Session has an enabled, non-empty chain, it keeps the
 *    catalog name and adds a small fallback glyph before it.
 * 3. The model menu extension — `ui-model-selection` owns the popup and exposes
 *    no row slot, so a `Fallback 模型` row is attached to the open root pane as
 *    an owned DOM node (identified through the trigger's `aria-controls`). The
 *    row opens the Session editor in place, covering the root pane. There is no
 *    separate composer button: the model selector remains the single entry.
 *
 * The module imports only React (and ReactDOM for the menu pane's React root)
 * and styles itself with host theme tokens.
 *
 * @module dsh-fallback-models/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-fallback-models',
  factory(require) {
    const React = require('react')
    const ReactDOM = (() => {
      try {
        return require('react-dom')
      } catch {
        return undefined
      }
    })()
    const h = React.createElement

    /** Locale namespace and the settings entry id (the two are the same by design). */
    const NS = 'fallback-models'
    const ENTRY_ID = 'fallback-models'

    /** Stylesheet identity; cleaned up with the plugin. */
    const STYLE_ID = 'dsh-fallback-models/ui.css'

    /** @type {Record<string, string>} */
    const zh = {
      'settings.nav': 'Fallback 模型',
      'settings.title': 'Fallback 模型',
      'settings.description':
        '启用 fallback 后，列表第 1 个模型作为主模型，后续模型按顺序接管失败的请求。这里的配置是全局默认值；每个会话可在模型选择卡片中单独覆盖。',
      'settings.enabled': '启用 fallback',
      'settings.enabledHint': '关闭后所有会话都不再尝试备用模型，除非会话自己启用了覆盖配置。',
      'settings.chain': '全局 fallback 链',
      'settings.chainHint': '第 1 个模型是主模型，后续按顺序 fallback；同一个 provider/model 只尝试一次；只在产生任何输出前切换。',
      'settings.empty': '还没有配置 fallback 模型；第 1 个添加的模型会成为主模型。',
      'settings.add': '添加模型',
      'settings.addUnavailable': '模型目录中没有可添加的模型。',
      'settings.manualProvider': 'provider',
      'settings.manualModel': 'model',
      'settings.manualAdd': '手动添加',
      'settings.manualHint': '模型目录不可用或模型未列出时，可手动填写 provider/model。',
      'settings.model': '模型',
      'settings.effort': '推理等级',
      'settings.defaultEffort': '默认',
      'settings.unavailableModel': '当前目录不包含此模型',
      'settings.moveUp': '上移',
      'settings.moveDown': '下移',
      'settings.remove': '移除',
      'settings.advanced': '高级',
      'settings.maxFallbacks': '单次请求最多尝试的 fallback 数量',
      'settings.maxFallbacksHint': '1–10；只统计第 1 个主模型之后的备用模型。',
      'settings.skipCodes': '不触发 fallback 的错误码',
      'settings.skipCodesHint': '逗号分隔；留空表示所有错误都切换。默认跳过 IMAGE_OFFLOAD_REQUIRED，把图片卸载恢复留给原插件。',
      'settings.saving': '保存中…',
      'settings.saved': '已保存',
      'settings.saveFailed': '保存失败，已恢复 Host 上的最新值。',
      'settings.readOnly': '此部署的设置文档只读。',
      'settings.sessionNote': '会话级覆盖：打开模型选择弹窗，用「Fallback 模型」开关启用回退；默认沿用全局配置，编辑后成为本会话自定义配置，可重置为全局。',
      'settings.formLoading': '正在读取 fallback 配置…',
      'settings.unavailable': '设置命名空间不可用，暂时无法读取 fallback 配置。',
      'settings.catalogError': '模型目录读取失败',
      'settings.retryCatalog': '重试',
      'menu.title': 'Fallback 模型',
      'menu.aria': 'Fallback 模型配置',
      'menu.off': '已关闭',
      'menu.followGlobal': '跟随全局',
      'menu.session': '本会话',
      'menu.enabled': '启用 fallback',
      'menu.empty': '本会话没有 fallback 模型；第 1 个添加的模型会成为主模型。',
      'menu.addModel': '添加模型',
      'menu.add': '添加',
      'menu.pickModel': '选择模型',
      'menu.noModels': '没有更多可添加的模型。',
      'menu.resetGlobal': '重置为全局',
      'menu.hint': '第 1 个模型是当前主模型，后续按顺序 fallback。默认使用全局配置；编辑会保存为本会话自定义配置，可用「重置为全局」恢复；关闭开关会恢复开启前的模型。',
      'menu.close': '关闭',
      'menu.saving': '保存中…',
      'menu.saved': '已保存',
      'menu.saveFailed': '保存失败',
      'menu.unavailable': '设置命名空间不可用，暂时无法读取 fallback 配置。',
      'menu.catalogLoading': '正在读取模型目录…',
      'menu.catalogError': '模型目录不可用，请在设置页手动添加。',
      'menu.remove': '移除',
      'menu.moveUp': '上移',
      'menu.moveDown': '下移',
    }

    /** @type {Record<string, string>} */
    const en = {
      'settings.nav': 'Fallback models',
      'settings.title': 'Fallback models',
      'settings.description':
        'When fallback is on, the first model in the list is the primary and later models take over a failed request in order. This page is the global default; each Session can override it from the model selection card.',
      'settings.enabled': 'Enable fallback',
      'settings.enabledHint': 'When off, no Session tries a backup model unless it carries its own enabled override.',
      'settings.chain': 'Global fallback chain',
      'settings.chainHint':
        'The first model is the primary; later models are fallbacks in order. A provider/model pair is tried once, and failover happens only before any output reaches the conversation.',
      'settings.empty': 'No fallback models configured yet; the first one added becomes the primary.',
      'settings.add': 'Add model',
      'settings.addUnavailable': 'The model catalog has no model left to add.',
      'settings.manualProvider': 'provider',
      'settings.manualModel': 'model',
      'settings.manualAdd': 'Add manually',
      'settings.manualHint': 'Use provider/model when the catalog is unavailable or does not list the route.',
      'settings.model': 'Model',
      'settings.effort': 'Effort',
      'settings.defaultEffort': 'Default',
      'settings.unavailableModel': 'not in the current catalog',
      'settings.moveUp': 'Move up',
      'settings.moveDown': 'Move down',
      'settings.remove': 'Remove',
      'settings.advanced': 'Advanced',
      'settings.maxFallbacks': 'Fallbacks attempted per request',
      'settings.maxFallbacksHint': '1–10. Counts only backup routes after the first primary model.',
      'settings.skipCodes': 'Failure codes that never fail over',
      'settings.skipCodesHint':
        'Comma-separated. Empty means every error fails over. IMAGE_OFFLOAD_REQUIRED is skipped by default so the image-offload recovery keeps ownership.',
      'settings.saving': 'Saving…',
      'settings.saved': 'Saved',
      'settings.saveFailed': 'The write was refused; the latest Host values were restored.',
      'settings.readOnly': 'This deployment stores settings read-only.',
      'settings.sessionNote':
        'Per-Session override: open the model menu and use the Fallback models switch. The session follows the global configuration until an edit makes it custom; Reset to global restores it.',
      'settings.formLoading': 'Loading the fallback configuration…',
      'settings.unavailable': 'The settings namespace is unavailable, so the fallback configuration cannot be read.',
      'settings.catalogError': 'Could not read the model catalog',
      'settings.retryCatalog': 'Retry',
      'menu.title': 'Fallback models',
      'menu.aria': 'Fallback model configuration',
      'menu.off': 'Off',
      'menu.followGlobal': 'Following global',
      'menu.session': 'This Session',
      'menu.enabled': 'Enable fallback',
      'menu.empty': 'This Session has no fallback models; the first one added becomes the primary.',
      'menu.addModel': 'Add model',
      'menu.add': 'Add',
      'menu.pickModel': 'Choose a model',
      'menu.noModels': 'No model left to add.',
      'menu.resetGlobal': 'Reset to global',
      'menu.hint': 'The first model is the current primary; later models are fallbacks in order. The global configuration is used until you edit something; edits become a custom Session configuration, Reset to global removes it, and switching fallback off restores the model selected before it was enabled.',
      'menu.close': 'Close',
      'menu.saving': 'Saving…',
      'menu.saved': 'Saved',
      'menu.saveFailed': 'Save failed',
      'menu.unavailable': 'The settings namespace is unavailable, so the fallback configuration cannot be read.',
      'menu.catalogLoading': 'Loading the model catalog…',
      'menu.catalogError': 'The model catalog is unavailable; add routes from the settings page instead.',
      'menu.remove': 'Remove',
      'menu.moveUp': 'Move up',
      'menu.moveDown': 'Move down',
    }

    const CSS = `
[data-fallback-models] { box-sizing: border-box; }
.fm-model-label { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
.fm-model-icon { flex: none; display: inline-flex; color: var(--dsw-alias-state-business-primary); }
.fm-model-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fm-model-badge { flex: none; padding: 0 4px; border-radius: 4px; background: var(--dsw-alias-state-idle-primary); color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 16px; }
.fm-model-shell { position: fixed; z-index: 1200; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-lg, 10px); background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2)); box-shadow: var(--dsw-elevation-panel); color: var(--dsw-alias-label-primary); backdrop-filter: var(--dsw-menu-backdrop-filter); }
.fm-model-shell[data-open="false"] { border-radius: var(--dsw-radius-lg, 10px) var(--dsw-radius-lg, 10px) 0 0; }
.fm-menu-bar { display: flex; align-items: center; flex: none; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.fm-menu-switchbar { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; height: 34px; padding: 0 8px; border: none; background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; font: inherit; font-size: 13px; line-height: 20px; text-align: left; }
.fm-reset { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; margin-right: 4px; padding: 0; border: none; border-radius: 4px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.fm-reset:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.fm-reset:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.fm-reset[hidden] { display: none; }
.fm-menu-switchbar:hover, .fm-menu-switchbar:focus-visible { background: var(--dsw-alias-interactive-bg-hover); outline: none; }
.fm-menu-switchlabel { flex: none; white-space: nowrap; }
.fm-menu-switchvalue { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }
.fm-switch-visual { position: relative; flex: none; width: 32px; height: 18px; border-radius: 9px; background: var(--dsw-alias-state-idle-primary); transition: background .15s ease; }
.fm-menu-switchbar[aria-checked="true"] .fm-switch-visual { background: var(--dsw-alias-state-business-primary); }
.fm-switch-visual .fm-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s ease; }
.fm-menu-switchbar[aria-checked="true"] .fm-switch-visual .fm-knob { transform: translateX(14px); }
.fm-pane { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; padding: 8px 10px; border-radius: 0; background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; overflow: auto; }
.fm-menu-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fm-menu-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; }
.fm-pill { flex: none; padding: 0 6px; height: 18px; border-radius: 9px; background: var(--dsw-alias-state-idle-primary); color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 18px; }
.fm-pill[data-session="true"] { background: var(--dsw-alias-state-business-primary); color: var(--dsw-alias-state-on-business, #fff); }
.fm-menu-body { display: flex; flex-direction: column; gap: 2px; min-height: 0; overflow: auto; }
.fm-row { display: flex; align-items: center; gap: 4px; min-height: 28px; padding: 2px 4px; border-radius: var(--dsw-radius-md, 8px); }
.fm-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.fm-index { flex: none; width: 14px; color: var(--dsw-alias-label-tertiary); font-size: 11px; font-variant-numeric: tabular-nums; text-align: right; }
.fm-route { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px; }
.fm-muted { color: var(--dsw-alias-label-tertiary); }
.fm-icon { flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; padding: 0; border: none; border-radius: 4px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.fm-icon:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.fm-icon:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.fm-button { display: inline-flex; align-items: center; gap: 4px; height: 28px; white-space: nowrap; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md, 8px); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; font: inherit; font-size: 12px; line-height: 18px; }
.fm-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.fm-button:disabled { color: var(--dsw-alias-label-dimmed); cursor: default; }
.fm-button[data-primary="true"] { background: var(--dsw-alias-state-business-primary); border-color: transparent; color: var(--dsw-alias-state-on-business, #fff); }
.fm-foot { display: flex; flex-wrap: wrap; gap: 6px; }
.fm-status { min-height: 16px; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }
.fm-status[data-kind="failed"], .fm-status[data-kind="error"] { color: var(--dsw-alias-state-error-primary); }
.fm-status[data-kind="saved"] { color: var(--dsw-alias-state-success-primary); }
.fm-select, .fm-input { box-sizing: border-box; min-width: 0; height: 28px; padding: 0 6px; border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; line-height: 18px; }
.fm-select:focus-visible, .fm-input:focus-visible { outline: none; border-color: var(--dsw-alias-state-business-primary); box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); }
.fm-select:disabled, .fm-input:disabled { color: var(--dsw-alias-label-dimmed); }
.fm-empty { padding: 8px 4px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.fm-note { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }
.fm-divider { height: 0; border-top: 1px solid var(--dsw-alias-border-l2); margin: 2px 0; }
.fm-settings { display: flex; flex-direction: column; gap: 16px; max-width: 720px; padding-top: 4px; color: var(--dsw-alias-label-primary); }
.fm-settings-title { margin: 0; font-size: 16px; font-weight: 600; line-height: 24px; }
.fm-settings-desc { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.fm-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: .5px solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl, 14px); background: var(--dsw-alias-settings-card-fill); }
.fm-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.fm-card-head > :first-child { flex: 1; min-width: 0; }
.fm-card-head > .fm-button { flex: none; }
.fm-card-title { font-size: 14px; font-weight: 500; line-height: 22px; }
.fm-card-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.fm-settings-row { display: flex; align-items: center; gap: 8px; }
.fm-settings-row .fm-route-select { flex: 1; }
.fm-manual-input { flex: 1; min-width: 120px; }
.fm-field { display: flex; flex-direction: column; gap: 6px; }
.fm-field-label { font-size: 13px; line-height: 20px; }
.fm-field-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.fm-switch { position: relative; flex: none; width: 32px; height: 18px; padding: 0; border: none; border-radius: 9px; background: var(--dsw-alias-state-idle-primary); cursor: pointer; transition: background .15s ease; }
.fm-switch[data-on="true"] { background: var(--dsw-alias-state-business-primary); }
.fm-switch:disabled { opacity: .5; cursor: default; }
.fm-switch:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); }
.fm-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .15s ease; }
.fm-switch[data-on="true"] .fm-knob { transform: translateX(14px); }
`

    /**
     * Read a field off a Config form snapshot.
     * @param {object} value form value
     * @returns {object} the value or an empty object
     */
    function objectOf(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
    }

    /**
     * Normalize one rendered route.
     * @param {unknown} candidate raw route
     * @returns {{provider: string, model: string, reasoningEffort?: string} | undefined} a detached route
     */
    function readRoute(candidate) {
      const route = objectOf(candidate)
      if (typeof route.provider !== 'string' || route.provider.length === 0) return undefined
      if (typeof route.model !== 'string' || route.model.length === 0) return undefined
      const normalized = { provider: route.provider, model: route.model }
      if (typeof route.reasoningEffort === 'string' && route.reasoningEffort.length > 0) {
        normalized.reasoningEffort = route.reasoningEffort
      }
      return normalized
    }

    /**
     * Read the route list of a layer.
     * @param {unknown} layer form value carrying `fallbacks`
     * @returns {Array<object>} valid routes
     */
    function readRoutes(layer) {
      const source = objectOf(layer)
      if (!Array.isArray(source.fallbacks)) return []
      return source.fallbacks.map(readRoute).filter((route) => route !== undefined)
    }

    /**
     * Read one Session override.
     * @param {unknown} value form value
     * @param {string} sessionId Session id
     * @returns {{enabled: boolean, fallbacks: Array<object>} | undefined} the override, when present
     */
    function readSession(value, sessionId) {
      const sessions = objectOf(value).sessions
      if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
      const entry = objectOf(sessions)[sessionId]
      if (entry === undefined || entry === null || typeof entry !== 'object' || Array.isArray(entry)) return undefined
      const base = readRoute(entry.base)
      return { enabled: entry.enabled !== false, fallbacks: readRoutes(entry), ...(base === undefined ? {} : { base }) }
    }

    /**
     * Read the global layer.
     * @param {unknown} value form value
     * @returns {{enabled: boolean, fallbacks: Array<object>}} the global chain
     */
    function readGlobal(value) {
      const source = objectOf(value)
      return { enabled: source.enabled !== false, fallbacks: readRoutes(source) }
    }

    /** Stable route identity. */
    function routeKey(route) {
      return `${route.provider}\u0000${route.model}`
    }

    /** Deep-copy routes so drafts never alias the form snapshot. */
    function cloneRoutes(routes) {
      return routes.map((route) => ({ ...route }))
    }

    /** Encode a route for a DOM option value. */
    function encodeRoute(route) {
      return JSON.stringify([route.provider, route.model])
    }

    /** Decode a DOM option value. */
    function decodeRoute(value) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
          return { provider: parsed[0], model: parsed[1] }
        }
      } catch {
        // fall through
      }
      return undefined
    }

    /**
     * Flatten the model catalog into rows the pickers render.
     * @param {object | null} catalog model catalog value
     * @returns {Array<{provider: string, providerName: string, model: string, modelName: string, reasoning?: object}>} models
     */
    function modelIndex(catalog) {
      const groups = Array.isArray(catalog?.groups) ? catalog.groups : []
      const models = []
      for (const group of groups) {
        if (typeof group?.id !== 'string') continue
        for (const model of Array.isArray(group.models) ? group.models : []) {
          if (typeof model?.id !== 'string') continue
          models.push({
            provider: group.id,
            providerName: typeof group.name === 'string' ? group.name : group.id,
            model: model.id,
            modelName: typeof model.name === 'string' ? model.name : model.id,
            reasoning: model.reasoning,
          })
        }
      }
      return models
    }

    /** Find one model entry. */
    function findModel(models, route) {
      return models.find((entry) => entry.provider === route.provider && entry.model === route.model)
    }

    /**
     * Human label for a route; falls back to the ids when the catalog no longer lists it.
     * @param {Array<object>} models flattened catalog
     * @param {{provider: string, model: string}} route route
     * @returns {string} display text
     */
    function routeLabel(models, route) {
      const entry = findModel(models, route)
      return entry === undefined ? `${route.provider} / ${route.model}` : `${entry.providerName} · ${entry.modelName}`
    }

    /**
     * Subscribe one component to a Config form.
     * @param {object} form ConfigForm
     * @returns {object} the current snapshot
     */
    function useFormSnapshot(form) {
      const [, force] = React.useReducer((value) => value + 1, 0)
      React.useEffect(() => form.subscribe(force), [form])
      return form.getSnapshot()
    }

    /**
     * Subscribe one component to the shared catalog store.
     * @param {object} store catalog store
     * @returns {{value: object | null, status: string, error: string | null}} the current value
     */
    function useCatalog(store) {
      const [, force] = React.useReducer((value) => value + 1, 0)
      React.useEffect(() => store.subscribe(force), [store])
      React.useEffect(() => {
        store.load()
      }, [store])
      return store.snapshot()
    }

    /**
     * Serialized write state shared by the page and the menu.
     * @returns {[{kind: string, message: string}, (task: () => Promise<boolean>) => Promise<boolean>]} state and runner
     */
    function useWriteQueue() {
      const [state, setState] = React.useState({ kind: 'idle', message: '' })
      const generation = React.useRef(0)
      const run = React.useCallback(async (task) => {
        const id = generation.current + 1
        generation.current = id
        setState({ kind: 'saving', message: '' })
        try {
          const accepted = await task()
          if (generation.current === id) {
            setState(accepted ? { kind: 'saved', message: '' } : { kind: 'failed', message: '' })
          }
          return accepted
        } catch (error) {
          if (generation.current === id) {
            setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
          }
          return false
        }
      }, [])
      return [state, run]
    }

    /**
     * Status line for a write state.
     * @param {object} props state, translator, and the key prefix (`settings` or `menu`)
     * @returns {object} the line
     */
    function StatusLine({ state, t, prefix }) {
      const kind = state.kind
      const text =
        kind === 'saving'
          ? t(`${prefix}.saving`)
          : kind === 'saved'
            ? t(`${prefix}.saved`)
            : kind === 'failed'
              ? t(`${prefix}.saveFailed`)
              : kind === 'error'
                ? `${t(`${prefix}.saveFailed`)}${state.message ? `: ${state.message}` : ''}`
                : ''
      return h('div', { className: 'fm-status', 'data-kind': kind }, text)
    }

    function SwapIcon({ size = 14 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('path', {
          d: 'M2.8 5.2h9.4M9.7 2.7l2.5 2.5-2.5 2.5M13.2 10.8H3.8M6.3 8.3l-2.5 2.5 2.5 2.5',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function ChevronUpIcon({ size = 12 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('path', { d: 'M4 10l4-4 4 4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    function ChevronDownIcon({ size = 12 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('path', { d: 'M4 6l4 4 4-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    function TrashIcon({ size = 13 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('path', {
          d: 'M3.5 4.5h9M6.5 2.5h3M5 4.5l.5 9h5l.5-9M6.8 7v4M9.2 7v4',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function CloseIcon({ size = 13 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('path', { d: 'M4 4l8 8M12 4l-8 8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
      )
    }

    function PlusIcon({ size = 12 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('path', { d: 'M8 3v10M3 8h10', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
      )
    }

    /** Settings navigation glyph. */
    function SectionGlyph({ size = 16 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: false },
        h('path', {
          d: 'M2.5 5h9M9.5 2.5L12 5 9.5 7.5M13.5 11H4.5M6.5 8.5L4 11l2.5 2.5',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    /** One on/off switch. */
    function Switch({ checked, disabled, onToggle, label }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          className: 'fm-switch',
          'data-on': checked ? 'true' : 'false',
          'aria-checked': checked,
          'aria-label': label,
          disabled,
          onClick: () => onToggle(!checked),
        },
        h('span', { className: 'fm-knob' }),
      )
    }

    /**
     * Picker options for one configured route, grouped by provider.
     * @param {Array<object>} models flattened catalog
     * @param {{provider: string, model: string}} selected current route
     * @param {string} unavailableLabel label suffix for a missing route
     * @returns {Array<object>} option elements
     */
    function routeOptionElements(models, selected, unavailableLabel) {
      const options = []
      const present = new Set(models.map((entry) => `${entry.provider}\u0000${entry.model}`))
      if (!present.has(routeKey(selected))) {
        options.push(
          h('option', { key: `missing:${encodeRoute(selected)}`, value: encodeRoute(selected) }, `${selected.provider} / ${selected.model} (${unavailableLabel})`),
        )
      }
      const groups = []
      const byProvider = new Map()
      for (const entry of models) {
        if (!byProvider.has(entry.provider)) {
          const group = { id: entry.provider, name: entry.providerName, models: [] }
          byProvider.set(entry.provider, group)
          groups.push(group)
        }
        byProvider.get(entry.provider).models.push(entry)
      }
      for (const group of groups) {
        options.push(
          h(
            'optgroup',
            { key: `group:${group.id}`, label: group.name },
            group.models.map((entry) =>
              h('option', { key: encodeRoute(entry), value: encodeRoute(entry) }, entry.modelName),
            ),
          ),
        )
      }
      return options
    }

    /**
     * One editable fallback row in the settings page.
     * @param {object} props row props
     * @returns {object} the row
     */
    function SettingsRouteRow({ route, index, count, models, writable, t, onChange, onEffort, onMove, onRemove }) {
      const entry = findModel(models, route)
      const efforts = Array.isArray(entry?.reasoning?.efforts) ? entry.reasoning.efforts : []
      return h(
        'div',
        { className: 'fm-row', 'data-fallback-models': 'settings-row' },
        h('span', { className: 'fm-index' }, String(index + 1)),
        h(
          'select',
          {
            className: 'fm-select fm-route-select',
            value: encodeRoute(route),
            disabled: !writable,
            'aria-label': t('settings.model'),
            onChange: (event) => {
              const next = decodeRoute(event.target.value)
              if (next !== undefined) onChange(index, next)
            },
          },
          routeOptionElements(models, route, t('settings.unavailableModel')),
        ),
        efforts.length > 0
          ? h(
              'select',
              {
                className: 'fm-select',
                value: route.reasoningEffort ?? '',
                disabled: !writable,
                'aria-label': t('settings.effort'),
                onChange: (event) => onEffort(index, event.target.value),
              },
              h('option', { value: '' }, t('settings.defaultEffort')),
              efforts.map((effort) => h('option', { key: effort.id, value: effort.id }, effort.name ?? effort.id)),
              route.reasoningEffort !== undefined && !efforts.some((effort) => effort.id === route.reasoningEffort)
                ? h('option', { value: route.reasoningEffort }, `${route.reasoningEffort} (${t('settings.unavailableModel')})`)
                : null,
            )
          : null,
        h(
          'button',
          {
            type: 'button',
            className: 'fm-icon',
            title: t('settings.moveUp'),
            'aria-label': t('settings.moveUp'),
            disabled: !writable || index === 0,
            onClick: () => onMove(index, -1),
          },
          h(ChevronUpIcon),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'fm-icon',
            title: t('settings.moveDown'),
            'aria-label': t('settings.moveDown'),
            disabled: !writable || index === count - 1,
            onClick: () => onMove(index, 1),
          },
          h(ChevronDownIcon),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'fm-icon',
            title: t('settings.remove'),
            'aria-label': t('settings.remove'),
            disabled: !writable,
            onClick: () => onRemove(index),
          },
          h(TrashIcon),
        ),
      )
    }

    /**
     * The plugin's own settings page.
     * @param {object} props injected form, catalog store and translator
     * @returns {object} the page
     */
    function SettingsPage({ form, catalog, t }) {
      const snapshot = useFormSnapshot(form)
      const catalogState = useCatalog(catalog)
      const [writeState, run] = useWriteQueue()
      const models = modelIndex(catalogState.value)
      const value = objectOf(snapshot.value)
      const enabled = value.enabled !== false
      const routes = readRoutes(value)
      const maxFallbacks = Number.isSafeInteger(value.maxFallbacks) ? value.maxFallbacks : 3
      const skipCodes = Array.isArray(value.skipCodes) ? value.skipCodes.filter((code) => typeof code === 'string') : ['IMAGE_OFFLOAD_REQUIRED']
      const writable = snapshot.status === 'ready' && snapshot.writable !== false
      const [skipDraft, setSkipDraft] = React.useState(skipCodes.join(', '))
      const [maxDraft, setMaxDraft] = React.useState(String(maxFallbacks))
      const [manual, setManual] = React.useState({ provider: '', model: '' })

      React.useEffect(() => {
        setSkipDraft(skipCodes.join(', '))
      }, [skipCodes.join('\u0000')])
      React.useEffect(() => {
        setMaxDraft(String(maxFallbacks))
      }, [maxFallbacks])

      /** Current routes read at action time, so rapid clicks never reuse a stale list. */
      const currentRoutes = () => readRoutes(form.getSnapshot().value)
      const write = (ops) => run(() => form.mutate(ops))
      const writeRoutes = (next) => write([{ op: 'set', path: ['fallbacks'], value: next }])

      if (snapshot.status === 'loading') {
        return h('div', { className: 'fm-settings', 'data-fallback-models': 'settings' }, h('p', { className: 'fm-settings-desc' }, t('settings.formLoading')))
      }
      if (snapshot.status === 'unavailable') {
        return h('div', { className: 'fm-settings', 'data-fallback-models': 'settings' }, h('p', { className: 'fm-settings-desc' }, t('settings.unavailable')))
      }

      const updateRoute = (index, route) => {
        const next = currentRoutes()
        next[index] = route
        writeRoutes(next)
      }
      const updateEffort = (index, effort) => {
        const next = currentRoutes()
        if (next[index] === undefined) return
        const route = { ...next[index] }
        if (effort.length === 0) delete route.reasoningEffort
        else route.reasoningEffort = effort
        next[index] = route
        writeRoutes(next)
      }
      const moveRoute = (index, delta) => {
        const next = currentRoutes()
        const target = index + delta
        if (target < 0 || target >= next.length) return
        const [route] = next.splice(index, 1)
        next.splice(target, 0, route)
        writeRoutes(next)
      }
      const removeRoute = (index) => {
        writeRoutes(currentRoutes().filter((_, position) => position !== index))
      }
      const addRoute = () => {
        const next = currentRoutes()
        const present = new Set(next.map(routeKey))
        const candidate = models.find((entry) => !present.has(routeKey(entry)))
        if (candidate === undefined) return
        writeRoutes([...next, { provider: candidate.provider, model: candidate.model }])
      }
      const addManual = async () => {
        const provider = manual.provider.trim()
        const model = manual.model.trim()
        if (provider.length === 0 || model.length === 0) return
        const accepted = await writeRoutes([...currentRoutes(), { provider, model }])
        if (accepted) setManual({ provider: '', model: '' })
      }
      const commitSkipCodes = () => {
        const next = [...new Set(skipDraft.split(',').map((code) => code.trim()).filter((code) => code.length > 0))]
        write([{ op: 'set', path: ['skipCodes'], value: next }])
      }
      const commitMaxFallbacks = () => {
        const parsed = Number(maxDraft)
        if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10) {
          setMaxDraft(String(maxFallbacks))
          return
        }
        if (parsed !== maxFallbacks) write([{ op: 'set', path: ['maxFallbacks'], value: parsed }])
      }

      return h(
        'div',
        { className: 'fm-settings', 'data-fallback-models': 'settings' },
        h('div', null, h('h2', { className: 'fm-settings-title' }, t('settings.title')), h('p', { className: 'fm-settings-desc' }, t('settings.description'))),
        h(
          'section',
          { className: 'fm-card' },
          h(
            'div',
            { className: 'fm-card-head' },
            h('div', null, h('div', { className: 'fm-card-title' }, t('settings.enabled')), h('div', { className: 'fm-card-hint' }, t('settings.enabledHint'))),
            h(Switch, { checked: enabled, disabled: !writable, label: t('settings.enabled'), onToggle: (next) => write([{ op: 'set', path: ['enabled'], value: next }]) }),
          ),
        ),
        h(
          'section',
          { className: 'fm-card' },
          h(
            'div',
            { className: 'fm-card-head' },
            h('div', null, h('div', { className: 'fm-card-title' }, t('settings.chain')), h('div', { className: 'fm-card-hint' }, t('settings.chainHint'))),
            h(
              'button',
              { type: 'button', className: 'fm-button', disabled: !writable || models.length === 0, onClick: addRoute, title: models.length === 0 ? t('settings.addUnavailable') : t('settings.add') },
              h(PlusIcon),
              t('settings.add'),
            ),
          ),
          routes.length === 0
            ? h('div', { className: 'fm-empty' }, t('settings.empty'))
            : h(
                'div',
                { className: 'fm-menu-body' },
                routes.map((route, index) =>
                  h(SettingsRouteRow, {
                    key: `${encodeRoute(route)}:${index}`,
                    route,
                    index,
                    count: routes.length,
                    models,
                    writable,
                    t,
                    onChange: updateRoute,
                    onEffort: updateEffort,
                    onMove: moveRoute,
                    onRemove: removeRoute,
                  }),
                ),
              ),
          h(
            'div',
            { className: 'fm-field' },
            h('div', { className: 'fm-field-hint' }, t('settings.manualHint')),
            h(
              'div',
              { className: 'fm-settings-row' },
              h('input', {
                className: 'fm-input fm-manual-input',
                value: manual.provider,
                disabled: !writable,
                placeholder: t('settings.manualProvider'),
                'aria-label': t('settings.manualProvider'),
                onChange: (event) => setManual({ ...manual, provider: event.target.value }),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') addManual()
                },
              }),
              h('input', {
                className: 'fm-input fm-manual-input',
                value: manual.model,
                disabled: !writable,
                placeholder: t('settings.manualModel'),
                'aria-label': t('settings.manualModel'),
                onChange: (event) => setManual({ ...manual, model: event.target.value }),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') addManual()
                },
              }),
              h('button', { type: 'button', className: 'fm-button', disabled: !writable, onClick: addManual }, t('settings.manualAdd')),
            ),
          ),
        ),
        h(
          'section',
          { className: 'fm-card' },
          h('div', { className: 'fm-card-title' }, t('settings.advanced')),
          h(
            'div',
            { className: 'fm-field' },
            h('label', { className: 'fm-field-label', htmlFor: 'fm-max-fallbacks' }, t('settings.maxFallbacks')),
            h('input', {
              id: 'fm-max-fallbacks',
              className: 'fm-input',
              type: 'number',
              min: 1,
              max: 10,
              step: 1,
              value: maxDraft,
              disabled: !writable,
              onChange: (event) => setMaxDraft(event.target.value),
              onBlur: commitMaxFallbacks,
              onKeyDown: (event) => {
                if (event.key === 'Enter') commitMaxFallbacks()
              },
            }),
            h('div', { className: 'fm-field-hint' }, t('settings.maxFallbacksHint')),
          ),
          h(
            'div',
            { className: 'fm-field' },
            h('label', { className: 'fm-field-label', htmlFor: 'fm-skip-codes' }, t('settings.skipCodes')),
            h('input', {
              id: 'fm-skip-codes',
              className: 'fm-input',
              value: skipDraft,
              disabled: !writable,
              onChange: (event) => setSkipDraft(event.target.value),
              onBlur: commitSkipCodes,
              onKeyDown: (event) => {
                if (event.key === 'Enter') commitSkipCodes()
              },
            }),
            h('div', { className: 'fm-field-hint' }, t('settings.skipCodesHint')),
          ),
        ),
        catalogState.status === 'error'
          ? h(
              'section',
              { className: 'fm-card' },
              h('div', { className: 'fm-card-title' }, t('settings.catalogError')),
              h('div', { className: 'fm-card-hint' }, catalogState.error ?? ''),
              h('div', null, h('button', { type: 'button', className: 'fm-button', onClick: () => catalog.load(true) }, t('settings.retryCatalog'))),
            )
          : null,
        h(StatusLine, { state: writeState, t, prefix: 'settings' }),
        !writable && snapshot.status === 'ready'
          ? h('p', { className: 'fm-note' }, t('settings.readOnly'))
          : h('p', { className: 'fm-note' }, t('settings.sessionNote')),
      )
    }

    /**
     * The Session's editable fallback menu.
     * @param {object} props form, catalog store, translator, Session id, close callback
     * @returns {object} the menu content
     */
    function SessionMenu({ form, catalog, t, sessionId, onClose, pane }) {
      const snapshot = useFormSnapshot(form)
      const catalogState = useCatalog(catalog)
      const [writeState, run] = useWriteQueue()
      const models = modelIndex(catalogState.value)
      const [pick, setPick] = React.useState('')
      const value = objectOf(snapshot.value)
      const global = readGlobal(value)
      const session = readSession(value, sessionId)
      const effective = session ?? global
      const overridden = session !== undefined
      const writable = snapshot.status === 'ready' && snapshot.writable !== false

      /** Read the live layers at action time. */
      const live = () => {
        const current = objectOf(form.getSnapshot().value)
        return { global: readGlobal(current), session: readSession(current, sessionId) }
      }
      /** The layer an edit starts from: the Session copy, or a copy of the global chain. */
      const materialize = () => {
        const current = live()
        if (current.session !== undefined) {
          return {
            enabled: current.session.enabled,
            fallbacks: cloneRoutes(current.session.fallbacks),
            ...(current.session.base === undefined ? {} : { base: current.session.base }),
          }
        }
        return { enabled: current.global.enabled, fallbacks: cloneRoutes(current.global.fallbacks) }
      }
      const writeSession = (next) =>
        run(() =>
          next === undefined
            ? form.mutate([{ op: 'unset', path: ['sessions', sessionId] }])
            : form.mutate([{ op: 'set', path: ['sessions', sessionId], value: next }]),
        )

      const present = new Set(effective.fallbacks.map(routeKey))
      const available = models.filter((entry) => !present.has(routeKey(entry)))
      const selectedPick = pick !== '' && available.some((entry) => encodeRoute(entry) === pick) ? pick : available[0] === undefined ? '' : encodeRoute(available[0])

      const add = () => {
        const decoded = decodeRoute(selectedPick)
        if (decoded === undefined) return
        const base = materialize()
        if (base.fallbacks.some((route) => routeKey(route) === routeKey(decoded))) return
        writeSession({ ...base, fallbacks: [...base.fallbacks, decoded] })
      }
      const remove = (index) => {
        const base = materialize()
        writeSession({ ...base, fallbacks: base.fallbacks.filter((_, position) => position !== index) })
      }
      const move = (index, delta) => {
        const base = materialize()
        const target = index + delta
        if (target < 0 || target >= base.fallbacks.length) return
        const [route] = base.fallbacks.splice(index, 1)
        base.fallbacks.splice(target, 0, route)
        writeSession(base)
      }
      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'fm-menu-head' },
          h('span', { className: 'fm-menu-title' }, t('menu.title')),
          h('span', { className: 'fm-pill', 'data-session': overridden ? 'true' : 'false' }, overridden ? t('menu.session') : t('menu.followGlobal')),
          h('button', { type: 'button', className: 'fm-icon', title: t('menu.close'), 'aria-label': t('menu.close'), onClick: onClose }, h(CloseIcon)),
        ),
        snapshot.status === 'unavailable'
          ? h('div', { className: 'fm-note' }, t('menu.unavailable'))
          : snapshot.status === 'loading'
            ? h('div', { className: 'fm-note' }, t('settings.formLoading'))
            : null,
        h('div', { className: 'fm-divider' }),
        h(
          'div',
          { className: 'fm-menu-body' },
          effective.fallbacks.length === 0
            ? h('div', { className: 'fm-empty' }, t('menu.empty'))
            : effective.fallbacks.map((route, index) =>
                h(
                  'div',
                  { className: 'fm-row', key: `${encodeRoute(route)}:${index}`, 'data-fallback-models': 'session-row' },
                  h('span', { className: 'fm-index' }, String(index + 1)),
                  h('span', { className: 'fm-route', title: routeLabel(models, route) }, routeLabel(models, route)),
                  h(
                    'button',
                    { type: 'button', className: 'fm-icon', title: t('menu.moveUp'), 'aria-label': t('menu.moveUp'), disabled: !writable || index === 0, onClick: () => move(index, -1) },
                    h(ChevronUpIcon),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'fm-icon', title: t('menu.moveDown'), 'aria-label': t('menu.moveDown'), disabled: !writable || index === effective.fallbacks.length - 1, onClick: () => move(index, 1) },
                    h(ChevronDownIcon),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'fm-icon', title: t('menu.remove'), 'aria-label': t('menu.remove'), disabled: !writable, onClick: () => remove(index) },
                    h(TrashIcon),
                  ),
                ),
              ),
        ),
        h(
          'div',
          { className: 'fm-settings-row' },
          h(
            'select',
            {
              className: 'fm-select',
              value: selectedPick,
              disabled: !writable || available.length === 0,
              'aria-label': t('menu.pickModel'),
              onChange: (event) => setPick(event.target.value),
            },
            available.length === 0
              ? h('option', { value: '' }, catalogState.status === 'loading' ? t('menu.catalogLoading') : t('menu.noModels'))
              : routeOptionElements(available, available[0], t('settings.unavailableModel')),
          ),
          h('button', { type: 'button', className: 'fm-button', disabled: !writable || available.length === 0, onClick: add }, h(PlusIcon), t('menu.add')),
        ),
        catalogState.status === 'error' ? h('div', { className: 'fm-note' }, t('menu.catalogError')) : null,
        h('div', { className: 'fm-divider' }),
        h('div', { className: 'fm-note' }, t('menu.hint')),
        h(StatusLine, { state: writeState, t, prefix: 'menu' }),
      )
    }

    /**
     * Resolve a catalog badge's localized text.
     * @param {{text: string | Record<string, string>} | undefined} badge catalog badge
     * @param {string | undefined} locale active locale id
     * @returns {string} display text, or an empty string
     */
    function badgeTextOf(badge, locale) {
      const text = badge?.text
      if (typeof text === 'string') return text
      if (text !== null && typeof text === 'object') {
        return text[locale] ?? text.en ?? Object.values(text)[0] ?? ''
      }
      return ''
    }

    /**
     * The model label the composer's model seat renders.
     *
     * It replaces the shipped label so the trigger and the root-menu value can
     * show a small fallback glyph before the model name while the current
     * Session has a non-empty, enabled chain. Model options keep the plain name
     * (the glyph there would mark every candidate, not the active choice).
     *
     * @param {object} props slot props: provider/model/placement plus injected form and translator
     * @returns {object} inline label content
     */
    function ModelLabel({ provider, model, placement, sessionId, form, t, getLocale }) {
      const snapshot = useFormSnapshot(form)
      const value = objectOf(snapshot.value)
      const session = readSession(value, sessionId)
      const effective = session ?? readGlobal(value)
      const showIcon = placement !== 'option' && effective.enabled && effective.fallbacks.length > 0
      const badge = badgeTextOf(model?.badge, getLocale?.())
      const anchor =
        placement === 'trigger'
          ? {
              'data-fm-model-anchor': 'trigger',
              'data-fm-session-id': typeof sessionId === 'string' ? sessionId : '',
              'data-fm-current-provider': typeof provider?.id === 'string' ? provider.id : '',
              'data-fm-current-model': typeof model?.id === 'string' ? model.id : '',
            }
          : null
      return h(
        'span',
        { className: 'fm-model-label', ...(anchor ?? {}) },
        showIcon
          ? h('span', { className: 'fm-model-icon', 'aria-hidden': 'true', title: t('menu.enabled') }, h(SwapIcon, { size: 11 }))
          : null,
        h('span', { className: 'fm-model-name' }, model?.name ?? ''),
        badge.length > 0 ? h('span', { className: 'fm-model-badge' }, badge) : null,
      )
    }

    /**
     * Adds a fallback switch to the shipped model-selection card.
     *
     * The shipped menu exposes no row-extension slot and is fully owned by
     * `ui-model-selection`, so this extension never inserts children into it:
     * React may reconcile unknown children away and a re-add loop would block
     * the page. Instead it renders its own fixed shell anchored to the menu's
     * rectangle. Closed, the shell is a 34px switch strip above the card; open,
     * the card is hidden and the shell becomes the fallback page at the same
     * anchor. The model selector stays the single entry point.
     *
     * The shell stops `mousedown` propagation so the menu's own outside-click
     * handler does not close the card while the user edits the chain.
     */
    class ModelMenuExtension {
      /**
       * @param {object} input form, catalog store, translator
       */
      constructor({ form, catalog, t, ctx }) {
        this.form = form
        this.catalog = catalog
        this.t = t
        this.ctx = ctx
        this.alignedKey = null
        this.failedKey = null
        this.bodyObserver = null
        this.triggerObserver = null
        this.menuObserver = null
        this.trigger = null
        this.observedMenu = null
        this.unsubscribe = null
        this.scheduled = false
        this.disposed = false
        this.state = null
      }

      /** Start observing the trigger, the menu, viewport, and Config form. */
      start() {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
        // Direct children only: the menu portal and our shell are body children.
        // A subtree observer here would rescan on every unrelated app mutation.
        this.bodyObserver = new MutationObserver(() => this.schedule())
        this.bodyObserver.observe(document.body, { childList: true })
        this.triggerObserver = new MutationObserver(() => this.schedule())
        this.menuObserver = new MutationObserver(() => this.schedule())
        this.unsubscribe = this.form.subscribe(() => this.schedule())
        this.onViewportChange = () => this.schedule()
        window.addEventListener('resize', this.onViewportChange)
        document.addEventListener('scroll', this.onViewportChange, true)
        // The shipped model menu closes on a document-level bubble `mousedown`
        // outside its own DOM. The shell is a sibling, so stop further document
        // listeners at the bubble phase. The event has already reached the
        // target by then, so inputs and selects inside the shell keep focus.
        this.onDocumentPointerDown = (event) => {
          if (this.state !== null && this.state.shell !== null && this.state.shell.contains(event.target)) {
            event.stopImmediatePropagation()
          }
        }
        document.addEventListener('mousedown', this.onDocumentPointerDown, false)
        document.addEventListener('pointerdown', this.onDocumentPointerDown, false)
        // The model seat also closes on focusout to anything outside its root
        // and menu. Focusing a shell control must not count as leaving.
        this.onDocumentFocusOut = (event) => {
          if (this.state !== null && this.state.shell !== null && this.state.shell.contains(event.relatedTarget)) {
            event.stopPropagation()
          }
        }
        document.addEventListener('focusout', this.onDocumentFocusOut, true)
        this.attachTrigger()
        this.schedule()
      }

      /** Stop observing and remove the shell. */
      stop() {
        this.disposed = true
        this.bodyObserver?.disconnect()
        this.triggerObserver?.disconnect()
        this.menuObserver?.disconnect()
        this.bodyObserver = null
        this.triggerObserver = null
        this.menuObserver = null
        this.trigger = null
        this.observedMenu = null
        if (typeof this.unsubscribe === 'function') this.unsubscribe()
        this.unsubscribe = null
        if (typeof this.onViewportChange === 'function') {
          window.removeEventListener('resize', this.onViewportChange)
          document.removeEventListener('scroll', this.onViewportChange, true)
          this.onViewportChange = null
        }
        if (typeof this.onDocumentPointerDown === 'function') {
          document.removeEventListener('mousedown', this.onDocumentPointerDown, false)
          document.removeEventListener('pointerdown', this.onDocumentPointerDown, false)
          this.onDocumentPointerDown = null
        }
        if (typeof this.onDocumentFocusOut === 'function') {
          document.removeEventListener('focusout', this.onDocumentFocusOut, true)
          this.onDocumentFocusOut = null
        }
        this.cleanup()
      }

      /** Point the trigger observer at the current model seat. */
      attachTrigger() {
        const anchor = document.querySelector('[data-fm-model-anchor="trigger"]')
        const trigger = anchor === null ? null : anchor.closest('button')
        if (trigger === null || trigger === this.trigger) return
        this.trigger = trigger
        this.triggerObserver.disconnect()
        this.triggerObserver.observe(trigger, { attributes: true, attributeFilter: ['aria-expanded', 'aria-controls'] })
      }

      /** Coalesce a burst of mutations into one scan. */
      schedule() {
        if (this.disposed || this.scheduled) return
        this.scheduled = true
        const run = () => {
          this.scheduled = false
          this.scan()
        }
        // A DOM-only scan does not need a paint. `requestAnimationFrame` is
        // paused in a hidden or minimized window, which would leave the switch
        // stale until the next visible frame.
        if (typeof queueMicrotask === 'function') queueMicrotask(run)
        else setTimeout(run, 0)
      }

      /** Find the open model menu and keep the shell anchored to it. */
      scan() {
        if (this.disposed || typeof document === 'undefined') return
        this.attachTrigger()
        const anchors = Array.from(document.querySelectorAll('[data-fm-model-anchor="trigger"]'))
        let anchor
        for (const candidate of anchors) {
          const trigger = candidate.closest('button')
          if (trigger !== null && trigger.getAttribute('aria-expanded') === 'true') {
            anchor = candidate
            break
          }
        }
        if (anchor === undefined) {
          this.cleanup()
          return
        }
        const trigger = anchor.closest('button')
        if (trigger === null) {
          this.cleanup()
          return
        }
        const menuId = trigger.getAttribute('aria-controls')
        const menu = menuId === null ? null : document.getElementById(menuId)
        if (menu === null) {
          this.cleanup()
          return
        }
        if (menu !== this.observedMenu) {
          this.observedMenu = menu
          this.menuObserver.disconnect()
          this.menuObserver.observe(menu, { attributes: true, attributeFilter: ['role'], childList: true })
        }
        const sessionId = anchor.getAttribute('data-fm-session-id') ?? ''
        if (sessionId.length === 0) {
          this.cleanup()
          return
        }
        if (this.state !== null && (this.state.menu !== menu || this.state.trigger !== trigger || this.state.sessionId !== sessionId)) {
          this.cleanup()
        }
        // Root pane vs drill-in: the shipped card keeps role="menu" at the top
        // level and switches to role="group" while a sub-pane (model list,
        // effort list) is open. Row count is deliberately not a signal: a model
        // without reasoning metadata renders only the model row, and small
        // catalogs hide the search field, so a fixed count would skip valid
        // root cards.
        const isRoot = menu.getAttribute('role') === 'menu'
        if (!isRoot) {
          // The user drilled into models or effort; the switch strip does not
          // belong to that pane. The observer reattaches it on the way back.
          this.cleanup()
          return
        }
        if (this.state === null) {
          this.state = {
            trigger,
            menu,
            sessionId,
            anchor,
            shell: null,
            bar: null,
            reset: null,
            pane: null,
            root: null,
            legacy: false,
            menuVisibility: menu.style.visibility,
            onKeyDown: null,
          }
        }
        this.state.anchor = anchor
        if (this.state.pane !== null && !this.state.pane.isConnected) this.closePane()
        this.ensureShell()
        this.syncPane()
        this.repositionShell()
      }

      /** Create the shell and its switch row once per open menu. */
      ensureShell() {
        if (this.state.shell !== null && this.state.shell.isConnected) {
          this.updateBar()
          return
        }
        const shell = document.createElement('div')
        shell.className = 'fm-model-shell'
        shell.dataset.fmShell = 'true'
        shell.dataset.open = 'false'
        // Keep the menu's document-level outside-click handler from closing the
        // card while the user interacts with the shell.
        const keep = (event) => event.stopPropagation()
        shell.addEventListener('mousedown', keep)
        shell.addEventListener('pointerdown', keep)

        const barRow = document.createElement('div')
        barRow.className = 'fm-menu-bar'
        const bar = document.createElement('button')
        bar.type = 'button'
        bar.setAttribute('role', 'switch')
        bar.setAttribute('aria-checked', 'false')
        bar.dataset.fmSwitch = 'true'
        bar.className = 'fm-menu-switchbar'
        bar.innerHTML =
          '<span class="fm-menu-switchlabel"></span>' +
          '<span class="fm-menu-switchvalue"></span>' +
          '<span class="fm-switch-visual" aria-hidden="true"><span class="fm-knob"></span></span>'
        bar.addEventListener('click', () => this.toggleEnabled())
        const reset = document.createElement('button')
        reset.type = 'button'
        reset.className = 'fm-reset'
        reset.setAttribute('aria-label', this.t('menu.resetGlobal'))
        reset.title = this.t('menu.resetGlobal')
        reset.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
          '<path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v3.2h3.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>' +
          '</svg>'
        reset.addEventListener('click', (event) => {
          event.stopPropagation()
          this.resetToGlobal()
        })
        barRow.appendChild(bar)
        barRow.appendChild(reset)
        shell.appendChild(barRow)
        document.body.appendChild(shell)
        this.state.shell = shell
        this.state.bar = bar
        this.state.reset = reset
        this.updateBar()
      }

      /** Refresh the switch's label, summary, and checked state. */
      updateBar() {
        if (this.state === null || this.state.bar === null) return
        const bar = this.state.bar
        const value = objectOf(this.form.getSnapshot().value)
        const session = readSession(value, this.state.sessionId)
        const effective = session ?? readGlobal(value)
        const label = bar.querySelector('.fm-menu-switchlabel')
        const side = bar.querySelector('.fm-menu-switchvalue')
        if (label !== null) label.textContent = this.t('menu.title')
        if (side !== null) {
          side.textContent = effective.enabled
            ? `${effective.fallbacks.length} · ${session === undefined ? this.t('menu.followGlobal') : this.t('menu.session')}`
            : this.t('menu.off')
        }
        bar.setAttribute('aria-checked', effective.enabled ? 'true' : 'false')
        bar.setAttribute('aria-label', `${this.t('menu.title')} · ${side?.textContent ?? ''}`)
        bar.title = side?.textContent ?? ''
        if (this.state.reset !== null) {
          this.state.reset.hidden = session === undefined
          this.state.reset.disabled = this.form.getSnapshot().writable === false
        }
        if (this.state.shell !== null) this.state.shell.dataset.open = this.state.pane !== null ? 'true' : 'false'
      }

      /**
       * Anchor the shell to the menu (switch strip only) or to the trigger
       * (full fallback card), and hide the shipped card while the editor is up.
       */
      repositionShell() {
        if (this.state === null || this.state.shell === null) return
        const { shell, menu, trigger, pane } = this.state
        if (!shell.isConnected) return
        if (pane !== null) {
          // The shell becomes the card: hide the shipped menu underneath.
          menu.style.visibility = 'hidden'
          const triggerRect = trigger.getBoundingClientRect()
          const width = Math.max(280, Math.min(380, window.innerWidth - 24))
          const height = Math.max(280, Math.min(440, triggerRect.top - 24))
          shell.style.width = `${width}px`
          shell.style.height = `${height}px`
          shell.style.left = `${Math.max(12, Math.min(triggerRect.right - width, window.innerWidth - width - 12))}px`
          shell.style.top = `${Math.max(12, triggerRect.top - 8 - height)}px`
          return
        }
        // Switch strip only: sit directly above the shipped card.
        menu.style.visibility = this.state.menuVisibility
        const menuRect = menu.getBoundingClientRect()
        shell.style.width = `${Math.max(180, menuRect.width)}px`
        shell.style.height = '34px'
        shell.style.left = `${menuRect.left}px`
        shell.style.top = `${Math.max(12, menuRect.top - 36)}px`
      }

      /**
       * The switch is the fallback enable control. It writes a Session
       * override; the effective chain starts as the global one, and any
       * Session write makes it custom until the reset button removes it.
       */
      toggleEnabled() {
        if (this.state === null || this.writing === true) return
        const snapshot = this.form.getSnapshot()
        if (snapshot.status !== 'ready' || snapshot.writable === false) return
        const value = objectOf(snapshot.value)
        const global = readGlobal(value)
        const session = readSession(value, this.state.sessionId)
        const current = session ?? { enabled: global.enabled, fallbacks: cloneRoutes(global.fallbacks) }
        const nextEnabled = current.enabled !== true
        const selection = this.currentSelection()
        const next = { enabled: nextEnabled, fallbacks: cloneRoutes(current.fallbacks) }
        // Remember the pre-fallback selection so switching back off restores it.
        // Re-enabling captures whatever is selected now, even if an earlier
        // override still carries a stale base; disabling keeps the captured one.
        if (nextEnabled) {
          if (selection !== undefined) next.base = selection
          else if (current.base !== undefined) next.base = current.base
        } else if (current.base !== undefined) {
          next.base = current.base
        } else if (selection !== undefined) {
          next.base = selection
        }
        this.writing = true
        this.form
          .mutate([{ op: 'set', path: ['sessions', this.state.sessionId], value: next }])
          .then((accepted) => {
            this.writing = false
            if (accepted === true) {
              this.alignedKey = null
              if (!nextEnabled) this.selectRoute(next.base)
            }
            // A refused write (read-only document, concurrent edit) must not
            // flip the local reading; the mirror refresh re-reads the Host.
            this.schedule()
          })
          .catch(() => {
            this.writing = false
            this.schedule()
          })
      }

      /** Remove the Session override so the global configuration applies again. */
      resetToGlobal() {
        if (this.state === null) return
        const snapshot = this.form.getSnapshot()
        if (snapshot.status !== 'ready' || snapshot.writable === false) return
        const value = objectOf(snapshot.value)
        const session = readSession(value, this.state.sessionId)
        const global = readGlobal(value)
        const base = session?.base
        this.form
          .mutate([{ op: 'unset', path: ['sessions', this.state.sessionId] }])
          .then((accepted) => {
            if (accepted === true) {
              this.alignedKey = null
              if (global.enabled && global.fallbacks.length > 0) this.selectRoute(global.fallbacks[0])
              else if (base !== undefined) this.selectRoute(base)
            }
            this.schedule()
          })
          .catch(() => this.schedule())
      }

      /** The model currently selected in the shipped seat, from the label anchor. */
      currentSelection() {
        const anchor = this.state?.anchor
        const provider = anchor?.getAttribute('data-fm-current-provider')
        const model = anchor?.getAttribute('data-fm-current-model')
        if (typeof provider !== 'string' || provider.length === 0) return undefined
        if (typeof model !== 'string' || model.length === 0) return undefined
        return { provider, model }
      }

      /**
       * Select one route through the session Remote. The shipped seat owns the
       * display, so this is what makes the outer model name follow the chain's
       * first entry instead of only changing our card.
       * @param {{provider: string, model: string, reasoningEffort?: string} | undefined} route route to select
       */
      selectRoute(route) {
        if (route === undefined || this.state === null) return
        const selectModel = this.ctx?.remote?.session?.selectModel
        if (typeof selectModel !== 'function') return
        const selection = {
          sessionId: this.state.sessionId,
          provider: route.provider,
          model: route.model,
          ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
        }
        try {
          selectModel(selection).catch(() => {})
        } catch {
          // A selection rejection is reported by the shipped seat; the model
          // chain remains configurable even when this Session cannot switch.
        }
      }

      /**
       * When fallback is enabled, the first chain entry is the active model.
       * Align the session selection with it so the outer name, the request, and
       * the chain all agree. The shipped `llm/stream` primary attempt then uses
       * that route through the normal waterfall; the remaining entries stay
       * fallbacks.
       */
      alignToChain() {
        if (this.state === null) return
        const value = objectOf(this.form.getSnapshot().value)
        const session = readSession(value, this.state.sessionId)
        const effective = session ?? readGlobal(value)
        if (!effective.enabled || effective.fallbacks.length === 0) {
          this.alignedKey = null
          this.failedKey = null
          return
        }
        const first = effective.fallbacks[0]
        const key = `${this.state.sessionId}:${routeKey(first)}`
        const current = this.currentSelection()
        if (current !== undefined && current.provider === first.provider && current.model === first.model) {
          this.alignedKey = key
          return
        }
        if (this.alignedKey === key || this.failedKey === key) return
        this.alignedKey = key
        const selectModel = this.ctx?.remote?.session?.selectModel
        if (typeof selectModel !== 'function') return
        const selection = {
          sessionId: this.state.sessionId,
          provider: first.provider,
          model: first.model,
          ...(first.reasoningEffort === undefined ? {} : { reasoningEffort: first.reasoningEffort }),
        }
        try {
          selectModel(selection)
            .then((result) => {
              if (result === undefined || result.ok !== true) {
                this.alignedKey = null
                this.failedKey = key
              } else {
                this.failedKey = null
              }
            })
            .catch(() => {
              this.alignedKey = null
              this.failedKey = key
            })
        } catch {
          this.alignedKey = null
          this.failedKey = key
        }
      }

      /**
       * Keep the card's page in step with the effective switch: enabled shows
       * the fallback editor, disabled shows the shipped model page.
       */
      syncPane() {
        if (this.state === null) return
        const value = objectOf(this.form.getSnapshot().value)
        const session = readSession(value, this.state.sessionId)
        const effective = session ?? readGlobal(value)
        if (effective.enabled) {
          if (this.state.pane === null) this.openPane()
          this.alignToChain()
        } else {
          this.alignedKey = null
          if (this.state.pane !== null) this.closePane()
        }
      }

      /** Open the Session fallback editor in the shell. */
      openPane() {
        if (this.state === null || this.state.pane !== null) return
        const { shell } = this.state
        const pane = document.createElement('div')
        pane.className = 'fm-pane'
        pane.dataset.fmPane = 'true'
        pane.setAttribute('role', 'group')
        pane.setAttribute('aria-label', this.t('menu.aria'))
        shell.appendChild(pane)
        this.state.pane = pane
        this.state.onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          this.closeMenu()
        }
        pane.addEventListener('keydown', this.state.onKeyDown, true)
        this.mountPane(pane)
        this.repositionShell()
        this.updateBar()
        const first = pane.querySelector('button')
        if (first !== null) setTimeout(() => first.focus(), 0)
        else this.state.bar?.focus?.()
      }

      /**
       * Render the Session menu into the pane. A separate React root is the
       * standard island pattern: the parent root never renders into this node.
       * @param {HTMLElement} pane pane element
       */
      mountPane(pane) {
        const props = {
          form: this.form,
          catalog: this.catalog,
          t: this.t,
          sessionId: this.state.sessionId,
          pane: true,
          onClose: () => this.closeMenu(),
        }
        if (typeof ReactDOM?.createRoot === 'function') {
          this.state.root = ReactDOM.createRoot(pane)
          this.state.root.render(h(SessionMenu, props))
          return
        }
        if (typeof ReactDOM?.render === 'function') {
          ReactDOM.render(h(SessionMenu, props), pane)
          this.state.legacy = true
          return
        }
        pane.textContent = this.t('menu.unavailable')
      }

      /** Close the editor and return the shell to a switch strip. */
      closePane() {
        if (this.state === null || this.state.pane === null) return
        const { pane, menu, root, legacy } = this.state
        if (this.state.onKeyDown !== null) {
          pane.removeEventListener('keydown', this.state.onKeyDown, true)
          this.state.onKeyDown = null
        }
        if (root !== null) {
          root.unmount()
          this.state.root = null
        } else if (legacy === true && typeof ReactDOM?.unmountComponentAtNode === 'function') {
          ReactDOM.unmountComponentAtNode(pane)
          this.state.legacy = false
        }
        pane.remove()
        this.state.pane = null
        if (menu.isConnected) menu.style.visibility = this.state.menuVisibility
        this.updateBar()
        this.repositionShell()
        this.state.bar?.focus?.()
      }

      /** Close the model menu itself through its trigger. */
      closeMenu() {
        if (this.state === null) return
        this.state.trigger.click()
      }

      /** Remove the shell and restore the shipped menu's visibility. */
      cleanup() {
        if (this.state === null) return
        this.closePane()
        const { shell, menu, menuVisibility } = this.state
        if (shell !== null) shell.remove()
        if (menu !== null && menu.isConnected) menu.style.visibility = menuVisibility
        this.state = null
      }
    }

    /**
     * Shared catalog store: one in-flight read at a time, shared by both surfaces.
     * @param {object} ctx client plugin context
     * @returns {object} store
     */
    function createCatalogStore(ctx) {
      let value = null
      let status = 'idle'
      let error = null
      let inflight = null
      const listeners = new Set()
      const emit = () => {
        for (const listener of [...listeners]) listener()
      }
      async function load(force = false) {
        if (inflight !== null) return inflight
        if (status === 'ready' && !force) return value
        status = 'loading'
        error = null
        emit()
        inflight = (async () => {
          try {
            const result = await ctx.remote.session.modelCatalog()
            if (result === undefined || result.ok !== true) {
              const failure = result?.error
              throw new Error(failure?.message ?? 'model catalog request failed')
            }
            value = result.value
            status = 'ready'
          } catch (caught) {
            value = null
            status = 'error'
            error = caught instanceof Error ? caught.message : String(caught)
          } finally {
            inflight = null
            emit()
          }
        })()
        return inflight
      }
      return {
        load,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        snapshot() {
          return { value, status, error }
        },
        invalidate() {
          value = null
          status = 'idle'
          error = null
          emit()
          return load(true)
        },
      }
    }

    /** Required client services. */
    const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.session']

    /**
     * Mount the settings page, its navigation icon, the model label, and the
     * model-menu extension.
     * @param {object} ctx client plugin context
     */
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'fallback-models: dictionaries')

      ctx.effect(() => {
        if (typeof document === 'undefined') return undefined
        if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return undefined
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-fallback-models'
        tag.dataset.pluginCss = STYLE_ID
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, 'fallback-models: stylesheet')

      const catalog = createCatalogStore(ctx)
      ctx.effect(() => {
        const offs = []
        const subscribe = (name) => {
          if (typeof ctx.remote.$on !== 'function') return
          try {
            const off = ctx.remote.$on(name, () => {
              catalog.invalidate()
            })
            if (typeof off === 'function') offs.push(off)
          } catch {
            // Event forwarding is an optimization; the catalog still loads on demand.
          }
        }
        subscribe('llm/adapters-updated')
        subscribe('llm/models-updated')
        return () => {
          for (const off of offs) off()
        }
      }, 'fallback-models: catalog invalidations')

      const form = ctx.configForms.get(ENTRY_ID)

      // The settings page exists only while the Host serves its namespace.
      ctx.effect(
        () =>
          ctx.configForms.whileServed([ENTRY_ID], () => {
            const section = ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: ENTRY_ID,
                  order: 12,
                  label: () => t('settings.nav'),
                  locale: NS,
                  inject: () => ({ form, catalog, t }),
                },
                SettingsPage,
              ),
            )
            const icon = ctx.slots.inject('settings.section.icon', () =>
              ctx.slots.register(
                {
                  name: 'settings.section.icon',
                  id: ENTRY_ID,
                  locale: NS,
                },
                SectionGlyph,
              ),
            )
            return () => {
              if (typeof section === 'function') section()
              if (typeof icon === 'function') icon()
            }
          }),
        'fallback-models: settings section',
      )

      // The shipped model seat's only extension point: the inline label. The
      // contribution preserves the catalog name and adds the fallback glyph.
      ctx.slots.inject('conversation.input.model.label', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.model.label',
            locale: NS,
            inject: () => ({
              form,
              catalog,
              t,
              getLocale: () => {
                try {
                  return ctx.locale.getSnapshot().active
                } catch {
                  return undefined
                }
              },
            }),
          },
          ModelLabel,
        ),
      )

      // There is no slot for an extra row inside the model popup, so the row
      // and its pane are owned DOM nodes attached to the open menu. The model
      // selector stays the single entry point; no composer button is added.
      const extension = new ModelMenuExtension({ form, catalog, t, ctx })
      ctx.effect(() => {
        extension.start()
        return () => extension.stop()
      }, 'fallback-models: model menu extension')
    }

    return { apply, inject, NS }
  },
})
