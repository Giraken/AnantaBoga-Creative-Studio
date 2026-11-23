# Anantaboga Creative Studio

Website for Anantaboga Creative Studio, a video and photo studio in Mojorejo, Kota Batu, East Java.

Plain HTML, CSS and JavaScript. No build step: open `index.html` or serve the folder.

## Colours

Taken from the logo: orange `#F7991F`, greys `#7A7A7A` and `#A0A0A0`, black `#000000`, white `#FFFFFF`.
They live as tokens at the top of `css/style.css`.

## Films

The films stay on Google Drive (they are 0.3–2 GB each, too large for GitHub) and play in a Drive
player on the page. Each film is one `<li class="film">` in the "Our films" list:

- `data-drive`: the Drive file id (the part after `/file/d/` in the share link)
- `data-still`: a 1280×720 WebP in `image/work/`; leave it empty to show a title card instead
- `data-type`: `event`, `brand`, `doc` or `school` (drives the filter buttons; update their counts)

The Drive files must stay shared as "Anyone with the link can view", or the player shows a sign-in screen.

## Photos

`image/photo/` holds the photography strip, as WebP (about 1200px on the long side).

## 3D hero

The hero is a Three.js scene (loaded from jsDelivr, `three@0.160.0`, via the import map in `index.html`):

- `js/hero/hero.js`: entry. Shows a still of the dragon (`image/hero-fallback.webp`), then lazy-loads the scene once the page has loaded.
  To refresh that still after changing the dragon, open the page at 1440×900 with `?capture` and reduced motion on, and crop the `.dragon-anchor` square (720×720 from x 360, y 63).
- `js/hero/scene.js`: renderer, camera, the double orange ring, lights, selective bloom, intro timeline, pointer parallax.
- `js/hero/dragon.js`: the dragon: body rebuilt along its coil every frame, dorsal plates, head with beard and mane, and two front legs solved with two-bone IK (one raised, one gripping the ring).
- `js/hero/dragon-classic.js`: the previous dragon (body coiled around the ring). Kept but not shown; open the page with `?dragon=classic` to see it.
- `js/hero/particles.js`: the orange swirl clouds.
- `js/hero/poster.js`: paints the grid lines, circles and the FORGED IN / LEGEND headline from the HTML into planes inside the 3D scene, so the dragon can sit in front of some letters and behind others. CSS still decides where everything goes; change the layout in `css/hero.css` and the scene follows.
- `js/hero/overlay.js`: text entrance and the swap from the logo to the live scene.
- `css/hero.css`: hero layout and the "Let's work together" band.

Phones and touch devices get a lighter body mesh, fewer clouds and half-resolution bloom.
With reduced motion the dragon is drawn once in its final pose, with no clouds. Without WebGL the logo stays.
