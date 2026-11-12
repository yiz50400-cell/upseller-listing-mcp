# 自动上架试用版（风格 B，Windows / Mac）

客户打开软件即可填写并走预览 / 保存草稿。不需要安装 Cursor，也不需要安装 Codex，也不用先装 Node。任务表不再是唯一入口。

## 怎么打开

### Windows

1. 使用 64 位便携版：`UpSeller-Listing-Trial-0.3.4-trial-win-x64.exe`（或 GitHub Actions 产物同名文件）。
2. 双击运行。无需安装。未签名时 Windows 可能提示 SmartScreen，选择「仍要运行」即可。

### Mac（Apple Silicon 优先，也可出 Intel 包）

1. 使用对应芯片的磁盘映像，例如 Apple Silicon：`UpSeller-Listing-Trial-0.3.4-trial-mac-arm64.dmg`（Intel 为 `...-mac-x64.dmg`）。同名 `.zip` 里是可以直接拷走的 `自动上架.app`。
2. 双击打开 `.dmg`，把自动上架拖到「应用程序」或直接从映像里打开。
3. 试用包未做 Apple 开发者签名。若提示「无法打开，因为无法验证开发者」：按住 Control 再单击图标，选择「打开」，或到「系统设置 → 隐私与安全性」里点「仍要打开」。
4. 若提示「已损坏，不能打开」：这是未签名应用被隔离，不是文件真的坏了。在「终端」执行（把路径换成实际位置）：
   `xattr -cr "/Applications/自动上架.app"`
   然后再打开。

### 登录与上架（Windows / Mac 相同）

1. 若还没有登录：打开左侧「设置」，状态会显示「已登录 Upseller」或「未登录」。未登录时点「登录 Upseller」，已登录时点「重新登录」。软件会弹出登录窗口（使用软件自带的浏览器，不必先装 Node，也不用执行 `npx playwright install`）。登录是否有效会做一次轻量校验，不只看本地文件长度。界面不会显示账号内容。
2. 在「任务」页勾选产品，填写产品ID、目标店铺、复制到几店、价格、标题和图片。目标店铺可在表单里点「添加店铺」。先「预览」，再用主按钮「保存草稿」。
3. 「发布」不是默认操作，会弹出二次确认。示意商品显示为「示例」，不能预览或上架，请先添加真实产品并填写产品ID。
4. 侧栏只有「任务」和「设置」。请先退出旧版（包括仍挂着的 0.3.0 / 0.3.1 安装盘），只打开本页写明的 0.3.4-trial 包。

源码开发调试（本仓库根目录已 `npm install`，并在 `desktop/` 安装 Electron）：

```bash
cd desktop
npm start
```

Windows 便携版：`cd desktop && npm run build:win`  
Mac 包（需在 macOS 上构建）：`cd desktop && npm run build:mac`（仅 Apple Silicon）或 `npm run build:mac:all`（arm64 + Intel）。

## 做了哪些

- 深色工作台界面（近黑背景、低对比分隔、单一靛蓝强调色），左侧导航为任务 / 设置；上方任务列表，下方编辑表单。
- 软件内直接填写产品ID、复制到几店、价格、标题、主图 / 附图 / SKU图、视频。
- 预览、保存草稿复用现有 `upseller_run_listing` / `upseller_run_batch`；固定每批 8 个。
- 登录复用 `upseller_login` 的会话写入方式，但试用包用软件自带的登录窗口，不再依赖本机 Playwright 缓存。会话写入本机用户目录下的 `mcp/.env`，界面只显示「已登录 Upseller」或「未登录」。登录状态会向 Upseller 做一次轻量校验。
- 示意商品显示为「示例」，不能预览或上架。空店铺列表不会再塞入示意店名。

## 未完成项 / 限制

- 当前上架能力尚不处理视频：表单可选择并保存在本地，但不会把视频交给预览 / 草稿 / 发布流程。
- 未做代码签名。实机上架仍需 IZ 在真实环境验收，试用版不宣称已实机通过。
- Windows / Mac 安装包不要提交进仓；用 GitHub Actions 产物或本机 `desktop/dist/`。


任务列表有清楚的「添加产品」按钮，可新增一行再填写信息。列表里的产品（包括示意示例）都可以单条删除或删除所选，删掉后不会再自动出现。
