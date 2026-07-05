# 本地启动 htmlshare 自托管服务

## 前置条件

- 已安装 Node.js 20 或更高版本。
- 当前目录已经运行 `npm install`。
- 终端可以访问项目根目录。

## 步骤

1. 运行 `npm test`，确认测试通过。
2. 运行 `PORT=8787 node server/server.js` 启动服务。
3. 打开 `http://localhost:8787/healthz`，确认返回 `ok`。
4. 运行 `htmlshare config selfhost http://localhost:8787 <token>` 写入自托管目标。
5. 运行 `htmlshare publish ./note.md --target selfhost` 发布一份 Markdown。

## 常见问题

- 如果端口被占用，换一个 PORT 值重新启动。
- 如果发布返回 401，检查 token 是否与服务端环境变量一致。
