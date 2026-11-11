# 现有 MCP 客户交付说明

版本：0.3.0，2026-11-09。交付形态是现有 stdio MCP 和命令行，不是另一个客户端或工作平台。


## 自动上架试用版（Windows / Mac 桌面）

客户可直接打开 Windows 便携版 exe，或 Mac 上的 `.dmg` / `自动上架.app` 填写并上架，不需要安装 Cursor 或 Codex，也不用先装 Node，也不再把任务表当唯一入口。界面为风格 B 深色工作台。登录仍用本机 `upseller_login` / `mcp/.env`，成功只回长度。打开方法和限制见 [docs/DESKTOP-TRIAL.md](docs/DESKTOP-TRIAL.md)。

从源码运行：先在仓库根目录 `npm install`，再执行 `cd desktop && npm install && npm start`。Windows 便携版：`cd desktop && npm run build:win`。Mac 包需在 macOS 上构建：`cd desktop && npm run build:mac`（Apple Silicon）或 `npm run build:mac:all`（同时出 Intel）。不要把真实 `.env` 或安装包提交进仓。


## 安装与配置

Windows / macOS 使用**同一份**交付包（源码 + package-lock）。安装 Node.js >=22.12.0 及其 npm；需要客户自有 MCP 宿主、可用 UpSeller 账号及目标店授权。凭证只存在**每个客户自己电脑**上的 `mcp/.env`（各自填写自己的 `UPSELLER_COOKIE` 与 `UPSELLER_DEVICE_ID`）。不是由交付方本机代写，也不能多人共用同一登录态或拷贝他人 Cookie。公开源码仓不含任何真实密钥；客户拿到代码后仍须本机安装依赖并自填凭据。可用 GitHub 公开仓、本机目录或 zip 交接源码。

将整个交付目录（或解压 zip）放到客户本机可读写目录；支持中文和空格。不要只复制 `mcp/src`。禁止多人共享同一凭证文件。包内不含 `node_modules` 与真实 `.env`，首次必须本地安装依赖。

### macOS

1. 安装：在解压后的交付目录执行 `sh scripts/install-mcp.sh`（内部为 `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`，缺失时从样例生成 `mcp/.env`，不覆盖已有凭证）。
2. 凭据（推荐）：对 Codex 说「登录 Upseller」调用 `upseller_login`，或运行 `sh scripts/login-upseller.sh`，在弹出浏览器登录后自动写入本机 `mcp/.env`。也可手工编辑 `mcp/.env`；`chmod 600 mcp/.env`。勿把值发到聊天或工单。
3. 自检：`sh scripts/check-mcp.sh` 或 `node scripts/launch.mjs doctor`（只查依赖/运行时/凭证是否非空，不验证登录或网络，不打印凭证值）。
4. 配置宿主：`node scripts/launch.mjs config`（见下节）。必须在**客户自己的机器**上生成；不要使用他人机器上的绝对路径。
5. 启动 MCP：`sh scripts/run-mcp.sh` 或 `node scripts/launch.mjs mcp`。标准输出仅用于 MCP 协议。
6. CLI 任务表：`sh scripts/listing.sh --file tasks.json`（默认预览；写草稿加 `--apply`；发布另需 `--confirm-publish`）。

### Windows

1. 安装：在「命令提示符」进入交付目录，执行 `scripts\install-mcp.cmd`（同样 `npm ci` 锁定依赖；缺失时复制 `mcp\.env.example` → `mcp\.env`，不覆盖已有文件）。
2. 凭据（推荐）：对 Codex 说「登录 Upseller」或运行 `scripts\login-upseller.cmd`，浏览器登录后自动写入本机 `mcp\.env`。也可手工编辑；用当前 Windows 账号 ACL 保护。勿把值发到聊天或工单。
3. 自检：`scripts\check-mcp.cmd` 或 `node scripts\launch.mjs doctor`。
4. 配置宿主：`node scripts\launch.mjs config`（必须在客户本机生成）。
5. 启动 MCP：`scripts\run-mcp.cmd` 或 `node scripts\launch.mjs mcp`。
6. CLI：`scripts\listing.cmd --file tasks.json`。

