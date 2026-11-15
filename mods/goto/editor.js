// "Open in <Editor>": the editors a mod can open a folder or a file in, how the installed ones are found without a
// process, which one a place gets, and the one program a click starts. Pure: no Herdr import, node tests it
// (test_editor.mjs). The same file serves every mod of the set; the choice is shared between them (shared
// "editor.choice" = {default: id | null, repos: {"<common git dir>": {main: id, worktree: id}}}).

// name: the whole name (tooltips, menus). label: the link ("IntelliJ ↗ ▾"). short: the monogram of a row ("IJ ↗").
// apps: macOS application names. cli: the command line tools (Linux). url: what opens file:line on macOS.
const seg = (abs) => String(abs).split("/").map(encodeURIComponent).join("/"); // every path segment encoded, the slashes kept
export const EDITORS = [
  { id: "vscode", name: "VS Code", label: "VS Code", short: "VS", apps: ["Visual Studio Code"], cli: ["code"], url: (abs, n) => `vscode://file${seg(abs)}:${n}` },
  { id: "idea", name: "IntelliJ IDEA", label: "IntelliJ", short: "IJ", apps: ["IntelliJ IDEA", "IntelliJ IDEA Ultimate", "IntelliJ IDEA CE", "IntelliJ IDEA Community Edition"], cli: ["idea", "idea.sh", "intellij-idea-community", "intellij-idea-ultimate"], // the last two: the Snap's launchers (/snap/bin)
    url: (abs, n) => `idea://open?file=${encodeURIComponent(abs)}&line=${n}` },
  { id: "cursor", name: "Cursor", label: "Cursor", short: "Cu", apps: ["Cursor"], cli: ["cursor"], url: (abs, n) => `cursor://file${seg(abs)}:${n}` },
  { id: "zed", name: "Zed", label: "Zed", short: "Zed", apps: ["Zed"], cli: ["zed"], url: (abs, n) => `zed://file${seg(abs)}:${n}` },
];
// The first line's number in each editor's URL. ponytail: IntelliJ's idea://…&line= is taken to count from 1 until it
// was tried by hand; if it counts from 0, this one number changes.
export const LINE_BASE = { vscode: 1, idea: 1, cursor: 1, zed: 1 };
// A JVM project's marks in a repo's root, and the files that are IntelliJ's by their name.
export const PROJECT_MARKS = ["pom.xml", "build.gradle", "build.gradle.kts", ".idea"];
const JVM_FILE = /(\.(java|kt|kts|gradle|groovy)|(^|\/)pom\.xml)$/;

// A setting's own editors ({id, name, folder: [argv…], file: [argv…]} with {dir}, {file}, {line}): the usable ones.
export function extraEditors(list) {
  const argv = (a) => Array.isArray(a) && a.length > 0 && a.every((x) => typeof x === "string" && x.length > 0);
  return (Array.isArray(list) ? list : []).filter((e) => e && /^[A-Za-z0-9_-]{1,40}$/.test(String(e.id ?? "")) && argv(e.folder) && argv(e.file))
    .map((e) => ({ id: e.id, name: String(e.name ?? e.id), label: String(e.name ?? e.id), short: String(e.short ?? e.name ?? e.id).slice(0, 3), folder: e.folder, file: e.file, custom: true }));
}
export const allEditors = (extra = []) => [...extraEditors(extra), ...EDITORS.filter((e) => !extraEditors(extra).some((x) => x.id === e.id))];
const of = (id, extra) => allEditors(extra).find((e) => e.id === id);
export const editorName = (id, extra = []) => of(id, extra)?.name ?? id;

// ---- which editors are installed, without a process
// The files whose presence says an editor is installed: [{id, path, how}], read with readTextFile. macOS: each app's
// Contents/Info.plist in /Applications and in the person's Applications folder. Linux: the launcher scripts in the
// usual folders (ponytail: a tool somewhere else on the PATH is not found; the setting's own editors cover that).
export function candidates(home, os = "darwin") {
  if (os === "darwin") return EDITORS.flatMap((e) => e.apps.flatMap((a) => ["/Applications", `${home}/Applications`].map((d) => ({ id: e.id, path: `${d}/${a}.app/Contents/Info.plist`, how: { app: `${d}/${a}.app` } }))));
  return EDITORS.flatMap((e) => e.cli.flatMap((c) => ["/usr/bin", "/usr/local/bin", "/snap/bin", `${home}/.local/bin`, `${home}/bin`].map((d) => ({ id: e.id, path: `${d}/${c}`, how: { cli: `${d}/${c}` } }))));
}
// present: one bool per candidate (the file could be read). {<id>: {app: path} | {cli: path}}: the first one found.
export function foundFrom(cands, present) {
  const found = {};
  cands.forEach((c, k) => { if (present[k] && !found[c.id]) found[c.id] = c.how; });
  return found;
}
// The installed editors, in the table's order: [{id, name, label, short}] (the ▾ menu).
export const installed = (found = {}, extra = []) => allEditors(extra).filter((e) => e.custom || found?.[e.id]).map((e) => ({ id: e.id, name: e.name, label: e.label, short: e.short }));

