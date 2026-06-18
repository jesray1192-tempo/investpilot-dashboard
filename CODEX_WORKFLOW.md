# Codex 固定流程便签

## 当前开发策略

- 主开发面：网页端
- 验证方式：网页端先改，再同步到 iPhone App 看效果
- iPhone 壳：已接入 Capacitor，可继续复用

## 日常流程

### 1. 开网页端开发服务

```bash
npm run dev
```

用途：
- 本地改页面
- 浏览器里先看效果

### 2. 网页端改完后，同步到 iPhone App

```bash
npm run ios:sync
```

用途：
- 重新构建前端
- 把最新网页资源同步到 `ios/` 原生工程

### 3. 在 Xcode 里重新安装/刷新到手机

操作：
- 打开 Xcode
- 选中 `Yaping的 iPhone`
- 点左上角运行按钮 `▶`

用途：
- 把最新网页内容更新到手机 App

## 如果我要你直接执行

你可以直接对 Codex 说：

- `按固定流程启动网页端`
- `按固定流程同步到 iPhone`
- `按便签流程继续`
- `打开固定流程便签`

## 相关文件

- 便签文件：[CODEX_WORKFLOW.md](/Users/didi/Documents/New project 2/CODEX_WORKFLOW.md)
- iPhone 工程：[project.xcworkspace](/Users/didi/Documents/New project 2/ios/App/App.xcodeproj/project.xcworkspace)
