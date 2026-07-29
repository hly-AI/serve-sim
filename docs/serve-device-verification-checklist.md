# serve-device 验证清单（当前实现）

> 分支建议：`serve-device-wad`（基于 `serve-device`，用于验收现有能力，不改触控栈）。  
> 目的：先判定「现在实现了什么、算不算完成」，再据此写**逐步操作手册**。  
> 操作命令细节可对照仓库根目录 [`readme_device.md`](../readme_device.md) 与 [`packages/serve-device/README.md`](../packages/serve-device/README.md)。

## 完成标准（怎么算过）

| 级别 | 含义 | 必须通过的章节 |
|------|------|----------------|
| **最小完成（能看）** | 构建、医生检查基础项、USB 截图与预览流、状态隔离 | A + B |
| **闭环完成（能看又能点）** | 在最小完成之上，WDA 可 setup、doctor 变绿、tap/gesture/home | A + B + C |
| **发布级** | 再加 install/launch；并在文档写清不做项 | A + B + C + D，且 E 已声明 |

每条验证请记录：**通过 / 失败 / 跳过**，失败时附错误原文与环境（机器、Xcode、设备 iOS、是否 `iproxy`）。

---

## A. 环境与构建

| ID | 验证项 | 期望结果 | 结果 |
|----|--------|----------|------|
| A1 | 本地能构建 `serve-device` CLI | 存在 `packages/serve-device/dist/serve-device.js` | ☐ |
| A2 | `doctor` 主机检查 | `host.darwin` / `host.node` / `host.xcrun` / `host.devicectl` 均为 OK | ☐ |

---

## B. USB / 协议层（不依赖 WDA）

| ID | 验证项 | 期望结果 | 结果 |
|----|--------|----------|------|
| B1 | 设备可被解析 | 可用硬件 UDID / 设备名（及文档声明支持的 Identifier）定位到同一台真机 | ☐ |
| B2 | 截图 | `screenshot` 写出可打开的图片文件 | ☐ |
| B3 | 预览流（前台） | `serve-device -d <udid> -p 4200`，浏览器打开预览页有**持续更新**的画面 | ☐ |
| B4 | `--detach` / `--list` | 后台启动后 `--list` 能看到该设备的 pid/port/url | ☐ |
| B5 | `--kill` | 能停掉本工具记录的 serve-device 进程；预览不再可用 | ☐ |
| B6 | 与 `serve-sim` 状态隔离 | 真机服务运行时，`serve-sim --list` **不出现** serve-device 条目；`serve-device --kill` **不**停掉正在跑的 serve-sim | ☐ |

---

## C. WDA / 触控（闭环关键）

| ID | 验证项 | 期望结果 | 结果 |
|----|--------|----------|------|
| C1 | setup **前** doctor | `device.usb` OK；`wda.reachable` **FAIL**（预期） | ☐ |
| C2 | `setup --team-id` | 能完成（或可复现的签名引导）；手机侧信任开发者证书 | ☐ |
| C3 | 端口转发（如需要） | WDA 可从本机 `http://127.0.0.1:8100`（或 `SERVE_DEVICE_WDA_URL`）访问 | ☐ |
| C4 | setup **后** doctor | `wda.reachable` OK；尽量 `wda.session` OK | ☐ |
| C5 | `tap` | `tap 0.5 0.5` 在屏幕中央有可见点击 | ☐ |
| C6 | `gesture` | 一段 begin/move/end 拖动手势有可见滑动 | ☐ |
| C7 | `button home` | 有 Home/回桌面效果，或得到明确的「不支持」错误（勿静默失败） | ☐ |

---

## D. 安装 / 启动 App（建议有则测）

| ID | 验证项 | 期望结果 | 结果 |
|----|--------|----------|------|
| D1 | `install` | 指定 `.app`（或文档支持的包格式）能装到目标机 | ☐ |
| D2 | `launch` | 指定 bundle id 能拉起 App | ☐ |

---

## E. 本轮明确不验收（文档需写清「未支持」）

下列项**不是**当前「完成」的阻塞项；验证时若误测失败，记为「范围外」即可。

| ID | 项 | 说明 |
|----|----|------|
| E1 | Expo / Connect middleware | v1 不做 |
| E2 | camera 注入 | v1 不做 |
| E3 | permissions / AX / UI 选项对等 serve-sim | v1 不做 |
| E4 | Wi‑Fi 真机传输 | API 预留，v1 仅 USB |
| E5 | Android | 类型预留，未实现 |
| E6 | 与 serve-sim 完整 Web UI 对等 | 真机现为最小预览页 |

---

## 建议验收顺序（写操作步骤时按此展开）

1. A1 → A2  
2. B1 → B2 → B3 → B4 → B5 → B6  
3. C1 → C2 → C3 → C4 → C5 → C6 → C7  
4. （可选）D1 → D2  
5. 对照 E，确认 README / skill 未虚假承诺  

---

## 结论栏（验收人填写）

- 达到级别：☐ 未达最小 / ☐ 最小完成（能看） / ☐ 闭环完成（能点） / ☐ 发布级  
- 阻塞问题（ID + 现象）：  
- 环境摘要（Mac / Xcode / iOS / 是否 iproxy）：  
- 日期 / 验收人：  

---

## 相关文件

- 本机命令备忘：`readme_device.md`  
- 包说明与 Verification checklist：`packages/serve-device/README.md`  
- Agent 工作流：`skills/serve-device/references/workflows.md`  
