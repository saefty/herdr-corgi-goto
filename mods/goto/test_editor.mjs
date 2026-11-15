// Run: node test_editor.mjs  ("Open in <Editor>": the table, finding the installed editors without a process, which
// editor a place gets, what may be opened, and the one program a click starts. No editor is started here: only the
// program and its arguments are looked at.)
import assert from "node:assert/strict";
import { buildScript, MENU_TIP, shortTip, failedText } from "./editor.js";
import { EDITORS, LINE_BASE, PROJECT_MARKS, candidates, foundFrom, installed, gitLink, editorOf, withChoice, safeFile, foreignBlocked, openArgv, extraEditors, linkLabel, shortLabel, openingLabel, linkTip, menuItems } from "./editor.js";

// Installed editors are found by reading files: each app's Info.plist in both Applications folders (macOS), the
// launcher scripts on Linux. The first one found per editor counts.
const mac = candidates("/people/me", "darwin");
assert.ok(mac.every((c) => c.path.endsWith(".app/Contents/Info.plist")) && mac.some((c) => c.path.startsWith("/people/me/Applications/IntelliJ IDEA")));
for (const e of EDITORS) assert.ok(mac.some((c) => c.id === e.id), `${e.name} is looked for`);
const at = (path) => mac.map((c) => c.path === path);
assert.deepEqual(foundFrom(mac, at("/people/me/Applications/IntelliJ IDEA Ultimate.app/Contents/Info.plist")), { idea: { app: "/people/me/Applications/IntelliJ IDEA Ultimate.app" } });
assert.deepEqual(foundFrom(mac, mac.map(() => false)), {});
const linux = candidates("/people/me", "linux");
assert.deepEqual(foundFrom(linux, linux.map((c) => c.path === "/snap/bin/code")), { vscode: { cli: "/snap/bin/code" } });
const found = { vscode: { app: "/Applications/Visual Studio Code.app" }, idea: { app: "/Applications/IntelliJ IDEA.app" } };
assert.deepEqual(installed(found).map((e) => [e.id, e.label, e.short]), [["vscode", "VS Code", "VS"], ["idea", "IntelliJ", "IJ"]]);

// A checkout's `.git`: a folder in the main checkout, a file in a linked worktree, which names the shared git folder.
assert.deepEqual(gitLink(null, "/code/app"), { common: "/code/app/.git", linked: false });
assert.deepEqual(gitLink("gitdir: /code/app/.git/worktrees/fix-1\n", "/wt/fix-1"), { common: "/code/app/.git", linked: true });
assert.deepEqual(gitLink("gitdir: ../app/.git/modules/sub\n", "/code/sub"), { common: "/code/sub/../app/.git/modules/sub", linked: false }, "a submodule is no worktree");

// Which editor: a pick for the project wins; a file goes by its ending; a folder by the kind of project; a linked
// worktree's folder to VS Code; one that is not installed is passed over.
const id = (o) => editorOf({ found, ...o })?.id;
assert.deepEqual(["src/A.java", "b/build.gradle.kts", "x/pom.xml", "a.kt", "s.groovy", "a.py", "README.md", "pom.xml.bak"].map((file) => id({ file })), ["idea", "idea", "idea", "idea", "idea", "vscode", "vscode", "vscode"]);
assert.equal(id({ file: "a.py", marks: ["pom.xml"] }), "vscode", "the ending beats the kind of project for a file");
for (const m of PROJECT_MARKS) assert.equal(id({ marks: [m] }), "idea", `${m}: a JVM project's folder`);
assert.equal(id({ marks: [] }), "vscode");
assert.equal(id({ marks: ["pom.xml"], linked: true }), "vscode", "a worktree's folder opens in VS Code, also for a Gradle project");
const choice = { default: null, repos: { "/code/app/.git": { main: "vscode", worktree: "idea" } } };
assert.deepEqual([id({ file: "A.java", choice, key: "/code/app/.git" }), id({ marks: [], linked: true, choice, key: "/code/app/.git" }), id({ file: "A.java", choice, key: "/other/.git" })], ["vscode", "idea", "idea"], "the project's pick, kept apart for its worktrees");
assert.equal(editorOf({ file: "A.java", found: { vscode: found.vscode } }).id, "vscode", "IntelliJ is not installed: the installed one");
assert.equal(editorOf({ file: "A.java", found: {} }), null, "none installed: no link");
assert.match(editorOf({ marks: ["build.gradle"], found }).why, /Maven or Gradle/);

