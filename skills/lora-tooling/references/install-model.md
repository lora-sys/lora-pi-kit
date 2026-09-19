# 装模型

所有模型统一存到数据盘 `/data/lora/ai/models/`。`/data/lora/` 是只读 Btrfs 快照，要写到模型目录需 remount rw 或通过 overlay——具体方法见各小节。

## Ollama

```bash
export OLLAMA_MODELS=/data/lora/ai/models/ollama
ollama pull <model>          # 例如 qwen2.5:7b
ollama list
```

把 `OLLAMA_MODELS` 加到 `~/.bashrc` / `~/.config/fish/config.fish` 持久化。

## LM Studio

LM Studio 走 GUI 配置：

1. 打开 LM Studio → Settings → My Models
2. 把模型根目录改成 `/data/lora/ai/models/lmstudio/`
3. 之后下载/导入都走这个目录

## HuggingFace

```bash
export HF_HOME=/data/lora/ai/models/huggingface
huggingface-cli download <repo>/<model>
```

`HF_HOME` 控制所有 HF 工具（transformers、diffusers、datasets）的下载路径。

## 模型缓存

```bash
# 跨工具共享的下载缓存（pip / uv / ollama / hf 等）
ls /data/lora/ai/models/cache/
```

## 不在范围

- 训练 / 微调模型
- 私有模型仓库认证（hf token 等）
- 跨机器模型同步
