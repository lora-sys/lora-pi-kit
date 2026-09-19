# 装新 skill

## 5 步流程

```bash
# 1. 放到 canonical store
cp -r /path/to/skill-name /data/lora/ai/skills/

# 2. 补 meta.json（如果没有）
cat > /data/lora/ai/skills/skill-name/meta.json <<'EOF'
{
  "id": "skill-name",
  "entry": "SKILL.md"
}
EOF

# 3. pi 兼容：建 skills/ 空目录
mkdir -p /data/lora/ai/skills/skill-name/skills

# 4. 注册到 pi（可选；pi 也会自动发现 ~/.pi/agent/skills/ 下的 symlink）
pi install /data/lora/ai/skills/skill-name

# 5. 验证
python3 ~/.agents/skills/.system/skill-creator/scripts/quick_validate.py /data/lora/ai/skills/skill-name
pi -p "echo hello"   # 确认 pi 加载没坏
```

或者直接：

```bash
bash /data/lora/ai/skills/lora-tooling/scripts/install-skill.sh /path/to/skill-name
bash /data/lora/ai/skills/lora-tooling/scripts/install-skill.sh /path/to/skill-name --dry-run
```

## 一次性配置：建立 symlink 关系

如果某 CLI 的 skills 目录还没 symlink 到 canonical store：

```bash
mkdir -p /home/lora/.gemini
ln -s /data/lora/ai/skills /home/lora/.gemini/skills
```

新加的 CLI 同样处理。

## 卸载

```bash
# 从 canonical store 删（影响所有 CLI）
rm -rf /data/lora/ai/skills/skill-name

# 如果之前 `pi install` 注册过
pi remove skill-name
```

## 跨机器同步

不在本 skill 范围。如果需要用 rsync / git 同步，单独处理；本 skill 只管单机 canonical store。
