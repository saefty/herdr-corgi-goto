# Corgi · Go to for Herdr

<h3 align="center">Jump to anything you already have open in Herdr. Type a few words of an agent's task, a repo name or a PR link, and ⌘⇧P takes you there before it opens anything new.</h3>

<p align="center"><img src="preview.png" width="88%" alt="Go to finding an agent by &quot;reminder mail&quot;" /></p>

<p align="center"><sub>✓&nbsp;Free,&nbsp;MIT &nbsp;·&nbsp; ✓&nbsp;Runs&nbsp;locally &nbsp;·&nbsp; ✓&nbsp;herdr-app&nbsp;0.1.14+</sub></p>

Part of [Corgi](https://github.com/saefty/herdr-corgi), a set of Herdr mods that plug into each other.

A ⌘⇧P box for Herdr that finds what you already have open before it opens anything new. Paste a PR link, type a
repo name or a few words from a session, and Enter takes you there.

![Opening Go to, typing "reminder mail" and jumping to the agent](docs/screenshots/walkthrough.gif)

## Use cases

- **You lost a session.** Type "reminder mail" and the agent working on due-date reminders comes up first, with the
  line that matched. No more opening a fifth tab for the same task.
- **Someone pastes a PR link in chat.** Paste it here. If you already have a space on that repo, Go to shows it; if
  a review mod is installed, it offers "Review PR".
- **You want to work on a repo.** Type part of its name. Go to finds the local clone under your code folders and
  opens it as a space, or shows the space that is already open there.
- **You want an agent on something.** Type what it should do ("bookshelf: add retry to the mailer") and Enter starts
  an agent with that as its task, in the named space or repo, else in the shown one. A second row does it in a new
  git worktree. If an open session already works on it, that session comes first.
- **You forgot a command.** Herdr's commands and layouts are in the same list.

## Screenshots

![A pasted PR link with the agent already on it](docs/screenshots/pr-link.png)

![A repo name with the open space and a local clone](docs/screenshots/repo-name.png)

![App commands with their keys](docs/screenshots/commands.png)

![An instruction offers to start an agent in the named space](docs/screenshots/start-agent.png)

## Features

- Searches agents, terminals, tabs, spaces, local git repos, layouts and app commands in one list.
- Understands PR links, `owner/repo#123`, `repo#123`, `#123` (in the current repo), repo URLs, `owner/repo`,
  folders and other URLs. Finds the owner for a bare repo name from your clones.
- "Already open: …" comes first when what you ask for is open somewhere.
- "Start agent: <text>" starts the agent you pick most in Herdr with the text as its task, optionally in a new
  worktree (`~/.herdr/worktrees/<repo>/agent-<words>`, branch `agent/<words>`).
- Ranking without an LLM: fuzzy matching on names plus word matching on what other mods know about a session,
  with simple stemming for English and German.
- Other mods can add their own rows, turn a pasted PR link into "Review PR", switch between your setups (work and
  personal, say) before an action runs, and answer a question in plain words with one model call ("Ask"). Without
  any of them Go to still works on its own.

## Works with

Go to, [PR review](https://github.com/saefty/herdr-corgi-pr-review) and the [chat bar](https://github.com/saefty/herdr-corgi-chatbar) each work alone. Installed together, they plug into each other:

- With **PR review**, a pasted PR link offers "Review PR" and opens it in the review layout, and reviews you started show up as "Resume review".
- With the **chat bar**, agents waiting on you show up as "Reply to …" and open their chat bubble.
- **Your own mod** can do the same: add rows, turn a kind of input into an action, or switch between your setups (and the environment agents start with) before an action runs.

## Install in three steps

<table>
<tr>
<td align="center" valign="top" width="33%"><h3>1</h3><b>Add the mod</b><br /><sub>With <a href="https://github.com/saefty/herdr-corgi">Corgi</a>: <code>corgi enable goto</code>. By hand: copy <code>mods/goto</code> to <code>~/.config/herdr-app/mods/</code>.</sub></td>
<td align="center" valign="top" width="33%"><h3>2</h3><b>Add the key</b><br /><sub>Corgi asks before it adds ⌘⇧P. By hand: merge <code>keys.json</code> into <code>~/.config/herdr-app/keys.json</code>.</sub></td>
<td align="center" valign="top" width="33%"><h3>3</h3><b>Check it</b><br /><sub>Corgi does this for you. By hand: <code>herdr-app check ~/.config/herdr-app/mods/goto</code>. Then press ⌘⇧P.</sub></td>
</tr>
</table>

Or tell your agent: `Read ~/.config/herdr-app/AGENTS.md, then add this mod: https://github.com/saefty/herdr-corgi-goto/tree/main`

By hand, step by step: copy `mods/goto` to `~/.config/herdr-app/mods/` and merge `keys.json` into
`~/.config/herdr-app/keys.json`. It binds ⌘⇧P to Go to and moves Herdr's palette to ⌘⌥⇧P (its commands also show up
in Go to). Then run `herdr-app check ~/.config/herdr-app/mods/goto`.

It runs `git`, `find` and `gh` (for PR titles and owner lookup), and writes a small repo cache under
`~/.config/herdr-app/`.

## Settings

`~/.config/herdr-app/goto.config.json` (optional):

```json
{ "roots": ["~/code", "~/src"], "depth": 4, "cloneTo": { "default": "~/code" } }
```

`roots` are the folders searched for git repos, `depth` how deep, `cloneTo` where "Clone" puts a repo.

## Customize

Without touching code:

- **Where it looks for repos** and where "Clone" puts new ones: `roots`, `depth` and `cloneTo` in
  `goto.config.json` (above).
- **The key:** ⌘⇧P comes from `keys.json`. Bind `mod.open:goto` to any free key instead.
- **What shows up:** install PR review or the chat bar and their rows appear. Your own mod can add rows too.

Changed the code itself? Your edits survive `corgi update`: Corgi merges your version, the old release and the new
one. `corgi diff goto` shows what you changed, and `corgi resolve goto` helps when an update and your edit touch the
same lines.

## Tests

`node --test mods/goto/test_goto.mjs`

## For mod authors

How to add rows, claim an input or switch a setup from your own mod: [PROVIDERS.md](mods/goto/PROVIDERS.md).

## License

MIT