安装脚本不会执行业务请求或修改商品。启动器默认读取交付目录的 `mcp/.env`，与宿主工作目录无关；可用 `UPSELLER_ENV_FILE` 指向另一本机配置文件。进程环境变量优先（含显式空值）；`.env` 仅载入白名单字段。代理可选：在本机 `.env` 设置 `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`；不需要则保持注释或设 `NODE_USE_ENV_PROXY=0`。

### 登录 Upseller（Codex 友好）

在 **客户自己的电脑** 上，对 Codex 说「登录 Upseller」或「我已在浏览器登录 Upseller」，调用 MCP 工具 `upseller_login`（或运行 `scripts/login-upseller.sh` / `scripts\login-upseller.cmd`）。将打开本机浏览器；登录成功后自动写入本机 `mcp/.env`。成功回执**只含** `cookieLen` / `deviceIdLen`，永不回显 Cookie/DeviceId。每人使用自己的登录态，禁止共用或发送 `.env`。

首次需安装浏览器内核：`npm install` 后执行 `npx playwright install chromium`（安装脚本装依赖后若无浏览器请补跑）。可选持久化资料目录，已登录时可直接抓取。

### 接入 MCP 宿主（Codex / Claude 等；非强制 Cursor）

本服务是本地 **stdio MCP**，不要求安装 Cursor。在客户机器运行 `node scripts/launch.mjs config`，输出含：

