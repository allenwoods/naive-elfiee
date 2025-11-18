# 远程 Ubuntu 上通过 SSH + X11 测试 Tauri 应用执行指南

> 场景：你在本地（macOS）通过 SSH 连接远端（Ubuntu）服务器，使用 X11 转发，将远端 Tauri 应用窗口显示到你的 Mac 上，验证「能否正常启动并显示窗口」。

---

## 1. 准备目标与验收标准
- 目标：在你的 Mac 上看到从远端运行的应用窗口，并可正常交互。
- 验收：窗口成功显示，无报错（尤其是 WebKit/GTK 相关），基本交互正常。
- 成果：验证 AppImage 与 DEB 两种包的运行情况（以 AppImage 为主，DEB 为辅）。

---

## 2. 本地（macOS）准备
1) 安装并启动 XQuartz（X11 服务）
```bash
brew install --cask xquartz
```
- 安装后建议重启或注销/登录一次。
- 打开 XQuartz → 偏好设置 → 安全，确认已允许网络客户端连接（一般默认即可）。

2) 可选：若后续显示授权有问题，可在 XQuartz 终端执行：
```bash
xhost +local:
```

3) 启用 XQuartz 的 Indirect GLX（IGLX）以支持远程 GLX：
```bash
defaults write org.xquartz.X11 enable_iglx -bool true
```
- 退出并重启 XQuartz（或注销/登录）后再进行 SSH 连接。
- 如遇 WebGL/GLX 相关错误（例如 “No matching fbConfigs or visuals found”），此设置通常能解决。

---

## 3. 远端（Ubuntu）准备
1) 登录服务器（启用可信 X11 转发）：
```bash
ssh -Y -C syntrust@14.103.140.194
```
- `-Y`：可信 X11 转发；`-C`：启用压缩以提升交互体验。

2) 安装 X11 与 Tauri GUI 运行依赖：
```bash
sudo apt update
sudo apt install -y xauth x11-apps libfuse2 libgtk-3-0 libayatana-appindicator3-1
# WebKit 组件：根据系统版本选择其一
sudo apt install -y libwebkit2gtk-4.0-37 || sudo apt install -y libwebkit2gtk-4.1-0
```
- 注：在 Ubuntu 24.04（noble）上，优先安装 `libwebkit2gtk-4.1-0`；你的环境若显示 24.04，直接执行：
```bash
sudo apt install -y libwebkit2gtk-4.1-0
```
- 若 `libwebkit2gtk-4.0-37` 不存在，通常在 Ubuntu 24.04 用 `libwebkit2gtk-4.1-0`。
- 必要时启用 `universe` 源：
```bash
sudo add-apt-repository -y universe && sudo apt update
```

3) 架构与版本确认（非必需）：
```bash
uname -m        # 期望 x86_64
lsb_release -a  # 建议 Ubuntu 22.04；其它版本也可先用 AppImage 测试
```

---

## 4. 连接与 X11 显示验证
1) 确认显示变量：
```bash
echo $DISPLAY  # 应显示类似 localhost:10.0
```

2) 测试 X11 转发是否正常：
```bash
xeyes &   # 或 xclock &
```
- 应在你的 Mac 上弹出测试窗口；若无窗口，见“常见问题排查”。

### 4.1 跳板/多跳连接保持 X11 转发
- 如果必须通过中间主机（如 `nhrouter`）连接目标机，请在 Mac 上使用带跳板的命令：
```bash
ssh -Y -C -J syntrust@nhrouter syntrust@14.103.140.194
```
- 或配置 `~/.ssh/config` 保持 X11 转发：
```
Host volcanosrv
  HostName 14.103.140.194
  User syntrust
  ProxyJump syntrust@nhrouter
  ForwardX11 yes
  ForwardX11Trusted yes
  Compression yes
```
- 然后直接：
```bash
ssh volcanosrv
```
- 注意：在中间主机（如 `nhrouter`）上执行 `echo $DISPLAY` 为空是正常的；窗口会显示到你的 Mac，仅当你从 Mac 发起的最终到目标机的会话启用了 `-Y`（或配置了 `ForwardX11`）时，目标机上的 `$DISPLAY` 才会有值。

---

## 5. 传输打包文件到远端
在你的 Mac 本地执行（将本地目录复制到远端 `~/elfiee`）：
```bash
scp -r /Users/daiming/Downloads/elfiee-ubuntu-22 syntrust@14.103.140.194:~/elfiee
```

---

## 6. 测试 AppImage 包（推荐，最快）
1) 在远端执行：
```bash
cd ~/elfiee/appimage
chmod +x elfiee_0.1.0_amd64.AppImage
# 如遇服务器无 GPU，可强制软件渲染以提高稳定性：
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 ./elfiee_0.1.0_amd64.AppImage
```

