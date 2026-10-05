# Madame Lumina's Fortune Machine

An interactive 3D carnival fortune-teller for the **Purple Light Lounge** Mystic Carnival.
Drag a quarter into the coin slot and Madame Lumina wakes up, the marquee lights chase, her crystal ball glows, and a fortune card slides out of the chute.

![Madame Lumina](assets/seer.jpg)

## Features

- 3D arcade cabinet you can drag to turn (or tap **Turn the machine**)
- Drag-and-drop quarter, or tap it / press Enter to drop it in
- Animated seer: glowing eyes, pulsing crystal ball, chasing marquee bulbs
- Synthesized carnival sounds (no audio files needed)
- 24 fortune cards with a lucky color and lucky number
- Works on phones and desktops, keyboard accessible, respects reduced-motion settings
- No build step and no dependencies: just HTML, CSS and JavaScript

## Project structure

```
madame-lumina/
├── index.html          Page markup
├── css/style.css       All styles (colors and fonts are set at the top in :root)
├── js/fortunes.js      Fortune card text and lucky colors (edit these freely)
├── js/app.js           Machine behavior: rotation, coin, lights, sound, cards
└── assets/
    ├── seer.jpg        Madame Lumina portrait
    ├── wood.jpg        Plum wood texture for the cabinet
    └── favicon.svg     Browser tab icon
```

## Run it locally

Open `index.html` in a browser. Or, to match how GitHub Pages serves it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Publish on GitHub Pages

1. Create a new repository on GitHub (for example `madame-lumina`).
2. Upload everything in this folder to the repository (drag the files into **Add file → Upload files**, keeping the `css`, `js` and `assets` folders).
3. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, pick `main` and `/ (root)`, then **Save**.
4. After a minute or two the machine is live at `https://<your-username>.github.io/madame-lumina/`.

## Customize

- **Fortunes:** edit `js/fortunes.js`. Each card is `{ title, message }`. Add or remove as many as you like.
- **Lucky colors:** edit the `LUCKY_COLORS` list in the same file.
- **Machine messages** (the lit sign text): edit `MESSAGES` near the top of `js/app.js`.
- **Colors and fonts:** edit the variables at the top of `css/style.css`.
- **Community link:** the footer link in `index.html` points to the Purple Light Lounge on Skool.

## Credits

Created by Skyler for [Soul Journey Sky](https://souljourneysky.com) and the Purple Light Lounge.
Fortunes are playful reflections, not predictions. Take what resonates.

© Soul Journey Sky. All rights reserved.