- `mcpServers`：可直接合并进 Claude Desktop 的 `claude_desktop_config.json`（macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`；Windows：`%APPDATA%\Claude\claude_desktop_config.json`），保存后重启 Claude。
- `codexToml`：合并进 Codex 的 `~/.codex/config.toml` 中 `[mcp_servers.upseller-listing]`（`command` / `args`）；或使用 `codex mcp add upseller-listing -- <command> <args...>`。
- `stdio`：其它支持本地 stdio 的 MCP 宿主，使用同一 `command` + `args`。

不要把 Cookie/DeviceId 写进宿主配置；凭证留在 `mcp/.env`。移动安装目录或更换 Node 后，在同一台机器重新运行 `config`。`hosts.requiresCursor` 恒为 `false`。

### 排错

| 现象 | 处理 |
|---|---|
| `doctor` 报依赖缺失 | 在交付根目录重跑对应系统的 `install-mcp`；确认能访问 npm 源完成 `npm ci`。 |
| `doctor` 报凭证缺失 | 推荐对 Codex 调用 `upseller_login`，或运行 Mac `sh scripts/login-upseller.sh` / Windows `scripts\login-upseller.cmd`，浏览器登录后自动写入本机 `mcp/.env`；也可手工编辑填入非空 `UPSELLER_COOKIE` / `UPSELLER_DEVICE_ID`。勿提交或外传该文件。 |
| 宿主找不到命令 | 使用 `config` 生成的**本机** Node 绝对路径与 `scripts/launch.mjs` 绝对路径，不要手写他人路径。 |
| 代理相关报错 | 未用代理则设 `NODE_USE_ENV_PROXY=0` 或去掉代理变量；需要代理时换支持 `--use-env-proxy` 的 Node。 |
| 中文/空格路径 | 支持；保持整包目录完整，勿拆散。 |
| 误用仅 Mac 的 `.sh` 于 Windows | Windows 请用配套 `.cmd`；反之亦然。 |


## 使用与发布边界

- upseller_run_batch 是批量并发入口；每条任务须显式提供稳定 taskId，1–1000 条任务进入队列。默认商品并发 8，可设 1–8；按固定分批屏障调度（≤8 一批，>8 按 8、8、余数，批间等待）；8 只是当前保护性软件上限，不是平台或模型极限。CLI 任务表使用相同批量执行器。实测结果见 BATCH-CAPACITY.md。
- upseller_run_listing 是单品连续处理入口：解析店铺和来源 → 图片上传与复制草稿并行 → 价格检查 → 一次保存/发布 → 最终字段核验。途中不要求用户逐步验收。
- 默认 dryRun=true，只预览并查询来源，不复制、不上传、不保存。正式执行要显式 dryRun=false。
- 保存草稿：task.publish=false。发布：task.publish=true 且 confirmPublish=true；少任何一个条件均不发布。
- 旧 upseller_save_draft、upseller_set_images 仍只允许保存草稿；不要用旧工具绕过发布确认。
- 只上传原始文件字节，不压缩、不缩放、不转格式。超平台大小或格式限制的原图应报告问题并由用户更换，不静默加工。
- 商品描述中的 img/picture 会移除，其余文本和 HTML 尽量保留；主图、附图和 SKU 图照常上传。
- 整批共用图片上传并发，默认 3、支持 1–4，不随商品数量相乘。账号内相同原图按哈希复用一次上传；不得将同图批次速度当成全不同素材速度。
- 同来源同店铺复制排队，避免新草稿匹配串单；同店铺从价格检查到最终核验的提交段排队，不同店可并行。商品准备与图片上传并行，而非每个接口无约束并发。
- API 请求默认 20 秒，单个图片 PUT 最多 45 秒；单品工具执行器默认 60 秒，批量/CLI 每商品执行器默认 180 秒（含资源等待，不含前置店铺/来源解析），可设 1–300 秒。整个批次不受这一单品计时器限制；更长超时不代表提速。
- CLI：node scripts/launch.mjs listing --file tasks.json。默认预览；增加 --apply 才写草稿；发布任务还需 --confirm-publish。支持 JSON/CSV/XLSX、--materials、--data-dir、--timeout-ms、--product-concurrency 和 --concurrency。--product-concurrency 控制商品并发/固定分批大小，默认 8、上限 8（≤8 一批全开；>8 按 8、8、余数，上一批完成才启动下一批；可显式更低）；--concurrency 控制整批图片上传数。WPS 旧二进制 .et 需先导出为受支持格式，不直接重命名扩展名。
- 批量调用可能超过 MCP 宿主默认工具超时：按批次长度设置宿主调用超时，或拆成较小批次；取消信号会传入执行器。不要超时后用新 ID 重新发送整批。CLI Ctrl+C/SIGTERM 请求安全取消，在途结果仍需核对。
- taskId 需稳定且唯一；跨机器搬移时明确保留 taskId，不依赖文件位置自动生成。商品/店铺 ID 用字符串，Excel 列设为文本，防止长 ID 精度丢失。
- 新款式替换必须有明确 skuMappings 或明确 replaceDesigns；不猜测颜色对应。

## 网络与一分钟目标

- 计时应包含店铺/来源解析、原图上传、复制、业务提交与最终核验；平台审核另计。冷运行与缓存续跑分开记录；成功保存草稿不等于已发布上线。
- 当前环境的单张 4,796,229 字节原图诊断：直连 31.397 秒、显式本机代理 16.313 秒；这是单张样本，不是整商品承诺，且不能推广到客户网络。
- 不自动接管系统代理或硬编码开发机端口。需要代理时在本机 .env 明确设置 HTTP_PROXY/HTTPS_PROXY/NO_PROXY；支持原生 --use-env-proxy 的 Node 会由启动器启用，旧运行时明确报错而不是静默直连。doctor 显示支持情况。设 NODE_USE_ENV_PROXY=0 可明确禁用。
- 2026-11-06 本机直连、并发 3 的一次冷运行：7 张原图共 19,298,490 字节，7 次全量 PUT、无上传缓存，222 SKU，完整流程 38.903 秒；仅提交一次保存草稿，最终字段核验全通过，并移除描述中 4 张图片。出站 SHA-256 匹配原文件，原文件不变。此为草稿成功样本，不是公开上架或每次低于一分钟的保证。
- 另一次并发 4 的代理冷运行在媒体 callback 阶段网络失败，已保存复制回执，没有业务提交。单图代理更快不等于整商品更稳，因此不把代理设为默认。
- 一分钟目标仍取决于原图总字节、网络吞吐、接口响应与复制时延。网络不稳时保留回执，不以压图、漏图、少 SKU、跳过核验换时间。

## 失败恢复与更新

- 持久化目录默认沿用 ~/.upseller-client（历史目录名，仅为 MCP 数据）；推荐通过 dataDir / --data-dir 指定客户私有目录。它包含账号隔离的回执、图片缓存和 PID 锁。
- 超时、断网或中途取消后，保留同一 taskId、任务内容、账号和 dataDir 续跑。已接受或结果不明的复制/提交会先对账，不盲目重发。认证更换后保持原 dataDir；账号按平台 puid 隔离。
- needs-reconciliation 表示结果待核对，不是失败后可以重新建任务。远端字段不匹配、平台图片 URL 变化或多个复制候选时停下核对，不强制标记成功。
- 已验证完成的任务再次运行返回 already-completed，重用旧回执，不再次提交；这不表示重新核查当前远端状态。
- 账号失效：更新本机凭证并重启 MCP；不要在聊天中贴 Cookie。正在写入时不要强制清锁、删回执或改 taskId。
- 一个商品失败后，停止启动新商品与后续写入，在途请求允许收尾并留回执；未开始项标记 not-started。批量结果按输入顺序返回。
- 同一 MCP 进程阻止同账号并开两个批次；批内复制/提交/上传队列不是跨 CLI 进程或机器的全局限流。不同机器没有分布式锁；同一任务只能由一台机器处理。交接时停旧实例，备份并安全迁移状态目录，再在新机恢复；不要合并正在运行的状态目录。
- 升级前停止 MCP、备份程序、mcp/.env 与状态目录；新程序放独立目录、安装依赖、复用旧状态、重新生成宿主配置。回滚旧程序时保留最新回执，避免重复提交。

## 客户验收与已知边界

交付包由严格白名单生成，带 MANIFEST.json SHA-256 清单；不含真实凭证、商品素材、客户任务、业务回执、旧客户端、历史浏览器脚本或 node_modules。

建议交付方式（默认不上传 GitHub）：向客户提供本机 `releases/upseller-mcp-0.3.0/` 目录，或同目录旁由 `node scripts/pack-mcp-zip.mjs` 生成的白名单 zip（及 `.sha256`）。客户解压/拷贝后按上文本机安装。zip 仅含 MANIFEST 所列文件 + MANIFEST 本身，不含凭据与 node_modules。

验收顺序：空白目录安装 → doctor → MCP 初始化/6 工具枚举 → 仅预览 → 指定测试店的草稿执行 → 同任务续跑无重复 → 明确授权后单品发布及平台最终状态确认。每个系统记录 OS/CPU/Node/网络、原图字节数、冷/缓存、总耗时、商品状态。

本机 macOS 检查及源码回归不能代替 Windows 实机验收。Windows、另一种 CPU 架构、客户实际网络、真实断网/强退/升级恢复与公开上架仍需对应场景的证据。当前使用已观察到的 UpSeller HTTP 接口，平台变更可能需要维护；不能宣称永久稳定。

## 本次交付验证记录（2026-11-06）

| 项目 | 结果 |
|---|---|
| 开发目录完整回归 | 65 项通过 |
| 白名单交付目录全新依赖安装、语法检查 | 本机 macOS arm64 / Node 26.8.1 通过 |
| 交付回归子集 | 17 项通过，包含中文空格路径、MCP stdio、原图字节与配置安全 |
| 原图冷执行 | 38.903 秒，7 图 / 19.3 MB / 222 SKU，仅保存草稿 |
| 代理失败后的同任务直连续跑 | 26.527 秒；复用同一草稿，0 次重新复制、1 次最终保存 |
| 已完成任务经真实 MCP stdio 再执行 | 2.225 秒，already-completed，0 次上传、0 次业务提交；仅回执防重验证 |
| Windows 实机、其它 CPU 架构 | 未执行，不能视为已验收 |
| 新连续流程正式发布与平台图片 URL 转换后的完整对账 | 待指定测试商品验收；本轮未重复发布已上线商品 |

网络失败已在恢复流程中保留并验证，没有从速度统计中删除失败样本。此次草稿单样本低于一分钟，不构成客户网络的 SLA。

## 0.3.0 补充验收（2026-11-08）

新增批量任务队列、商品/上传双层并发、同店写入排队、同图在途去重，以及失败停发和取消恢复测试。真实 2/4/8 档草稿结果及完整回归/交付子集计数见 BATCH-CAPACITY.md。

此前同任务表单品原图发布测试：提交受理 26.149 秒，首次回读 27.437 秒，平台随后显示 reviewing；图库被平台换成 CDN URL 后严格字段对账仍未全部通过。此记录不能算最终公开上架验收，也不能据此承诺批量发布速率。此次并发测试仅创建带标记草稿，不再发布或修改这些历史商品。Windows 实机验收仍未执行。
