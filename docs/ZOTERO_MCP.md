# Zotero MCP bridge

## Scope

The optional Zotero bridge connects this application to a Zotero MCP service and Better BibTeX endpoint that the user runs locally. It can:

- test whether the local services are reachable;
- search the local library through the MCP tool interface;
- copy or insert a citation key at the current cursor;
- generate a reviewable BibTeX entry and append it to a managed project.

It does not upload a library to this repository or provide a hosted Zotero service.

## Local configuration

The default endpoints are loopback-only:

~~~text
ZOTERO_MCP_URL=http://127.0.0.1:23120/mcp
ZOTERO_BBT_URL=http://127.0.0.1:23119
~~~

Set them in a local .env file if your own local services use different ports. Never place credentials inside these URLs; endpoint credentials could be exposed through logs or configuration mistakes.

## Writing boundary

When BibTeX is appended, the frontend passes the current workspace path. The server accepts only a .bib filename in the managed E:\latex_workspace tree and rejects paths outside it. Review the resulting entry and its metadata before citing it in a paper.

## Privacy

Zotero item metadata and the search query are private to the user’s local services. Do not expose the LaTeX Editor server to an untrusted network when this bridge is enabled.
