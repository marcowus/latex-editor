# Contributing to LaTeX Editor

Thank you for helping make technical-paper writing less fragile.

## Before opening a pull request

1. Search existing issues and pull requests.
2. For a bug, include a minimal reproducible LaTeX input and the expected versus observed behavior.
3. Remove API keys, unpublished manuscripts, personal data, and proprietary figures from every attachment.
4. Keep changes focused. Avoid combining a feature, a dependency upgrade, and a formatting sweep in one pull request.

## Local checks

~~~powershell
npm ci
npm run lint
npm run build
~~~

Please add or update a small test/example when behavior changes. If a change affects public documentation, update README.md or the relevant file under docs in the same pull request.

## LLM-provider changes

- Never add a real credential, endpoint with embedded credentials, or a recorded prompt containing private research material.
- Preserve the local-default network posture unless a deployment guide and authentication model are included.
- State clearly whether a feature is a deterministic local rule, a provider call, or an experimental prompt.

## Commit and review style

- Use a concise imperative subject, for example: Add project import validation.
- Explain user-visible behavior and verification evidence in the pull request.
- Do not claim a manuscript is publishable, a proof is correct, or a model output is factual without independently verifiable evidence.

## Community expectations

Be constructive, specific, and respectful. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
