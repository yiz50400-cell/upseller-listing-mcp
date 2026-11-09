# UpSeller HTTP MCP

现有 stdio MCP，直接调用 HTTP，不通过浏览器自动化。客户部署请使用根目录 docs/MCP-DELIVERY.md。

## 入口

从交付目录安装依赖并填写 mcp/.env：

    node scripts/launch.mjs doctor
    node scripts/launch.mjs config
    node scripts/launch.mjs mcp
    node scripts/launch.mjs listing --help

环境变量：UPSELLER_COOKIE、UPSELLER_DEVICE_ID，及可选 UPSELLER_SAVE_OP=1。不得把值写到聊天、日志、样例或交付包。
配置由 config 命令生成（同时给出 Claude 用 mcpServers JSON 与 Codex 用 mcp_servers TOML）；Cursor 非强制。不依赖所有宿主都支持环境变量占位符展开。客户须在本机生成配置，勿复用他人绝对路径。

## 六个工具

- upseller_run_batch：任务表批量入口，商品并发默认 8、可设 1–8（固定分批：≤8 一批全开；>8 按 8、8、余数，上一批全部完成才启动下一批；显式更低时同为固定分批大小）；整批图片上传共用默认 3 路，发布确认与回执防重同单品入口。8 是保护性配置上限，不是平台承载上限；实测范围见 docs/BATCH-CAPACITY.md。
- upseller_run_listing：连续处理入口。默认预览；dryRun=false 才执行，task.publish=true 与 confirmPublish=true 同时成立才发布；稳定 taskId 用于回执恢复与防重。
- upseller_get_draft：读取商品/草稿详情，响应去除大型原始数据。
- upseller_upload_media：原文件 generate-sign → COS PUT → callback；不压缩、不缩放、不转格式。
- upseller_save_draft：旧版保存工具，仅允许 op=1，默认 dryRun=true，anyway=false。
- upseller_set_images：原图上传、完整图库及 SKU 图替换后保存草稿；默认 dryRun=true，不发布。

连续入口自动清理描述中的图片，保留其它文本/HTML。图片上传与复制并行；价格检查后只提交一次，再统一验证字段。
主图/附图顺序由 imgUrl 决定；resourceUriMap 是平台资源元数据，不是图库计数。
COS 的 online-product/... key 不是 TikTok tos URI，不得伪造映射；保留平台明确返回的 tos-* 资源映射。

## 检查

在根目录运行 npm run check、npm test；交付包仅包含自包含的部署/协议/原图/HTTP 回归子集，开发目录运行完整回归。
通过检查不等于客户 Windows/macOS 实机、网络和公开发布都已验收；按交付说明逐项记录。

批次同店提交排队；同来源同店复制排队；不同店铺提交可并行。首个错误停止新的任务、复制、上传和提交，已发请求收尾并保存回执。取消后仍使用原 taskId 和数据目录。限制只在单批次/当前 MCP 进程生效，不是跨机器全局锁。