// The shared choice is written only when it changed, per project and per kind of checkout.
assert.deepEqual(withChoice(null, "/g", false, "idea"), { choice: { default: null, repos: { "/g": { main: "idea" } } }, changed: true });
assert.deepEqual(withChoice({ default: null, repos: { "/g": { main: "idea" } } }, "/g", true, "vscode").choice.repos["/g"], { main: "idea", worktree: "vscode" });
assert.equal(withChoice({ default: null, repos: { "/g": { main: "idea" } } }, "/g", false, "idea").changed, false);
assert.equal(withChoice(null, null, false, "idea").changed, false);

// What may be opened: a path that stays below the checkout; for a PR that is not trusted, not the files an editor acts on.
assert.equal(safeFile("/co", "src/./a/../b.py"), "/co/src/b.py");
assert.deepEqual(["../x", "a/../../x", "/etc/passwd", "", "a\0b", "."].map((f) => safeFile("/co", f)), [null, null, null, null, null, null], "nothing that leaves the checkout");
assert.deepEqual(["x.code-workspace", ".vscode/tasks.json", ".idea/workspace.xml", "pom.xml", "sub/build.gradle.kts", "Makefile", "package.json", "src/a.py", "docs/pom.md"].map(foreignBlocked), [true, true, true, true, true, true, true, false, false]);
// … by pattern and whatever the case, not by a list of exact names: any Gradle script, IntelliJ's project and module
// files, Ant's build file, a dev container, and the same names written in another case.
assert.deepEqual(["ci/deps.gradle", "x.gradle.kts", "old.ipr", "mod.iml", "build.xml", "POM.XML", "Build.Gradle", ".VSCode/tasks.json", "a.CODE-WORKSPACE", ".devcontainer/devcontainer.json", "sub/.DevContainer/x.sh", "MAKEFILE"].map(foreignBlocked),
  Array(12).fill(true));
assert.deepEqual(["src/gradle.py", "docs/build.xml.md", "iml/a.txt", "devcontainer/readme.md"].map(foreignBlocked), [false, false, false, false]);
// A build script of such a PR never goes to IntelliJ: not by its ending, not by a pick, not as the only editor.
{
  const both = { vscode: { app: "/A" }, idea: { app: "/B" } }, picked = { default: "idea", repos: { "/g": { main: "idea" } } };
  assert.deepEqual(["a.main.kts", "ci/Jenkins.GROOVY", "x/pom.xml", "A.java"].map(buildScript), [true, true, true, false]);
  assert.equal(editorOf({ file: "a.main.kts", found: both }).id, "idea", "your own: the JVM file's editor");
  assert.equal(editorOf({ file: "a.main.kts", found: both, foreign: true, choice: picked, key: "/g" }).id, "vscode");
  assert.equal(editorOf({ file: "a.main.kts", found: { idea: { app: "/B" } }, foreign: true }), null, "only IntelliJ is there: no link");
  assert.equal(editorOf({ file: "A.java", found: both, foreign: true }).id, "idea", "source is not a build script");
}

// What a click starts: ONE program with its arguments, never a shell line. macOS: `open` with the editor's URL for a
// file (every path segment encoded) and with the app for a folder; Linux: the editor's own tool.
const file = "/people/me/my repo/src/a b#1?.js";
assert.deepEqual(openArgv("vscode", found.vscode, { file, line: 12 }), ["open", ["vscode://file/people/me/my%20repo/src/a%20b%231%3F.js:12"]]);
assert.deepEqual(openArgv("idea", found.idea, { file, line: 12 }), ["open", [`idea://open?file=${encodeURIComponent(file)}&line=${12 - 1 + LINE_BASE.idea}`]]);
assert.deepEqual(openArgv("vscode", found.vscode, { dir: "/people/me/my repo" }), ["open", ["-a", "/Applications/Visual Studio Code.app", "/people/me/my repo"]]);
assert.deepEqual(openArgv("idea", found.idea, { dir: "/co" }), ["open", ["-a", "/Applications/IntelliJ IDEA.app", "/co"]], "not open -na, not the idea script");
assert.deepEqual(openArgv("vscode", found.vscode, { file }), ["open", ["vscode://file/people/me/my%20repo/src/a%20b%231%3F.js:1"]], "no line: the first");
assert.deepEqual(openArgv("vscode", { cli: "/usr/bin/code" }, { file, line: 3 }), ["/usr/bin/code", ["-g", `${file}:3`]]);
assert.deepEqual(openArgv("idea", { cli: "/usr/local/bin/idea" }, { file, line: 3 }), ["/usr/local/bin/idea", ["--line", "3", file]]);
assert.deepEqual(openArgv("zed", { cli: "/usr/bin/zed" }, { dir: "/co" }), ["/usr/bin/zed", ["/co"]]);
assert.deepEqual([openArgv("vscode", found.vscode, {}), openArgv("vscode", null, { dir: "/co" }), openArgv("nope", { app: "/x" }, { dir: "/co" })], [null, null, null]);

