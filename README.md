# SGAR

《STEINS;GATE × タカラッシュ「自己言及のダイナミクス」》中日双语浏览器版，支持故事模式与解谜模式。

- [在线游玩 / ブラウザーで遊ぶ](https://fluphus.github.io/sgar/)
- [下载 Windows 离线版 / Windows オフライン版](https://github.com/fluphus/sgar/releases/latest/download/sgar-offline.zip)
- [版本记录 / リリース](https://github.com/fluphus/sgar/releases)

支持简体中文与日本語，首次按浏览器语言偏好选择；手动选择会被记住，也可在设置里恢复“跟随浏览器”。故事模式省略纸质材料谜题，两种模式均保留 D-Mail 交互。

## 游玩

在线版直接打开网页。离线版请完整解压 ZIP，双击“开始游玩.cmd”；Windows 使用自带 PowerShell 启动，不需要安装 Python 或 Node。

点击画面、空格或 Enter 推进；上滚回看，下滚推进。按住 Ctrl 快进，遇到操作点停止。章节头图默认等待点击，自动播放时停留六秒。存档保存在当前浏览器，可通过菜单导出／导入，切换设备或网站地址时请自行迁移。

## 本地开发

本项目是原生 HTML、CSS、JavaScript 与本地媒体，没有后端或构建步骤。克隆后可用任意静态服务器预览。例如已安装 Python 3 时：

~~~sh
git clone https://github.com/fluphus/sgar.git
cd sgar
python -m http.server 8080 --bind 127.0.0.1
~~~

浏览器打开 http://127.0.0.1:8080/。媒体总量约 248 MB，按剧情读取；Windows 离线 ZIP 单独通过 Releases 分发，不纳入此 Git 仓库。

## 内容与素材

包含主线 11 个分段、原作日语配音和音乐、场景与道具、D-Mail、六次世界线变化，以及 AR 杯垫的角色和语音。

剧情资源来自 Internet Archive 的 xrcity_steinsgate 存档，活动主视觉与信息来自[原活动官网](https://huntersvillage.jp/blacklabel/promo/steinsgate/)。部分缺失场景使用经选择的原作 VN 背景；前五段世界线变化为重制，第六段保留官网素材。

原作、图片、音乐、配音及其他素材的权利归 MAGES.、Nitroplus、NTT コノキュー、タカラッシュ及各权利人所有。字体版权说明保留在 assets 中。

## 日本語

『自己言及のダイナミクス』のブラウザー版です。簡体字中国語と日本語、ストーリー／謎解きモードに対応しています。言語はブラウザーに合わせて選び、手動設定も保存します。セーブはメニューから書き出し・読み込みができます。
