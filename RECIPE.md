# Corgi · Go to

Jump to anything you already have open in Herdr. Type a few words of an agent's task, a repo name or a PR link, and ⌘⇧P takes you there before it opens anything new.

A ⌘⇧P box in the style of the command palette. You type or paste anything, and it finds what is already
open before it offers to open something new: agents, terminals, tabs and spaces, local git repos, GitHub
PRs and repos, folders, URLs, layouts and app commands.

**What you see:** a popup 620 px wide and 408 px tall, 60 px from the top of the window, with the palette's look.
At the top is a 36 px search line (accent border, search icon, "Esc"). Below it are up to 10 rows of 32 px,
and the list scrolls. Each row has a glyph (agent status, program icon or kind icon), a title with the
fuzzy-matched letters in the accent color, a dim subtitle (where it is, or the text that matched), the
status ("needs you · 5m", "working", "idle · 2h") and on the right a key or tag chip. The selected row uses
the `selected` color.

**How it behaves:**
- Empty: open agents and spaces, the most urgent first (needs you, finished, working, then the latest).
- Text: open entries, ranked by a fuzzy title match plus token relevance. Tokens are lowercased, umlauts are
  folded, a light English/German stemmer runs, and word prefixes count. Fields are weighted title >
  keywords > text > folder. After the open entries come local repos (an "Already open" row if a space
  works there, else "Open <repo> as space"), repos known only remotely ("Clone"), provider items, layouts
  and commands.
- `owner/repo#12`, `repo#12`, `#12` (the shown space's repo) and PR URLs give "Already open" (an entry that
  mentions the PR, or a terminal on its branch), handler rows and "Open in browser · <title>".
- `owner/repo`, repo URLs and bare names give a local clone ("Open as space", with a duplicate guard:
  "Already open" first, "Open new anyway" below), else "Clone <owner/repo>", plus "Open in browser". If a bare name is
  unknown, it is looked up with `gh repo view` under the owners seen so far. The lookup is debounced and
  cached for a day.
- A path gives "Open as space", with the same duplicate guard. Any other URL gives "Open in browser".
- Text of 3+ characters also gives "Start agent: <text>" (subtitle: the agent and where). Four or more words, or
  `<space or repo>: text`, count as an instruction: the row comes right after what is open (else it is last), with
  "Start agent in a new worktree" below when the place is a local git checkout, and an open agent matching
  four fifths of the instruction's words (not the place's name) first as "Already open". The place: the named space, the space working in the
  named repo, a new space in that repo, else the shown space at the focused folder. Enter runs `tab.new {space,
  folder, name, argv, task}` (or `space.new`) through the context hook. The agent is the first installed one from
  `knownAgents()`; its argv gets the hook's `env` for the context. The worktree: `git worktree add -b
  agent/<kebab words, ≤ 40> ~/.herdr/worktrees/<repo>/agent-<words>`, then `space.new` there.
- ↑/↓, PgUp/PgDn, Enter or a click runs the row, and Esc closes the box. A clone keeps the box open with
  "Cloning…".

**Built from:** `mods/goto/main.js` (view, data, actions), `match.js` (pure: parse, resolve, plug-ins,
ranking), `mod.json` (`overlay: {kind: "popup", at: "top", offset: 60, width: 620, height: 408}`), and a key
binding: `"cmd-shift-p": "mod.open:goto"`. It uses `spaces() panes() agents() commands() layouts() keys()
focused()`, `exec` for `find`, `git`, `gh` and `open`, and `readTextFile` for `.git/config`. The cache is
`data/goto/cache.json` (repos found and gh lookups, bounded). The config is `goto.config.json` in the app home.
Plug-ins are in PROVIDERS.md.

**Watch out:** the rows are computed off the render path (50 ms after a key, every 2 s, and when data
arrives), and lists are tokenized once. Ranking inside render gets interrupted on large setups. A docked
copy steals the keyboard, so `mod.json` must say `"place": "none"` before the folder first loads.

**Done when:** `herdr-app check mods/goto` passes, `node --test mods/goto/test_goto.mjs` passes, and ⌘⇧P
opens the box under the tab bar. Typing a word from an agent's tab finds that agent, and Enter focuses it.

**Demo:** `demo/setup.sh` builds an invented setup in `demo/run` (ignored by git): a stand-in home with clones of
`acme/bookshelf`, `acme/orbit-sync`, `acme/orbit-web` and `acme/ledger` under `~/code`, its own herdr-core
(socket `/tmp/herdr-goto-demo/core.sock`), and a Herdr home with goto plus `demo/fixtures/goto-demo`. That provider
gives the agents titles and topics, claims PR links, and passes `control/query.txt` on as the shared
`goto.demo.query`. `demo/record.sh` opens a second window on it, fills it with stand-in agents (`fixtures/agent.sh`
reports a status with OSC 7501 and shows a fixed screen), takes the screenshots and the GIF, and quits.
`fixtures/bin/gh` answers the one PR lookup, so nothing goes to the network. `goto.demo.query` is goto's demo
hook: when it holds a string, the open box types it in and publishes its rows' titles as `goto.demo.rows`
`{query, titles}`; `goto.demo.pick` `{title}` then runs the first row whose title starts with it, as Enter would
(the herdr-corgi interplay suite uses both). Nothing sets them in normal use.
