# Anantaboga Creative Studio

Website for Anantaboga Creative Studio, a video and photo studio in Mojorejo, Kota Batu, East Java.

Plain HTML, CSS and JavaScript. No build step: open `index.html` or serve the folder.

## Brand

Set to the brand guideline (Brand Statement, Su-yeng):

- Colours: Orange Peel `#FF9800`, Black Wash `#0C0C0C`, Floral White `#FBF6EE`. Tokens at the top of
  `css/site.css`; sections switch palette with `.on-cream` and `.on-orange`. The hero keeps the dragon's
  greys `#7A7A7A` and `#A0A0A0`.
- Type: Plus Jakarta Sans (Light to Extra Bold) from Google Fonts. Headlines are Extra Bold and tightly
  set; small headings use the brand's "Label:" form.
- Logo: the eye, traced to vector from the guideline. `image/eye.svg` (colour), `image/eye-line.svg`
  (linework only), `image/eye-pattern.svg` (the repeat pattern), `image/favicon.svg`. In the page it is an
  inline `<symbol id="eye">`; tint each use with `--iris` and `--ink-eye`.
- Voice: the CUK*-ture Supremacy board (Cerdas, Unik, Kreatif), #ABCS, "Halo CS!" and
  "Ojo sungkan-sungkan" come from the brand statement.

## Films

The films stay on Google Drive (they are 0.3–2 GB each, too large for GitHub) and play in a Drive
player on the page. Each film is one `<li class="film">` in the "Our films" list:

- `data-drive`: the Drive file id (the part after `/file/d/` in the share link)
- `data-still`: a 1280×720 WebP in `image/work/`; leave it empty to show a title card instead
- `data-type`: `event`, `brand`, `doc` or `school` (drives the filter buttons; update their counts)

The Drive files must stay shared as "Anyone with the link can view", or the player shows a sign-in screen.

## Photos

`image/photo/` holds the photography strip, as WebP (about 1200px on the long side).

## 3D dragon hero (not on the page at the moment)

Since the redesign the page opens with the photo fly-through instead (see below). The dragon hero and
all its files are kept: `old/2026-11-27-before-redesign/index.html` is the last version that shows it.
It is a Three.js scene (loaded from jsDelivr, `three@0.160.0`, through an import map):

- `js/hero/hero.js`: entry. Shows a still of the dragon (`image/hero-fallback.webp`), then lazy-loads the scene once the page has loaded.
  To refresh that still after changing the dragon, open the page at 1440×900 with `?capture` and reduced motion on, and crop the `.dragon-anchor` square (720×720 from x 360, y 63).
- `js/hero/scene.js`: renderer, camera, the double orange ring, lights, selective bloom, intro timeline, scroll exit, pointer parallax.
- `js/hero/spine.js`: the path the dragon's body slides along, like a snake: up from below the frame, into the coil around the ring (the rest pose, `REST`), then out of the head into a loop and off to the left. Every part of the body passes where the head has been, so the intro and the scroll exit never cut through the ring. It also holds the collision solver, which keeps the body clear of the ring and of its own coils every frame (and the head, which is wider than the body). The `REST` keys leave about 0.1 of room at every crossing; if you move them, keep the crossings apart or the solver will bend the body to make room.
- `js/hero/dragon.js`: the dragon: body skin rebuilt along the spine every frame, dorsal plates (they fold down where they would reach into another coil), the head seated on the end of the neck (it turns with the neck, toward the cursor), and two front legs solved with two-bone IK, one each side at the top of the arch, both reaching toward the viewer with five forward-pointing fingers.
- `js/hero/dragon-classic.js`: an older dragon (body coiled around the ring). Kept but not shown; open the page with `?dragon=classic` to see it.
- `js/hero/particles.js`: the orange swirl clouds.
- `js/hero/poster.js`: paints the grid lines, circles and the Endless / Possibilities headline from the HTML into planes inside the 3D scene, so the dragon can sit in front of some letters and behind others. Each headline row (`.ph-row`, with its orange block) is its own plane, so the rows can slide apart. CSS still decides where everything goes; change the layout in `css/hero.css` and the scene follows.
- The output pass in `scene.js` tone-maps the dragon, ring and glow, but not the poster planes (they write alpha 0), so the headline, blocks and background keep the exact brand colours.
- `js/hero/overlay.js`: text entrance, the swap from the logo to the live scene, and the scroll progress through the hero (`--exit`, `--words`).
- `css/hero.css`: hero layout, the scroll pin and the "Let's work together" band.

On load the ring draws in, then the dragon rises from below the headline, circles the ring and settles into its pose (about 3.7 s).
On scroll the dragon loops away to the left while ENDLESS slides off to the left and POSSIBILITIES off to the right; scrolling back brings them home.
On screens wider than 900px the hero stays pinned while that plays (`--pin` on `.hero-pin`, 70svh of scrolling); on phones it plays as the hero scrolls away.

Phones and touch devices get a lighter body mesh, fewer clouds and half-resolution bloom.
With reduced motion the dragon is drawn once in its final pose, with no clouds, and nothing moves on scroll. Without WebGL the still stays, and on scroll it spins away to the left with the headline sliding apart.

## Dragons

Three dragons ship with the hero. Pick one in `js/hero/hero.js` (`const DRAGON = 'gray'`), or try one by
adding `?dragon=gold` or `?dragon=classic` to the address.

- `gold` (`js/hero/dragon.js`, alternative): antique gold and bronze, deer-like antlers, long whiskers, flame mane, four legs.
- `gray` (`js/hero/dragon-gray.js`, the default): the brand-gray dragon with one horn per side and no whiskers.
- `classic` (`js/hero/dragon-classic.js`): the first ring-coiled dragon.

## Page sections and motion

`css/site.css` and `js/site.js` hold the editorial layout and its motion (GSAP and ScrollTrigger from cdnjs):
the hero fly-through, word-by-word statements, counters, the CUK*-ture Supremacy board (`#culture`),
the Work accordion, and the orange eye-pattern band before it. Sections alternate
black (hero, culture, packages, sign-off), cream (about, work) and orange (ticker, contact).
Without GSAP, or with reduced motion, the page falls back to a static layout.

The hero (`#top`, black) is pinned while a camera flies forward through fifteen photos, in five waves of
three, which hang in depth around "Anantaboga Creative Studio", the line about the studio and the
Start a Project button (plain DOM cards with CSS perspective, built in `js/site.js` from the
`.svc-shots` images). When the last wave has flown past, the page scrolls on.

The Work section (`#work`, cream) is an accordion of the five kinds of film: thin strips with the name
turned on its side; pointing at one (or tapping it on a phone, where they stack) opens it to show its
photo, what it is and what it includes. "View all works" under it opens the index of all 27 films
with filters and the player. The Packages section has a pill switch between
Photo Production, Aftermovie and Live Streaming, and three tiers each with the middle one raised; prices read
"On request" until real prices are filled in (`data-price` in `index.html`).

Earlier versions are kept in `old/`:
- `old/2026-11-27/`: before the Work and Services sections were merged; `work-section.html` there is
  the old Work section (the sideways reel) on its own.
- `old/2026-11-27-before-redesign/`: the dragon hero with "Endless / Possibilities", the Work
  fly-through and everything else as it was just before this redesign.

The stylesheets and scripts are linked with `?v=YYYYMMDD` in `index.html`; change that number when you
update them so browsers fetch the new copies instead of using cached ones.
