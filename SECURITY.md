# Security Policy

## Supported version

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Security model and boundaries

LaTeX Editor is intended to run locally. Its LLM gateway can receive API keys and manuscript content, so treat the application as a developer tool rather than a multi-user hosted service.

- The default listener is 127.0.0.1.
- Setting LATEX_EDITOR_HOST=0.0.0.0 deliberately expands network exposure. Do so only behind suitable authentication and network controls.
- API keys from the configuration UI are kept in the running server's memory and are not returned by the configuration response.
- A .env file is ignored by Git. Do not put secrets in source files, examples, screenshots, GitHub Issues, release notes, or Actions logs.
- External LLM providers may process the text sent to them. Review the provider's data policy before sending an unpublished manuscript.

## Reporting a vulnerability

Do not open a public issue containing a key, exploit payload, or private paper. Prefer GitHub private vulnerability reporting for this repository. If that facility is unavailable, open a minimal public issue that describes the affected version and impact without sensitive data, and request a private reporting channel.

Maintainers will acknowledge a good-faith report, assess reproducibility, and coordinate a fix before publishing details.
