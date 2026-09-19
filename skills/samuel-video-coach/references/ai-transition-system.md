# AI Transition System

## 1. 核心规则

AI 镜头是语义标点，不是证据。

先问：

1. 这句话是事实吗？是事实就先用真实录屏或实拍。
2. 普通 B-roll 能表达吗？能就优先 B-roll。
3. AI 画面是否能连接前后两个真实镜头？不能就重新设计。
4. 观众会不会误认为这是真实结果？会就标注或不用。

## 2. 六种用途

### 隐喻

“速度超过了控制” → 机器人高速打字，安全刹车逐渐脱手。

### 动作传送

手指点击按钮 → 概念机器启动 → 真实日志开始滚动。

### 时间压缩

咖啡杯影子快速转动、窗外昼夜变化 → 第二天的产品结果。

### 情绪标点

权限报错 → 玻璃服务器房瞬间结冰 → 切回创作者表情。

### 章节入口

任务卡片折叠成隧道 → 出现真实测试面板。

### 未来预告

三个机器人围绕同一段代码审查，明确标注“下一期概念画面”。

## 3. 默认密度

3–5 分钟视频：2–6 个 AI 镜头，每个 1.2–3 秒。

- 开头、反转、章节切换、结尾预告可稍多；
- 教程操作和结果证明部分应少；
- 连续两个 AI 镜头通常应避免。

## 4. 锚点设计

每个 AI 镜头必须有：

- `前锚点`：前一个真实镜头中的颜色、形状、动作、方向或声音；
- `后锚点`：下一个真实镜头中可以匹配的元素。

例：

- 前：终端红色错误像素；
- AI：红色像素扩成警报灯；
- 后：房间里真实红色录制灯。

## 5. Prompt 模板

### 中文

```text
9:16 竖屏电影感短镜头。主体：[主体]；动作：[可观察动作]；场景：[场景]。
画面只表达一个隐喻：[隐喻]。镜头运动：[运动]；景别：[景别]；光线：[光线]；
动作节奏：[节奏]。首帧以[前锚点]充满或占据画面，尾帧停在[后锚点]，方便匹配剪辑。
时长 [1.2–3.0] 秒。运动符合物理规律。无文字、无字幕、无 Logo、无水印。
```

### English

```text
9:16 vertical cinematic transition shot. [Subject] [observable action] in [environment].
The shot represents one visual metaphor: [metaphor]. Camera [movement], [framing/lens].
Lighting [lighting], motion rhythm [rhythm]. Start with [start anchor] filling the frame.
End on [end anchor] centered and stable for a match cut. Duration [1.2–3.0 seconds].
Physically coherent motion, no text, no subtitles, no logos, no watermark.
```

### 负面提示词

```text
readable text, subtitles, logos, watermark, brand marks, deformed hands,
extra fingers, duplicated objects, inconsistent subject, random scene change,
flicker, unstable camera, broken physics, cyberpunk decoration unrelated to story
```

## 6. 剪辑说明

每个 AI 镜头明确：

- 从哪个画面切入；
- 是否在点击或音效落点上切；
- 尾帧停留多少帧；
- 下个真实镜头如何匹配；
- 是否需要叠字“概念画面”；
- 生成失败用什么真实镜头替代。

## 7. 禁止

- 用 AI 生成假的活动现场；
- 用 AI 生成假的用户评价；
- 用 AI 生成假的交易或收入；
- 用 AI 画面冒充产品真实功能；
- 无意义的宇宙、机器人和霓虹城市拼贴；
- 生成可读界面文字，关键字应后期添加。
