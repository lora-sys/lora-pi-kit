# Samuel Video Coach v2.0

这是一个面向“第一次拍视频的人”的可移植 Agent Skill。

它不会只给你一份专业但难执行的分镜表，而是会像导演在现场一样告诉你：

- 这条视频到底讲什么；
- 先拍什么、后拍什么；
- 每句台词怎么说；
- 手机放哪里；
- 每个画面拍几秒；
- 哪里用真实录屏；
- 哪里用 AI 视频过渡；
- AI 过渡的首尾画面如何连接；
- 哪句话让观众共鸣；
- 哪个矛盾适合评论区讨论；
- 拍坏后怎么补；
- 最后怎样剪起来。

## 与 v1 的主要区别

v1 更像专业前期策划工具。v2 默认进入“零基础手把手模式”，新增：

- 开头的“今天只做什么”行动地图；
- 每个镜头的说什么、拍什么、怎么拍、为什么；
- 手机位置、光线、收音、构图说明；
- 拍摄顺序与成片顺序分离；
- 每个镜头的难度和拍坏替代；
- AI 镜头的中文与英文 Prompt、首尾锚点、失败替代；
- 共鸣正反立场、置顶评论和下一期承接；
- 最省事版本；
- 小白可执行性强制评分。

## 安装

解压后，把整个 `samuel-video-coach` 文件夹放进你的 Agent 所识别的 Skills 目录。

不同 Agent 的目录和加载方式可能不同，以对应产品当前文档为准。即使 Agent 不支持 Skills，也可以把 `SKILL.md` 当作系统提示词或项目规则使用。

## 最简单调用

```text
使用 samuel-video-coach，开启零基础手把手模式。

视频主题：我让三个 AI Agent 互相审查一个开源项目。
平台：抖音。
目标时长：3 分钟。
我有的素材：Agent 运行录屏、GitHub 提交、测试报告、两个真实 Bug、最终产品页面。
我没有拍过视频，请逐句告诉我说什么，逐镜头告诉我拍什么、手机放哪里、哪里插 AI 视频、怎样转场、怎样引发评论讨论。
```

只给主题也可以：

```text
使用 samuel-video-coach。
我要拍“我用 AI 做了一个旅行照片故事 Agent”。
我完全是小白。先基于合理假设给我一个能今天开拍的版本，不能确认的事实标成待补证据。
```

## 目录

```text
samuel-video-coach/
├── SKILL.md
├── README.md
├── SOURCES.md
├── CHANGELOG.md
├── LICENSE
├── references/
│   ├── samuel-research-basis.md
│   ├── beginner-coach-mode.md
│   ├── title-cover-hook-system.md
│   ├── story-system.md
│   ├── shot-language.md
│   ├── ai-transition-system.md
│   ├── resonance-discussion-system.md
│   ├── edit-system.md
│   └── quality-rubric.md
├── assets/
│   ├── simple-intake.md
│   ├── beginner-output-template.md
│   ├── full-example.md
│   ├── quick-start-prompt.md
│   └── storyboard.schema.json
└── scripts/
    └── validate_storyboard.py
```

## 重要说明

这个 Skill 复刻的是高层创作思路：结果先行、人的问题、真实实验、动作化表达、具体证据、反转、个人判断和讨论张力。

它不会复制 Samuel 的原台词、完整分镜、封面或独特表达，也不代表 Samuel 官方授权。
