# Cube Lab

Match a look, blend LUTs, fix broken ones. One .cube file for Premiere Pro and DaVinci Resolve.

Made by Zero3.

## What it does

I edit in both Premiere Pro and DaVinci Resolve, and both read the same .cube LUT file. So instead of building two plugins, I built one tool that makes the file. It runs in your browser, nothing is uploaded, and there is no account.

It has three parts.

**Look Match.** Choose a frame from your footage and a reference still with the look you want. Cube Lab builds a LUT that moves your frame toward that look. Three sliders: Strength (how far to go), Match brightness (the light and dark balance) and Match colour (tint and richness). A switch keeps your blacks and whites clean so the match does not tint them.

**Blender.** Add two or more LUTs, set how strong each one is, put them in order, and bake them into one new file. Handy for a log fix followed by a creative look at 60%. You can also drop in your current Look Match as one of the layers.

**Doctor.** Open any .cube file. It tells you in plain words what is wrong: cut-short files, broken numbers, values outside the 0 to 1 range, clipped highlights or shadows, a grey ramp that runs backwards, an odd size, a LUT that does nothing. Then it saves a repaired copy: a normal 3D LUT, clamped to 0 to 1, at the size you pick. It also turns a 1D LUT into a 3D one.

Drag the line on the picture to compare before and after. Save at size 17, 33 or 65. 33 is the usual one.

## Use it

Open the app: https://krshnaprsad.github.io/cube-lab/

Or download the repo and open `index.html`. Nothing to install.

In Premiere Pro: Lumetri Color, Creative, Look menu, Browse, pick the file. In DaVinci Resolve: Project Settings, Color Management, Open LUT Folder, drop the file in, Update Lists, then pick it from a node's LUT menu.

## Things to know

- **Use a frame as it looks in your editor.** The match works on what you see in the viewer, not on raw log footage. Log footage: convert it first, then match, or put the LUT after your conversion.
- **A match is an estimate, not magic.** It copies the overall brightness and colour balance of the reference. It does not know about skin tones or objects, so check faces. Lower the Strength if it goes too far.
- **Blacks and whites stay clean by default.** Switch that off if you want the reference's tinted blacks.
- **Doctor repairs, it does not rescue.** If a file is cut short, the missing rows are filled with black. The warning says so. Get the original again if you can.
- **It cannot install the file for you.** A web page is not allowed to write into your program folders, so you drop the file in yourself.
- The Strength slider here is baked into the file. Premiere's Intensity slider and Resolve's key output gain still work on top of it.

## How I checked it

`npm test` (Node 18 or newer, nothing to install) runs 34 checks: the file reader and writer, the order of the colour rows (red changes fastest, which is what the format needs), CRLF and byte order marks, 1D files, resizing, blending, Look Match moving a picture toward its reference, and every Doctor warning.

On every download, the page reads the file text back and compares the picture it gives with the preview. They matched to within 1 of 255 in my runs, so the preview is the file.

I also ran three of the saved files through ffmpeg's `lut3d` filter, an independent reader that has nothing to do with my code. Its pictures matched mine to within 1 of 255. That tells me the row order and header are right for a third-party reader.

I tested the live page in desktop Chrome with real photos: matching, blending two LUTs, and repairing a damaged file, plus the 390 px phone layout.

I have **not** loaded these files into Premiere Pro or DaVinci Resolve myself, and I have not tested Safari or Firefox. The files follow the standard .cube format (header with LUT_3D_SIZE, red-fastest row order, 0 to 1 range) that both apps read, but I will not claim more than I checked. If one of them rejects a file, open an issue with the app and version.

## Files

- `index.html`, `app.css`, `app.js` the app
- `cube.js` the logic (file reader and writer, sampling, blending, Look Match, Doctor) with no browser code, so Node can test it
- `cube.test.js` the tests

Developer notes are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT for the code. The Zero3 name and logo are not part of the licence. See [LICENSE](LICENSE).
