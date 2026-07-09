#!/usr/bin/env python3
"""
Walks the content/ directory looking for folders that contain a content.txt file.
Each such folder becomes a "document" node. Folders that contain other folders
become categories, nested to any depth. The result is written to data/index.json,
which the website reads at load time.

Run manually with: python3 scripts/build_index.py
The GitHub Action runs this automatically on every push.
"""

import os
import re
import json

ROOT = "content"
OUTPUT = "data/index.json"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def make_title(name):
    """Turn a folder name like 'old-harbor_district' into 'Old Harbor District'."""
    name = re.sub(r"[-_]+", " ", name)
    return name.strip().title()


def split_header(text, fallback_title):
    """Pulls the '# Title' line and an optional '> short description' line off the
    top of a content.txt. Returns (title, tagline, remaining_body). The title and
    tagline lines are removed from the body so they aren't shown twice."""
    lines = text.replace("\r\n", "\n").split("\n")
    i = 0
    title = None
    tagline = None

    while i < len(lines) and lines[i].strip() == "":
        i += 1

    if i < len(lines) and lines[i].strip().startswith("# "):
        title = lines[i].strip()[2:].strip()
        i += 1
        while i < len(lines) and lines[i].strip() == "":
            i += 1
        if i < len(lines) and lines[i].strip().startswith(">"):
            tagline = lines[i].strip().lstrip(">").strip()
            i += 1

    remaining = "\n".join(lines[i:]).lstrip("\n")
    return title or fallback_title, tagline, remaining


IMG_LINE_RE = re.compile(r"^!\[(.*?)\]\((.*?)\)$")


def resolve_image_path(src, rel_path):
    """Turns an image reference from inside content.txt into a site-root-relative
    path, the same way the front end resolves ![]() images in the body."""
    if re.match(r"^https?://", src, re.IGNORECASE) or src.startswith("/"):
        return src
    prefix = f"{ROOT}/{rel_path}" if rel_path else ROOT
    return f"{prefix}/{src}"


def extract_leading_image(body, rel_path):
    """If the first non-blank line of the body is a ![]() image, treat it as the
    header photo (so writing the image right under the title 'just works') and
    strip that line out of the body so it isn't shown twice. Only used when no
    literal cover.* file was found."""
    lines = body.split("\n")
    i = 0
    while i < len(lines) and lines[i].strip() == "":
        i += 1
    if i < len(lines):
        m = IMG_LINE_RE.match(lines[i].strip())
        if m:
            image = resolve_image_path(m.group(2), rel_path)
            remaining = "\n".join(lines[:i] + lines[i + 1:]).lstrip("\n")
            return image, remaining
    return None, body


def find_cover_image(dir_path, rel_path):
    """Looks for a file literally named 'cover.png' / 'cover.jpg' / etc in a
    document's folder and returns its site-root-relative path, or None."""
    try:
        entries = os.listdir(dir_path)
    except FileNotFoundError:
        return None
    for entry in entries:
        name, ext = os.path.splitext(entry)
        if name.lower() == "cover" and ext.lower() in IMAGE_EXTS:
            prefix = f"{ROOT}/{rel_path}" if rel_path else ROOT
            return f"{prefix}/{entry}"
    return None


def build_tree(dir_path, rel_path=""):
    name = os.path.basename(dir_path) if rel_path else "Home"
    node = {
        "name": name,
        "title": make_title(name) if rel_path else "Home",
        "path": rel_path,
        "hasContent": False,
        "content": None,
        "tagline": None,
        "image": None,
        "children": [],
    }

    content_file = os.path.join(dir_path, "content.txt")
    if os.path.isfile(content_file):
        with open(content_file, "r", encoding="utf-8") as f:
            raw = f.read()
        title, tagline, body = split_header(raw, node["title"])
        node["hasContent"] = True
        node["title"] = title
        node["tagline"] = tagline
        node["content"] = body
        node["image"] = find_cover_image(dir_path, rel_path)
        if not node["image"]:
            auto_image, body = extract_leading_image(body, rel_path)
            if auto_image:
                node["image"] = auto_image
                node["content"] = body

    try:
        entries = sorted(os.listdir(dir_path))
    except FileNotFoundError:
        entries = []

    for entry in entries:
        full = os.path.join(dir_path, entry)
        if os.path.isdir(full) and not entry.startswith("."):
            child_rel = f"{rel_path}/{entry}" if rel_path else entry
            child_node = build_tree(full, child_rel)
            # only keep folders that actually have something in them
            if child_node["hasContent"] or child_node["children"]:
                node["children"].append(child_node)

    return node


def main():
    if not os.path.isdir(ROOT):
        os.makedirs(ROOT, exist_ok=True)
        print(f"Created empty '{ROOT}/' directory — add folders with content.txt files.")

    tree = build_tree(ROOT)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(tree, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