// ---- which project a folder belongs to
// A checkout's `.git` as text (null when it is a folder, as in a main checkout): {common: the git directory the
// project's checkouts share (the key the choice is kept under), linked: a linked worktree (its `.git` is a file)}.
export function gitLink(text, root) {
  const dir = /^gitdir:\s*(.+)$/m.exec(String(text ?? ""))?.[1]?.trim();
  if (!dir) return { common: `${root}/.git`, linked: false };
  const abs = dir.startsWith("/") ? dir : `${root}/${dir}`;
  return { common: abs.replace(/\/worktrees\/[^/]+\/?$/, ""), linked: /\/worktrees\/[^/]+\/?$/.test(abs) };
}

// ---- which editor
// The editor a place gets, and why (for the menu's one muted line): a pick in the ▾ for this project wins (kept apart
// for its main checkout and for its worktrees); else a file goes by its ending, a folder by the kind of project, and
// a linked worktree's folder to VS Code (IntelliJ would import the project there and write .idea/ into it); else the
// general default. One that is not installed is passed over for the first installed one. {id, why} or null.
// foreign: a PR that is not trusted, whose build scripts never get IntelliJ (buildScript).
export function editorOf({ file = null, marks = [], linked = false, choice = null, key = null, found = {}, extra = [], foreign = false } = {}) {
  const noIdea = foreign && buildScript(file);
  const have = (id) => Boolean(id) && !(noIdea && id === "idea") && (Boolean(found?.[id]) || extraEditors(extra).some((e) => e.id === id));
  const picked = choice?.repos?.[key]?.[linked ? "worktree" : "main"];
  const jvm = (marks ?? []).some((m) => PROJECT_MARKS.includes(m));
  const tries = [[picked, linked ? "chosen for worktrees of this repo" : "chosen for this repo"],
    file ? [JVM_FILE.test(file) ? "idea" : "vscode", JVM_FILE.test(file) ? "suggested: a JVM file" : "suggested: by the file's kind"]
      : linked ? ["vscode", "suggested: a worktree"] : [jvm ? "idea" : "vscode", jvm ? "suggested: a Maven or Gradle project" : "suggested: by the kind of project"],
    [choice?.default, "your default"], ...allEditors(extra).map((e) => [e.id, "the installed one"])];
  const hit = tries.find(([id]) => have(id));
  return hit ? { id: hit[0], why: hit[1] } : null;
}
// editor.choice with this project's editor set (for its main checkout, or for its worktrees): {choice, changed};
// changed false means nothing is to be written.
export function withChoice(choice, key, linked, id) {
  const now = { default: choice?.default ?? null, repos: { ...(choice?.repos ?? {}) } }, slot = linked ? "worktree" : "main";
  if (!key || !id || now.repos[key]?.[slot] === id) return { choice: now, changed: false };
  now.repos[key] = { ...(now.repos[key] ?? {}), [slot]: id };
  return { choice: now, changed: true };
}

// ---- what may be opened
// A file of a checkout as an absolute path: the path normalized ("." and ".." resolved) and still below the root;
// null when it is absolute, leaves the root or is empty. root itself is taken as it is.
export function safeFile(root, file) {
  if (!root || !file || String(file).startsWith("/") || String(file).includes("\0")) return null;
  const out = [];
  for (const s of String(file).split("/")) { if (s === "" || s === ".") continue; if (s === "..") { if (!out.length) return null; out.pop(); } else out.push(s); }
  return out.length ? `${String(root).replace(/\/+$/, "")}/${out.join("/")}` : null;
}
// Files of a PR that is not trusted which an editor acts on by opening them or their folder: a workspace or project
// file, the editor's own settings, a dev container, build files. By pattern and whatever the case (a file system that
// ignores case opens Build.Gradle as build.gradle). They are read in Herdr only.
const BUILD_FILES = ["pom.xml", "build.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts", "gradlew", "gradlew.bat", "makefile", "package.json", "tasks.json", "launch.json"];
export const foreignBlocked = (file) => /\.(gradle(\.kts)?|ipr|iml|code-workspace)$/i.test(String(file)) || /(^|\/)\.(vscode|idea|devcontainer)\//i.test(String(file)) || BUILD_FILES.includes(String(file).split("/").pop().toLowerCase());
// A build script by its ending: IntelliJ evaluates such a file (and offers to import its project) when it opens it,
// so one from a PR that is not trusted never goes there, whatever was picked.
export const buildScript = (file) => /(\.(kts|gradle|groovy)|(^|\/)pom\.xml)$/i.test(String(file ?? ""));

