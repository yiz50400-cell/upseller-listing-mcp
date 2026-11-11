# 自动上架 Windows 试用版（风格 B）

客户打开软件即可填写并走预览 / 保存草稿。不需要安装 Cursor，也不需要安装 Codex。任务表不再是唯一入口。

## 怎么打开

1. 下载 Windows 64 位便携版：`desktop/dist/UpSeller-Listing-Trial-0.3.0-trial-win-x64.exe`（或 GitHub Actions 产物同名文件）。
2. 双击运行。无需安装。Windows 可能提示未签名应用，选择「仍要运行」即可。
3. 若本机还没有会话：打开左侧「设置」→「登录 Upseller」，在弹出的浏览器里登录。成功后界面只显示 `cookieLen` / `deviceIdLen`，不会显示 Cookie 或 DeviceId。
4. 在「店铺」页添加你自己的目标店铺，再回到「任务」填写产品ID、复制到几店、价格、标题和图片，然后先「预览」，再「保存草稿」。
5. 「发布」会弹出二次确认，默认不会发布。

源码开发调试（本仓库根目录已 `npm install`，并在 `desktop/` 安装 Electron）：

```bash
cd desktop
npm start
```

## 做了哪些

- 深色工作台界面（近黑背景、低对比分隔、单一靛蓝强调色），左侧导航为任务 / 店铺 / 素材 / 设置；上方任务列表，下方编辑表单。
- 软件内直接填写产品ID、复制到几店、价格、标题、主图 / 附图 / SKU图、视频。
- 预览、保存草稿复用现有 `upseller_run_listing` / `upseller_run_batch`；固定每批 8 个。
- 登录复用 `upseller_login`，会话写入本机 `mcp/.env`（打包后写到用户数据目录下的 `mcp/.env`），成功只回长度。
- 示意任务和示意店铺带「示意」标记，不是真实店铺或商品。

## 未完成项 / 限制

- 当前上架能力尚不处理视频：表单可选择并保存在本地，但不会把视频交给预览 / 草稿 / 发布流程。
- 未做代码签名。实机上架仍需 IZ 在真实环境验收，试用版不宣称已实机通过。
- 交叉编译出的 Windows exe 若在目标机器被安全软件拦截，可用 GitHub Actions 的 windows runner 再打一版。
