# Contributing

No dependencies to install. You need Node 18 or newer.

```
npm test
```

That runs `cube.test.js`: the .cube reader and writer (including the red-changes-fastest order), sampling, resizing, blending, Look Match, and the Doctor checks.

Layout:

- `cube.js` has no browser code, so Node can test it. Everything that touches colour or file format lives here.
- `app.js` is the page: pictures, tabs, the before and after view, and the download button.

The preview and the download use the same LUT object and the same sampling code. On every download the page also reads the file text back and compares the result with the preview. Keep it that way: if you change how a LUT is made, do not add a second path for the preview.

Ideas that fit: more Doctor checks, undo, a 1D export. Ideas that do not fit: accounts, uploads, watermarks, paid sizes.
