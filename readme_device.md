# serve-device 真机验证命令

本地 monorepo 里用 **USB 真机**（不是模拟器）跑 `serve-device` 的常用命令记录。

> 模拟器用 `serve-sim`（默认端口 3200）。  
> 真机用 `serve-device`（默认端口 4200，状态目录 `$TMPDIR/serve-device`）。

## 本机已知信息

| 项 | 值 |
|---|---|
| 设备名 | apple的iPhone |
| 硬件 UDID（推荐） | `00008150-00156C6C3A40C01C` |
| CoreDevice Identifier | `C5094E0B-3B51-57E9-B8AB-7A2BD74F280B` |
| Apple Team ID | `D2XBEJ6876`（证书显示名里的 `F492KQXQS8` **不要**当 Team ID） |
| CLI（本地构建） | `node packages/serve-device/dist/serve-device.js` |
| 预览地址 | http://localhost:4200 |

可先设环境变量，后面命令更短：

```bash
cd /Users/apple/workspace/github/serve-sim

export CLI="node packages/serve-device/dist/serve-device.js"
export UDID="00008150-00156C6C3A40C01C"
export TEAM="D2XBEJ6876"
```

查当前 USB 设备：

```bash
xcrun devicectl list devices
```

## 1. 构建本地 CLI

```bash
bun install
bun run --filter serve-device build
# 产物：packages/serve-device/dist/serve-device.js
```

## 2. Doctor（检查环境）

```bash
$CLI doctor -d "$UDID"
# 或
$CLI doctor --device "$UDID" --json
```

预期：

- setup **前**：`device.usb` OK，`wda.reachable` FAIL
- setup **后**（且已端口转发）：`wda.reachable` OK

## 3. Setup WebDriverAgent（触摸依赖）

```bash
$CLI setup --device "$UDID" --team-id "$TEAM"
```

说明：

- 会 clone 到 `~/Library/Caches/serve-device/wda`（已存在则复用）
- 跑 `xcodebuild … WebDriverAgentRunner … test`，可能要几分钟
- 手机上如有提示：信任此电脑 / 打开开发者模式 / **Settings → General → VPN & Device Management → 信任开发者**
- 若签名失败，用 Xcode 打开工程签一次：

```bash
open ~/Library/Caches/serve-device/wda/WebDriverAgent.xcodeproj
# Signing & Capabilities → Team 选 Linyu He (D2XBEJ6876)，再重跑 setup
```

## 4. WDA 端口转发（本机若没有 `iproxy`）

```bash
brew install libimobiledevice
iproxy 8100 8100
# 另开终端保持运行；默认 WDA URL：http://127.0.0.1:8100
# 也可：export SERVE_DEVICE_WDA_URL=http://127.0.0.1:8100
```

然后再跑一次：

```bash
$CLI doctor -d "$UDID"
```

## 5. 截图（不依赖 WDA）

```bash
$CLI screenshot --device "$UDID" -o /tmp/serve-device-shot.png
open /tmp/serve-device-shot.png
```

## 6. 启动预览流（浏览器）

前台：

```bash
$CLI --device "$UDID" -p 4200
# → http://localhost:4200
```

后台：

```bash
$CLI --detach --device "$UDID" -p 4200 -q
$CLI --list
```

停止本工具的服务（不影响 `serve-sim`）：

```bash
$CLI --kill
```

## 7. 触摸 / 手势 / Home（需要 WDA 已通）

```bash
$CLI tap 0.5 0.5 -d "$UDID"
$CLI button home -d "$UDID"
$CLI gesture '[{"type":"begin","x":0.5,"y":0.7},{"type":"move","x":0.5,"y":0.3},{"type":"end","x":0.5,"y":0.3}]' -d "$UDID"
```

坐标为归一化 **0..1**（与 `serve-sim` 一致）。

## 8. 安装 / 启动 App

```bash
$CLI install /path/to/App.app -d "$UDID"
$CLI launch com.example.app -d "$UDID"
```

## 9. 与 serve-sim 共存检查

```bash
$CLI --list          # 真机服务（4200）
# serve-sim --list   # 模拟器服务（3200），两边状态目录隔离
$CLI --kill          # 只停 serve-device
```

## 验收清单（抄自包 README）

1. `doctor` → USB OK，WDA 未 setup 时 FAIL  
2. `setup --team-id D2XBEJ6876`  
3. `iproxy 8100 8100`（如需要）  
4. `doctor` → WDA OK  
5. `serve-device -d $UDID` → 浏览器有画面  
6. `tap 0.5 0.5` → 屏幕中央有点击  
7. `--kill` 不影响正在跑的 `serve-sim`

## 常见问题

| 现象 | 处理 |
|------|------|
| `required option '-d/--device' not specified` | 使用已 build 的本地 CLI（含 `enablePositionalOptions` 修复） |
| `Could not resolve device: C5094…` | 可用 Identifier / 硬件 UDID / 设备名；旧版本只认硬件 UDID |
| `No Account for Team "F492KQXQS8"` | Team ID 用 **`D2XBEJ6876`**，不要用证书括号里的串 |
| `No profiles for …WebDriverAgentRunner` | Xcode 登录 Apple ID，或打开 WDA 工程选 Team 后再 setup |
| `wda.reachable FAIL` | 重跑 setup；信任开发者证书；`iproxy 8100 8100` |
| USB 列出但 tunnel unavailable | 解锁手机、重插线、信任电脑、开开发者模式 |

## 相关文档

- 包说明：`packages/serve-device/README.md`
- Agent skill：`skills/serve-device/SKILL.md`
- 工作流：`skills/serve-device/references/workflows.md`