// A setting's own editor: its argv with the placeholders filled; a broken entry is left out.
const extra = [{ id: "nvim", name: "Neovim", folder: ["wezterm", "start", "--cwd", "{dir}", "nvim"], file: ["wezterm", "start", "nvim", "+{line}", "{file}"] }, { id: "bad id", folder: ["x"], file: ["y"] }, { id: "half", folder: ["x"] }];
assert.deepEqual(extraEditors(extra).map((e) => e.id), ["nvim"]);
assert.deepEqual(openArgv("nvim", null, { file, line: 9 }, extra), ["wezterm", ["start", "nvim", "+9", file]]);
assert.equal(editorOf({ found: {}, extra }).id, "nvim");

// The words: the link, the monogram of a row, the state after a click, the tooltip, and the menu (at most six).
assert.deepEqual([linkLabel("idea"), shortLabel("idea"), shortLabel("vscode"), openingLabel("idea")], ["IntelliJ ↗", "IJ ↗", "VS ↗", "Opening IntelliJ …"]);
assert.equal(linkTip("vscode", { dir: "/co" }), "Open /co in VS Code.");
assert.equal(linkTip("vscode", { dir: "/co", file: "src/api/limits.ts", line: 42, where: "in the checkout of this PR" }), "Open src/api/limits.ts at line 42 in VS Code, in the checkout of this PR.");
// The menu is named in one wording: the ▾'s tooltip, a short link's tooltip and the sentence after a failed start use
// the words of the menu's own entries, and the last one fits a short link too (it has no ▾).
{ const again = menuItems({ file: "a.py" }).find((m) => m.kind === "again").text, copy = menuItems({ file: "a.py" }).find((m) => m.kind === "copy").text;
  for (const text of [MENU_TIP, shortTip("Open a.py in VS Code."), failedText("vscode")]) assert.ok(text.toLowerCase().includes(again.toLowerCase()), text);
  assert.ok(MENU_TIP.includes(copy) && shortTip("x").includes(copy) && shortTip("Open a.py.").startsWith("Open a.py. Right-click: "));
  assert.equal(failedText("idea"), "IntelliJ IDEA could not be started. Open the link's menu (its ▾, or a right-click on a short link) to choose another editor or to look for installed editors again."); }
assert.match(linkTip("idea", { file: "A.java", line: 5, foreign: true }), /^Open A\.java at line 5 in IntelliJ IDEA\. Only the file is opened, not its folder: .*$/);
const four = { ...found, cursor: { app: "/c" }, zed: { app: "/z" } };
const menu = menuItems({ now: { id: "idea", why: "suggested: a JVM file" }, found: four, file: "src/A.java", line: 5 });
assert.deepEqual(menu, [{ kind: "now", id: "idea", text: "✓ IntelliJ IDEA", hint: "suggested: a JVM file" }, { kind: "editor", id: "vscode", text: "Always use VS Code for this repo" }, { kind: "editor", id: "cursor", text: "Always use Cursor for this repo" },
  { kind: "editor", id: "zed", text: "Always use Zed for this repo" }, { kind: "copy", text: "Copy path", hint: "A.java:5" }, { kind: "again", text: "Look for installed editors again" }]);
const wt = menuItems({ now: { id: "vscode", why: "suggested: a worktree" }, found: four, linked: true, file: "a.py", project: "main" });
assert.deepEqual([wt.length, wt.map((m) => m.kind), wt[1]], [6, ["now", "editor", "editor", "project", "copy", "again"], { kind: "editor", id: "idea", text: "Always use IntelliJ IDEA for worktrees of this repo", hint: "imports the project and writes .idea/ into the worktree" }],
  "never more than six: the other editors give way to the project folder, Copy path and Look again");
assert.deepEqual(menuItems({ found: {} }), [{ kind: "again", text: "Look for installed editors again" }]);
console.log("editor ok");
