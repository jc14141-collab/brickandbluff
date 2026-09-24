# BRICK & BLUFF · 积木牌局

体素风多人桌游，包含德州扑克、21 点、美国轮盘、花旗骰、掼蛋与大老二（锄大D）。

本仓库为线上第 98 版的完整源码快照，包含全部六种玩法及最新更新：

- 德州盲注可选 10/20 至 500/1000，人机初始筹码与入场门槛为 100 BB。
- 掼蛋、大老二支持长按滑动选牌；大老二支持局内托管及 50–500 牌值选择。
- 轮盘与花旗骰支持自定义下注金额；轮盘支持即时下注反馈和单区撤回模式。
- 结算、技能费用与奖励统一四舍五入为整数筹码。

对应原发布仓库提交：`fab2345a0bbdf66b9fb8ff7bbe95643165315c5f`。

## 项目结构

- `dist/`：**前端源码**、CSS、角色模型、图片、字体与音视频资源。该目录不能当作普通构建缓存删除。
- `server/`：Cloudflare Workers 服务端、多人房间、玩家管理与结算逻辑。
- `db/`、`drizzle/`：数据库结构与历史迁移文件。
- `scripts/build.mjs`：前端分包、资源压缩和 Worker 构建。
- `tests/`：玩法、资金结算、布局、资源及回归测试。
- `docs/`：美术与骰子物理说明。
- `PERFORMANCE.md`：性能优化记录及尚未解决的架构限制。
- `.openai/hosting.json`：原 Sites 项目的标识及逻辑数据库绑定，内含的项目 ID 不是登录凭证。

## 安装与构建

使用 Node.js 24 和 npm：

```sh
npm ci
npm run build
```

生成的 Worker 入口是 `dist/server/index.js`，中间资源位于 `.build/`。这两个生成目录以及 `node_modules/` 均不提交。

本项目没有 `npm start` 脚本。多人功能需要 Workers 运行环境和 D1 数据库，直接打开 HTML 或仅启动静态文件服务器不能运行完整游戏。

## 回归测试

先构建，再执行与最近修复相关的测试：

```sh
node --test --test-isolation=none tests/deal-controls.test.mjs tests/build-performance.test.mjs tests/multiplayer-client.test.mjs tests/club.test.mjs tests/worker.test.mjs tests/guandan-layout.test.mjs
```

其他专项测试见 `tests/README.md`。部分早期测试保留了已取消的入口密码机制，不应将其结果与当前机制混淆。

## 数据与部署

- 原线上地址：https://brick-and-bluff.jc14141.chatgpt.site/
- 当前部署通过 Sites 完成，GitHub 上传本身不会自动更新线上游戏。
- D1 绑定名称为 `DB`。已有数据库迁移必须按顺序保留；不要重写已应用迁移。
- 管理员认证等运行时配置需要在部署环境单独提供，相关校验见 `server/admin-auth.mjs`。
- 本仓库不包含线上玩家资料、筹码数据库、管理员密码、访问令牌或其他部署密钥。
- 图片、字体和第三方引擎附带的许可文件保留在 `dist/art/`、`dist/vendor/` 等位置。没有额外授予整套项目统一的开源许可。

后续修改可在此仓库维护；上线仍需执行构建并使用对应的部署流程。
