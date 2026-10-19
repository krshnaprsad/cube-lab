# Cube Lab

Match a look, paint with a palette, blend LUTs, fix broken ones. One .cube file for Premiere Pro and DaVinci Resolve.

Made by Zero3.

## Why I built Cube Lab

The idea for Cube Lab came from my friend Rishi. He suggested that building something like this would be good, and I made Cube Lab from his suggestion.

I watch a lot of reels, and every creator does something I want to try in my own way. One day I wanted my video in the colour theme of Blade Runner. The LUT for a look like that is hard to find. It is usually paid, and matching it by hand in DaVinci Resolve or Premiere Pro takes forever.

Then I learned that a LUT can be built from images, so I built it and put it on GitHub. Now I take a screenshot of the film whose look I want, add a frame from my own work, and Cube Lab matches the colour. I download the .cube file and use it in any project.

It is free, and I will keep adding to it.

## What it does

I edit in both Premiere Pro and DaVinci Resolve, and both read the same .cube LUT file. So instead of building two plugins, I built one tool that makes the file. It runs in your browser, nothing is uploaded, and there is no account.

It has four parts.

**Look Match.** Choose a frame from your footage and a reference still with the look you want. Cube Lab builds a LUT that moves your frame toward that look. Three sliders: Strength (how far to go), Match brightness (the light and dark balance) and Match colour (tint and richness). A switch keeps your blacks and whites clean so the match does not tint them.

**Palette.** Pick colours and Cube Lab paints your footage with them. Start from one of the twelve gradients from my Gradient Lab, pull a palette out of your own frame, paste hex codes, or pick colours by hand. In Gradient Lab, the Export to Cube Lab button opens this tab with your gradient's colours already loaded. Two styles: Gradient map swaps each brightness for a colour from your gradient (shadows get the first colour, highlights the last), and Colour wash keeps your picture's own light and dark and only takes the tint. Strength sets how far you go, and blacks and whites stay clean unless you switch that off.

**Blender.** Add two or more LUTs, set how strong each one is, put them in order, and bake them into one new file. Handy for a log fix followed by a creative look at 60%. You can also drop in your current Look Match as one of the layers.

**Doctor.** Open any .cube file. It tells you in plain words what is wrong: cut-short files, broken numbers, values outside the 0 to 1 range, clipped highlights or shadows, a grey ramp that runs backwards, an odd size, a LUT that does nothing. Then it saves a repaired copy: a normal 3D LUT, clamped to 0 to 1, at the size you pick. It also turns a 1D LUT into a 3D one.

Drag the line on the picture to compare before and after. Save at size 17, 33 or 65. 33 is the usual one.

## Use it

Open the app: https://krshnaprsad.github.io/cube-lab/

Or download the repo and open `index.html`. Nothing to install.

In Premiere Pro: Lumetri Color, Creative, Look menu, Browse, pick the file. In DaVinci Resolve: the downloaded file does nothing until you copy it INTO Resolve's LUT folder. Open Project Settings, Color Management, Lookup Tables, click Open LUT Folder, and paste the .cube file into that folder (or on the Color page, right-click in the LUTs panel and choose Reveal in File Explorer, then paste it there). Then right-click the LUTs panel and choose Refresh, or restart Resolve. Pick it from the LUTs panel or a node's 3D LUT menu.

## Things to know

- **Use a frame as it looks in your editor.** The match works on what you see in the viewer, not on raw log footage. Log footage: convert it first, then match, or put the LUT after your conversion.
- **A match is an estimate, not magic.** It copies the overall brightness and colour balance of the reference. It does not know about skin tones or objects, so check faces. Lower the Strength if it goes too far.
- **Blacks and whites stay clean by default.** Switch that off if you want the reference's tinted blacks.
- **Doctor repairs, it does not rescue.** If a file is cut short, the missing rows are filled with black. The warning says so. Get the original again if you can.
- **It cannot install the file for you.** A web page is not allowed to write into your program folders, so you drop the file in yourself.
- The Strength slider here is baked into the file. Premiere's Intensity slider and Resolve's key output gain still work on top of it.

## How I checked it

`npm test` (Node 18 or newer, nothing to install) runs 42 checks: the file reader and writer, the order of the colour rows (red changes fastest, which is what the format needs), CRLF and byte order marks, 1D files, resizing, blending, Look Match moving a picture toward its reference, and every Doctor warning.

On every download, the page reads the file text back and compares the picture it gives with the preview. They matched to within 1 of 255 in my runs, so the preview is the file.

I also ran three of the saved files through ffmpeg's `lut3d` filter, an independent reader that has nothing to do with my code. Its pictures matched mine to within 1 of 255. That tells me the row order and header are right for a third-party reader.

I tested the live page in desktop Chrome with real photos: matching, blending two LUTs, and repairing a damaged file, plus the 390 px phone layout.

I have loaded these files in Premiere Pro and DaVinci Resolve Studio 20 on Windows, and they work in both. I have not tested Safari or Firefox. If an app rejects a file, open an issue with the app and version.

## Files

- `index.html`, `app.css`, `app.js` the app
- `cube.js` the logic (file reader and writer, sampling, blending, Look Match, Doctor) with no browser code, so Node can test it
- `cube.test.js` the tests

Developer notes are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

I made this and it is free to use, including for paid work. What it is not free to do is be copied: please don't republish, redistribute or sell the code, or build your own version from it. The full terms are in [LICENSE](LICENSE). Versions published before 19 October 2026 were MIT and stay that way. The Zero3 name and logo are not part of the licence.
