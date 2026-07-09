# Case Archive

A self-updating lore wiki for a Kaiju Paradise roleplay universe, hosted free on GitHub
Pages. Drop a folder with a `content.txt` file anywhere under `content/`, push, and it
shows up on the site automatically — no rebuilding by hand, no other website to touch.

## How it works

- Every folder under `content/` that contains a `content.txt` becomes a document.
- Folders that contain other folders become categories in the sidebar. Nesting can go
  as deep as you like.
- A GitHub Action (`.github/workflows/build-index.yml`) rebuilds `data/index.json`
  automatically every time you push a change under `content/`, then commits the result.
- The site itself (`index.html` / `assets/`) is plain HTML/CSS/JS — it just reads
  `data/index.json` and renders it. No build step, no npm install, nothing to install
  on your computer.

## One-time setup

1. Create a new GitHub repository and push everything in this folder to it.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick the `main`
   branch and `/ (root)` folder, then save.
4. Wait a minute or two — GitHub will give you a URL like
   `https://your-username.github.io/your-repo-name/`. That's your site.

The included `content/` folder has example files (Factions, Characters, Locations, plus
two sample faction pages) so you can see the format working immediately. Replace or
delete them with your own lore.

## Adding a new document

1. Make a new folder anywhere under `content/`, named after the topic, e.g.
   `content/factions/coast-guard`.
2. Put a `content.txt` file inside it.
3. Start the file with a heading, and optionally a `>` line under it for a short
   one-line description — this becomes the bold name + short description at the top
   of the page:

   ```
   # Coast Guard
   > Patrols the harbor after dark, first to respond to any breach

   Body text goes here. Blank lines start a new paragraph.

   **Status:** Active
   - bullet point
   - another bullet point
   ```

4. Commit and push. Within about a minute the GitHub Action rebuilds the index and the
   new page appears in the sidebar — nobody needs to touch any code.

### Formatting supported in content.txt

- `# Heading`, `## Heading`, `### Heading`
- `> short description` — only works directly under the `#` title; becomes the small
  tagline next to the photo
- Blank line = new paragraph
- `- item` = bullet list
- `**bold**` and `*italic*`
- `![caption](image.jpg)` on its own line = an inline picture with a caption
  (see **Adding images** below)
- `||hidden text||` = a spoiler, redacted with a black bar until clicked
  (see **Spoilers** below)

Anything else is shown as plain text, so you can't easily break it.

### Spoilers

Wrap anything in double pipes, same as Discord's syntax, and it renders as a solid
black bar instead of the real text: `The kaiju's true name is ||Xtharion||.` becomes
`The kaiju's true name is ████████.` It's a permanent redaction, not click-to-reveal —
there's no button or interaction, it just stays blacked out on the page. Useful for
things not every character (or player) is supposed to know yet — custom transfur
details, secret identities, plot twists you're saving for later.

To actually reveal something later, edit the file and remove the `||...||` around it,
then push — the bar disappears and the real text shows.

**One real limit worth knowing:** this hides the text from casual reading — someone
looking at the page or viewing page source won't see it. But it's still a public static
site with no login, so the raw text does still travel to every visitor's browser in the
background data (`data/index.json`), it's just never displayed. A friend who
deliberately opens browser dev tools and inspects that network request could still find
it. Treat it as "hidden from casual view," not "secure from someone trying to cheat."

### Adding images

Two ways to use pictures, and you can use both in the same document:

**A profile photo at the top of the page** (like the sketch: photo + bold name + short
line) — two options, whichever is easier:

1. Add an image file named exactly `cover` next to `content.txt` — no markup needed:
   ```
   content/characters/rex/
     content.txt
     cover.jpg
   ```
   Any `cover.png` / `cover.jpg` / `cover.jpeg` / `cover.webp` / `cover.gif` is picked
   up automatically.

2. Or, put `![caption](filename.jpg)` as the very first line under the title/tagline —
   it becomes the header photo the same way. This is what happens if you write the
   image line right after `# Title`:
   ```
   # Rex Calder
   ![Field photo, taken during the harbor incident](photo.jpg)

   Body text starts here...
   ```
   Either way, you still need the actual picture file sitting in that same folder —
   writing the filename in text doesn't create the image itself, it just tells the
   page which file to load.

**Pictures inside the body of the text** (screenshots, transformation stages, maps,
reference sheets, etc.) — put any other image file in the same folder, then reference
it from `content.txt` on its own line, anywhere after the header:

```
![Stage two, three days after exposure](stage-two.jpg)
```

The text in the brackets becomes a small caption under the image.

### Browsing — swipe, buttons, or arrow keys

Documents that sit in the same category can be flipped through without going back to
the sidebar:
- **Touch:** swipe left/right on the document
- **Keyboard:** ← / → arrow keys
- **Mouse:** Previous / Next buttons at the bottom of the page

Every document slides in from the right with a soft synthesized sound effect (a real
`.ogg` file under `assets/sfx/`, not a copied clip) — toggleable with the SFX button in
the top right.

### Sub-categories

Nesting folders nests categories. For example:

```
content/
  factions/
    content.txt          <- "Factions" category page
    hunters/
      content.txt         <- a document under Factions
    kaiju/
      content.txt          <- a document under Factions
      subject-07/
        content.txt          <- nested under Kaiju
```

A folder doesn't need its own `content.txt` to act as a category — if it only holds
sub-folders, it just becomes a plain listing page in the sidebar.

## Running the index build locally (optional)

If you want to preview `data/index.json` after editing files, without waiting for
GitHub Actions:

```bash
python3 scripts/build_index.py
```

Then open `index.html` in a browser (or run any local static server, e.g.
`python3 -m http.server`) to preview.

## Project structure

```
content/                  your lore lives here
  content.txt               root/home page
  factions/
  characters/
  locations/
data/index.json           auto-generated — do not edit by hand
scripts/build_index.py    the script that generates data/index.json
.github/workflows/        the GitHub Action that runs the script automatically
index.html, assets/       the site itself
```
