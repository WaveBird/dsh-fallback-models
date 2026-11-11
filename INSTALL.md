# 安装与验收

本文件面向“在另一台机器/另一个 profile 上装好并验收”的场景。插件本体是 `dsh-fallback-models`，安装动作只走 DSH 的 `plugin_manager`，不要手改 profile 的 `package.json` 或 `cordis.patch.yml`。

## 1. 前置条件

- DeepSeek Harness `0.2.2-rc.1` 或兼容的 `0.2.x`
- Node.js `>= 24.9`（与 DSH 一致）
- 能启动 `dsh web` 或桌面端的 profile
- 插件依赖 `@deepseek-ai/schemastery`（`~3.19.0`）

## 2. 安装

### A. 文件夹链接（开发模式）

```bash
cd /absolute/path/to/dsh-fallback-models
npm install
```

```jsonc
plugin_manager { "action": "install_bundle", "target": "/absolute/path/to/dsh-fallback-models" }
```

特点：本体就是该文件夹，改代码可被 HMR / 刷新拾取；**删除或移动文件夹前必须先卸载**。

### B. tarball（发布模式）

```bash
npm pack
```

```jsonc
plugin_manager { "action": "install_bundle", "target": "/absolute/path/to/dsh-fallback-models-1.0.0.tgz" }
```

特点：profile 里是一份解压副本，源文件夹可删除或移动；升级需改版本、重新 pack、重新安装。

安装成功后，`plugin_manager` 的返回里应能看到 `bundle: dsh-fallback-models`，profile 的 `package.json` 增加依赖，`cordis.patch.yml` 增加一行：

```yaml
- id: fallback-models
  name: dsh-fallback-models
```

## 3. 结构验收（无需打开界面）

1. Host 行与 Config schema：

```jsonc
cordis_inspect_query {
  "platform": "host",
  "provider": "Config",
  "method": "listConfigs",
  "input": { "name": "dsh-fallback-models" }
}
```

应返回 `id: include:fallback-models`、`status: schema`。

2. 浏览器槽位：

```jsonc
cordis_inspect_query {
  "platform": "client",
  "provider": "Slots",
  "method": "listSubTree",
  "input": { "root": "conversation.input.model.label" }
}
```

在 `selected.occupants` 里应有 `fallback-models` 的注册、`active: true`。把 `root` 换成 `settings.section`，同样应看到 `fallback-models`，`order: 12`。

## 4. 界面验收

1. 打开 **设置 → Fallback 模型**：
   - 标题、说明、全局开关、fallback 链、手动添加、高级（数量上限、跳过错误码）都应出现。
   - 点“添加模型”应追加一行，并从模型目录中选一个尚未使用的模型。
   - 修改后底部显示“已保存”；刷新页面后配置仍在。
2. 进入任意会话，点开模型选择：
   - 卡片上方应出现一行 `Fallback 模型` 开关，右侧显示生效数量和来源（“跟随全局”/“本会话”）；会话有自定义配置时开关行右侧还有一个重置按钮。
   - 开关打开时卡片变成 fallback 编辑页：可上移/下移/移除/添加模型；关闭时恢复官方的模型/推理等级页。
   - 启用后列表第 1 个模型会成为当前主模型：最外层模型名称应立刻变成它；调整顺序后应跟随新的第 1 个。
   - 开关写入的是会话级覆盖（`enabled` 字段，附带开启前的 `base` 选择）；列表编辑写入该覆盖的 `fallbacks`。关闭开关会恢复 `base`；点重置按钮删除该会话覆盖，恢复跟随全局。

## 5. 真实回退验收（推荐）

准备：一个可用的 fallback 路由（例如 `workbuddy-mannager-cn/auto`），以及一个可以故意失败的主路由。

1. 在设置页配置全局 fallback 为可用路由。
2. 临时把主 provider 的 API 地址改成一个不可达端口，例如：
   - 设置 → 模型 → DeepSeek → 编辑 → 自定义设置 → API 地址 → `http://127.0.0.1:9/` → 保存。
   - 注意：这会改动当前 profile 的 provider 配置，验收完必须改回原值。
3. 新建/进入一个会话，模型选择器选到该 provider 的模型，发送一句简单提示。
4. 预期：对话正常得到回答，说明主 provider 失败后由 fallback 接管。
5. 核对实际路由：会话日志的 `assistant/message.replayState.response` 会记录真正作答的 `provider/model/responseModel`（取决于 adapter 是否上报）。例如：

```jsonc
"replayState": {
  "response": {
    "provider": "workbuddy-mannager-cn",
    "model": "auto",
    "responseModel": "glm-5.3-flash"
  }
}
```

6. **立即恢复**主 provider 的 API 地址（例如 `http://127.0.0.1:7864/`），保存并确认设置页显示“已保存”。

说明：对话里的模型标签仍然是所选主模型，这是 `llm/stream` 缝隙的已知限制；实际回退路由以上面的 `replayState.response` 和 Host 警告日志为准。

## 6. 卸载

1. `plugin_manager { "action": "remove_bundle", "target": "dsh-fallback-models" }`
2. 检查 profile 的 `cordis.patch.yml`，如残留下面这种覆盖项（切换插件开关时由 plugin_manager 追加），删除：
   ```yaml
   - id: fallback-models
     disabled: false
   ```
3. 开发模式下先卸载再删文件夹；发布模式可随时删文件夹。
4. 若想连同配置一起清掉，删除 `cordis.patch.yml` 中 `- id: fallback-models` 整段（包括 `sessions` 覆盖）。

## 7. 常见问题

| 现象 | 排查 |
|---|---|
| 设置里没有“Fallback 模型” | Host 行未加载，或 `Config` schema 没有被 settings 服务识别。先查 `Config.listConfigs` 的 `name` 查询；再看 profile 的 patch 是否包含 `fallback-models` 行。 |
| 模型卡片上没有开关行 | 当前页面是“新会话英雄区”且尚未绑定 Session 时不会渲染（入口挂在会话模型标签上）；进入一个已有会话再看。也可能是客户端 bundle 未加载：刷新页面，检查浏览器 console。 |
| 菜单里“添加模型”不可用 | 模型目录还在加载，或目录读取失败。设置页底部会显示错误和“重试”；也可在设置页手动填 provider/model。 |
| 保存失败 | 设置文档只读（桌面/远程部署策略），或并发写入导致 revision 冲突；页面会显示失败并回读 Host 最新值。 |
| 回退没有发生 | 开关未打开（会话覆盖 `enabled: false`，或全局关闭且会话未覆盖）；主模型在产生内容后才失败（按设计不回退）；失败码在 `skipCodes` 中；fallback 与主模型是同一 provider/model（去重）；或 fallback 路由不可用（被跳过）。 |
| 开启后最外层模型名没变 | 第 1 个 fallback 路由可能无法被 `session.selectModel` 选中（模型不可用或会话写入冲突）；查看浏览器 console/会话状态。路由可用时会自动选中。 | |
| 会话配置越积越多 | 用会话菜单的“恢复跟随全局”删除单个覆盖，或在设置文档里清空 `sessions`。 |
