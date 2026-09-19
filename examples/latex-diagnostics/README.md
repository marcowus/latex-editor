# LaTeX diagnostics and repair

## Input

imperfect-input.tex contains two intentional problems:

1. a citation key that does not exist in references.bib;
2. a mathematical expression whose delimiter pairing should be reviewed.

## Expected output

expected-repair.tex resolves both issues without changing the scope of the surrounding prose. repair-notes.md records the evidence for each correction.

## Suggested use

Open the input and expected output side by side. Use preview/source navigation and the diagnostics tool to understand why each repair is required rather than blindly accepting generated text.

## 60-second walkthrough

![LaTeX diagnostics walkthrough](demo.gif)

The corresponding narration and timing are in [DEMO.md](DEMO.md).
