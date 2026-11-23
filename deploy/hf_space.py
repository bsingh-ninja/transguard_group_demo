"""Deploy this demo to a Hugging Face Docker Space.

Usage:
    HF_TOKEN=hf_... python deploy/hf_space.py <owner>/<space-name> [--private]

Optional environment variables, stored on the Space as secrets (never in the code):
    GEMINI_API_KEY   Gemini key for the AI features
    DEMO_PASSWORD    password for the demo (user name: demo); leave unset for no password

Uploads the code the container needs (not the client README, docs, videos or CI files) with
a short Space README, then Hugging Face builds the Dockerfile and serves the app on :7860.
"""

import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

from huggingface_hub import HfApi

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP = ("brag-output/", "docs/", ".github/", "README.md")
SPACE_README = """---
title: Transguard Workforce Intelligence
emoji: 🛡️
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
short_description: Concept demo by NinjaTech, simulated data
---

Concept demo prepared by NinjaTech. All figures, names and records are simulated.
"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1 or "/" not in args[0]:
        sys.exit(__doc__)
    space, private = args[0], "--private" in sys.argv
    api = HfApi(token=os.environ["HF_TOKEN"])
    api.create_repo(space, repo_type="space", space_sdk="docker", private=private, exist_ok=True)
    for key in ("GEMINI_API_KEY", "DEMO_PASSWORD"):
        if os.environ.get(key):
            api.add_space_secret(space, key, os.environ[key])

    files = subprocess.check_output(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT, text=True).splitlines()
    with tempfile.TemporaryDirectory() as tmp:
        for f in files:
            if f.startswith(SKIP) or not (ROOT / f).is_file():
                continue
            dest = pathlib.Path(tmp, f)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / f, dest)
        pathlib.Path(tmp, "README.md").write_text(SPACE_README)
        api.upload_folder(folder_path=tmp, repo_id=space, repo_type="space", commit_message="Deploy from GitHub", delete_patterns=["*"])
    owner, name = space.split("/")
    print(f"Space:   https://huggingface.co/spaces/{space}")
    print(f"App URL: https://{owner}-{name}.hf.space".lower().replace("_", "-"))


if __name__ == "__main__":
    main()