// ---- what a click starts
// ONE program with its arguments (never a shell line), or null when it cannot be opened. target: {dir} a folder, or
// {file, line} one file (absolute paths). how: the editor's entry in found. macOS: `open` with the editor's URL for a
// file and with the app for a folder; Linux: the editor's own tool.
export function openArgv(id, how, { dir = null, file = null, line = null } = {}, extra = []) {
  if (!dir && !file) return null;
  const n = Number.isInteger(line) && line > 0 ? line : 1;
  const own = extraEditors(extra).find((e) => e.id === id);
  if (own) {
    const [cmd, ...args] = (file ? own.file : own.folder).map((x) => x.replaceAll("{dir}", dir ?? "").replaceAll("{file}", file ?? "").replaceAll("{line}", String(n)));
    return [cmd, args];
  }
  const e = EDITORS.find((x) => x.id === id);
  if (!e || !how) return null;
  if (how.app) return file ? ["open", [e.url(file, n - 1 + (LINE_BASE[id] ?? 1))]] : ["open", ["-a", how.app, dir]];
  if (!how.cli) return null;
  if (!file) return [how.cli, [dir]];
  return id === "idea" ? [how.cli, ["--line", String(n), file]] : id === "zed" ? [how.cli, [`${file}:${n}`]] : [how.cli, ["-g", `${file}:${n}`]];
}

// ---- the words
// The link ("IntelliJ ↗"; its ▾ is drawn next to it), a row's monogram ("IJ ↗"), and the tooltip: what a click opens,
// where, and for a PR that is not trusted, why it is only the file. Paths as the person reads them (short: home as ~).
export const linkLabel = (id, extra = []) => `${of(id, extra)?.label ?? id} ↗`;
export const shortLabel = (id, extra = []) => `${of(id, extra)?.short ?? id} ↗`;
export const openingLabel = (id, extra = []) => `Opening ${of(id, extra)?.label ?? id} …`;
// The menu, in one wording wherever it is named: the ▾'s tooltip, a short link's tooltip (a short link has no ▾: a
// right click opens its menu) and the sentence after an editor that did not start. The words are the menu's own
// entries (menuItems: "Copy path", "Look for installed editors again").
export const MENU_TIP = "Other editors, Copy path, Look for installed editors again.";
export const shortTip = (tip) => `${tip} Right-click: other editors, Copy path, Look for installed editors again.`;
export const failedText = (id, extra = []) => `${editorName(id, extra)} could not be started. Open the link's menu (its ▾, or a right-click on a short link) to choose another editor or to look for installed editors again.`;
export function linkTip(id, { dir = null, file = null, line = null, where = "", foreign = false } = {}, extra = []) {
  const name = editorName(id, extra);
  if (!file) return `Open ${dir} in ${name}.`;
  return `Open ${file}${Number.isInteger(line) && line > 0 ? ` at line ${line}` : ""} in ${name}${where ? `, ${where}` : ""}.${foreign ? " Only the file is opened, not its folder: this PR is not trusted yet, and an editor can run a project's code when it opens a folder." : ""}`;
}
// The ▾ menu as data, at most six entries; the mod draws and runs them. [{kind, id?, text, hint?}]:
// "now" the editor in use (hint: why it is that one), "editor" another installed one (a pick opens and is kept for
// this project's main checkout or for its worktrees; hint: what it does to a worktree), "project" the project's own
// folder instead of the worktree (only when `project` is given: its words for the hint, as a branch name or a path),
// "copy" the path with its line (hint), "again" look for the installed editors anew.
export function menuItems({ now = null, found = {}, extra = [], linked = false, file = null, line = null, project = null } = {}) {
  const tail = [...(project ? [{ kind: "project", text: "Open the project folder instead", hint: String(project) }] : []),
    ...(file ? [{ kind: "copy", text: "Copy path", hint: `${file.split("/").pop()}${line ? `:${line}` : ""}` }] : []), { kind: "again", text: "Look for installed editors again" }];
  const head = now ? [{ kind: "now", id: now.id, text: `✓ ${editorName(now.id, extra)}`, hint: now.why }] : [], scope = linked ? "worktrees of this repo" : "this repo";
  const rest = installed(found, extra).filter((e) => e.id !== now?.id).slice(0, Math.max(0, 6 - head.length - tail.length));
  return [...head, ...rest.map((e) => ({ kind: "editor", id: e.id, text: `Always use ${e.name} for ${scope}`, ...(linked && e.id === "idea" ? { hint: "imports the project and writes .idea/ into the worktree" } : {}) })), ...tail];
}