2) 若提示 FUSE 相关错误（如无法挂载 AppImage）：
```bash
./elfiee_0.1.0_amd64.AppImage --appimage-extract
# 运行解包后的 AppDir
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 ./squashfs-root/AppRun
```

3) 也可以直接运行已打包的 AppDir（无需解压 AppImage）：
```bash
cd ~/elfiee/appimage/elfiee.AppDir
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 ./AppRun
```

---

## 7. 测试 DEB 包（Ubuntu 原生安装）
1) 在远端安装：
```bash
cd ~/elfiee/deb
sudo apt install -y ./elfiee_0.1.0_amd64.deb
# 如提示依赖问题：
sudo apt -f install
```

2) 查装好的二进制路径并运行：
```bash
dpkg -L elfiee | grep '/usr/bin'
# 假设输出为 /usr/bin/elfiee
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 /usr/bin/elfiee
# 或直接：
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 elfiee
```

---

## 8. 验收标准
- 在你的 Mac 上看到应用窗口。
- 能正常交互，无崩溃或明显报错（尤其是 WebKit/GTK）。
- 通过 AppImage 与 DEB 任一方式运行成功，即可判定远端环境满足最小可用。

---

## 9. 常见问题排查
- “Cannot open display” 或无窗口：
  - 本地使用 `ssh -Y` 登录；远端已安装 `xauth`；本地 `XQuartz` 正在运行。
  - 重新登录后再试；如仍不行，在 XQuartz 终端执行：`xhost +local:`。

- AppImage FUSE 报错：
  - 确保已安装 `libfuse2`。
  - 仍有问题，使用 `--appimage-extract` 并运行 `squashfs-root/AppRun`。

- WebKit/GTK 相关崩溃或加载异常：
  - 确认安装了 `libwebkit2gtk`、`libgtk-3-0`、`libayatana-appindicator3-1`。
  - 若 `libwebkit2gtk-4.0-37` 不存在，换 `libwebkit2gtk-4.1-0`。
  - 设置 `GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1` 以避免远端无 GPU 导致的渲染问题。

- 出现 “No matching fbConfigs or visuals found”：
  - 在 Mac 端启用 IGLX：`defaults write org.xquartz.X11 enable_iglx -bool true`，退出并重启 XQuartz 后重连。
  - 在远端运行时加入：`LIBGL_ALWAYS_INDIRECT=1`（与上面的环境变量一并设置）。
  - 仍有问题时安装工具检查 GLX：`sudo apt install -y mesa-utils && glxinfo -B`，确认 GLX 可用；也可继续使用 `WEBKIT_DISABLE_COMPOSITING_MODE=1` 强制关闭加速合成。

- 性能或显示延迟很高：
  - 使用 `ssh -Y -C`（已启用压缩）。
  - 在网络低峰期或更接近服务器的网络环境下测试。

---

## 10. 可选：一键化脚本（便于复用）
> 说明：以下脚本仅为示例，建议复制到对应环境的终端执行。

- 远端初始化脚本（Ubuntu）：
```bash
# 远端执行
sudo apt update
sudo apt install -y xauth x11-apps libfuse2 libgtk-3-0 libayatana-appindicator3-1
sudo apt install -y libwebkit2gtk-4.0-37 || sudo apt install -y libwebkit2gtk-4.1-0
```

- 远端测试 AppImage：
```bash
cd ~/elfiee/appimage
chmod +x elfiee_0.1.0_amd64.AppImage
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 ./elfiee_0.1.0_amd64.AppImage || {
  ./elfiee_0.1.0_amd64.AppImage --appimage-extract
  GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1 ./squashfs-root/AppRun
}
```

- 远端测试 DEB：
```bash
cd ~/elfiee/deb
sudo apt install -y ./elfiee_0.1.0_amd64.deb || sudo apt -f install
bin=$(dpkg -L elfiee | grep '/usr/bin' | head -n1)
LIBGL_ALWAYS_SOFTWARE=1 "$bin"
```

---

## 11. 清理与卸载（可选）
- 清理 AppImage 解包目录：
```bash
rm -rf ~/elfiee/appimage/squashfs-root
```

- 卸载 DEB 安装：
```bash
sudo apt remove -y elfiee
```

---

## 12. 安全与注意事项
- 使用 `-Y` 可信转发仅在你信任的远端主机时启用；避免在不可信环境中使用。
- X11 转发仅用于功能性验证；如需完整桌面体验（托盘、通知、窗口管理一致性），可考虑在远端安装精简桌面并用远程桌面连接（xrdp）。

---

## 13. 后续
- 若你需要把这些步骤自动化，我可以将上述脚本拆分为本地与远端两部分，一键执行，并在你执行过程中实时协助排查。