# Privacy and security notes

## What stays in the repository

The public repository contains code, documentation, sample configurations, product screenshots, and synthetic examples. It must not contain:

- API keys, access tokens, passwords, private keys, or credential-bearing URLs;
- unpublished manuscripts, reviewer correspondence, student records, or personal data;
- production logs that could contain request bodies or provider responses.

The supplied .gitignore protects .env-style files. This is a safeguard, not a substitute for reviewing staged files before a commit.

## Runtime configuration

The server loads local environment variables through dotenv. A key entered through the in-app provider settings is stored only in the running server process and is intentionally omitted from the configuration response.

The default listener is 127.0.0.1. Set LATEX_EDITOR_HOST=0.0.0.0 only when you intentionally need trusted-LAN access and have added authentication, a firewall rule, and appropriate operational controls.

## External providers

When an LLM feature is used, the relevant prompt and selected editor/workspace context can be sent to the configured provider. Do not treat the software as a data-loss-prevention boundary. Review the provider's contract and data policy before using non-public research material.

## Before publishing a repository or release

1. Scan the full Git history and GitHub Actions logs for credentials.
2. Review screenshots, ZIPs, sample inputs, and release attachments for private data.
3. Verify .env is ignored and not tracked.
4. Keep a clean production/demo environment separate from research workspaces.
