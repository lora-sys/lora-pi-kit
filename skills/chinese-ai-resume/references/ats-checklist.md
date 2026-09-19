# 单页 ATS 与链接核验清单

## 内容和结构

| 检查项 | 通过标准 |
|---|---|
| 求职目标 | 标题直接写目标岗位，例如“AI Agent / LLM 应用开发实习生”。 |
| 联系方式 | 第一行放电话、邮箱、到岗信息。第二行放作品集和 GitHub。 |
| 主项目 | 最多 3 个。每项有公开链接、项目介绍、编号主要工作和事实边界。 |
| 技能 | 分为开发技术、AI 应用开发等类别。每个关键词都能在项目或经历中解释。 |
| 其他作品 | 先放个人博客。后续每行写项目名、具体作用和链接。 |
| 个人优势 | 用持续作品、协作方式、比赛或真实经历等证据写，不写空泛性格词。 |

## 文档和视觉

保持 A4 单页。正文不要用整页截图、复杂文本框或只有图标没有文字的联系方式。使用常见中文字体和可复制文本。链接使用可读锚文本并保留超链接，不要把一长串 URL 铺满页面。

## 必做命令

```bash
python scripts/build_tech_resume.py --input resume.json --docx output/resume.docx --pdf output/resume.pdf

python scripts/verify_resume.py output/resume.pdf \
  --max-pages 1 \
  --require "教育经历" \
  --require "专业技能" \
  --require "项目经历" \
  --require "其他作品" \
  --url "https://github.com/example" \
  --url "https://example.com"
```

`verify_resume.py` 检查页数、可提取文本、指定字段和指定 URL。它不替代视觉检查。最后还要把 PDF 渲染成图片，人工确认页面没有挤出第二页、字号仍可读、链接样式清晰。
