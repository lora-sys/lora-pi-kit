#!/usr/bin/env python3
"""Check a resume PDF for page count, searchable headings, and public URL reachability."""

import argparse
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


def command_output(command):
    return subprocess.run(command, check=True, text=True, capture_output=True).stdout


def fetch_status(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 ResumeVerifier/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.getcode()
    except urllib.error.HTTPError as error:
        return error.code
    except Exception as error:
        return f"ERROR: {error}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", help="PDF to validate")
    parser.add_argument("--max-pages", type=int, default=1)
    parser.add_argument("--require", action="append", default=[], help="required extracted-text heading or phrase")
    parser.add_argument("--url", action="append", default=[], help="public URL to test, repeat for each URL")
    args = parser.parse_args()

    pdf = Path(args.pdf)
    if not pdf.is_file():
        print(f"FAIL: PDF 不存在：{pdf}")
        sys.exit(2)
    try:
        info = command_output(["pdfinfo", str(pdf)])
        text = command_output(["pdftotext", "-layout", str(pdf), "-"])
    except (FileNotFoundError, subprocess.CalledProcessError) as error:
        print(f"FAIL: 缺少 PDF 检查命令或无法提取文本：{error}")
        sys.exit(2)

    pages = next((int(line.split(":", 1)[1].strip()) for line in info.splitlines() if line.startswith("Pages:")), None)
    failures = []
    if pages is None:
        failures.append("无法从 pdfinfo 读取页数")
    elif pages > args.max_pages:
        failures.append(f"页数为 {pages}，超过 {args.max_pages} 页限制")
    print(f"页数：{pages}")

    for phrase in args.require:
        if phrase not in text:
            failures.append(f"ATS 文本缺少：{phrase}")
        else:
            print(f"文本存在：{phrase}")

    if len(text.strip()) < 300:
        failures.append("可提取文本过少，请检查是否把正文做成图片或扫描件")
    else:
        print(f"可提取文本：{len(text.strip())} 个字符")

    for url in args.url:
        status = fetch_status(url)
        print(f"链接：{status} {url}")
        if not isinstance(status, int) or not 200 <= status < 400:
            failures.append(f"链接不可达：{status} {url}")

    if failures:
        print("\nFAIL")
        for failure in failures:
            print("- " + failure)
        sys.exit(1)
    print("\nPASS: 页数、可提取文本、必填字段和指定链接检查通过。")


if __name__ == "__main__":
    main()
