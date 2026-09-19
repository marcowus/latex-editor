# v0.1.0 release checklist

## Repository readiness

- [x] README explains purpose, features, setup, security boundaries, examples, and roadmap.
- [x] Public product screenshots and a 30-second feature-tour GIF are committed.
- [x] Apache-2.0 license, citation metadata, contribution guide, security policy, and issue forms are present.
- [x] Source defaults to loopback-only listening.
- [ ] Run the full history and tracked-file secret audit immediately before changing visibility.
- [ ] Confirm the GitHub Actions page has no logs, artifacts, or failed workflows containing sensitive information.

## GitHub publishing sequence

1. Push the release-preparation commit to main.
2. Set the repository About description, homepage, and topics.
3. Upload public/latex-editor-social-preview.jpg as the GitHub social preview.
4. Change repository visibility to Public only after the audit passes.
5. Create a v0.1.0 release from the public main commit and attach only reviewed assets.
6. Use the launch copy in LAUNCH_KIT.md to recruit the first ten research users.

## Release acceptance

- [ ] A fresh clone can run npm ci, npm run lint, and npm run build.
- [ ] README images and relative links render on GitHub.
- [ ] GitHub shows the Apache-2.0 license and Cite this repository card.
- [ ] The public repository page shows the intended About metadata, topics, and social image.
