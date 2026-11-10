// Demo only: a Go to provider for the screenshots (RECIPE.md, "Demo"). It gives the demo agents titles and
// topics (goto.items.demo), claims PR links (goto.handlers.demo), and passes demo/run/control/query.txt on as
// the shared "goto.demo.query", which types into an open Go to box. Nothing here talks to the network.

import { View, div } from "gpui-kit";
import { agents, spaces, shared, setShared, appHome, readTextFile, watchFolder } from "herdr";

const PR = "https://github.com/acme/bookshelf/pull/7";
// Tab name -> what a session provider would publish about the agent in it.
const TOPICS = {
  reminders: { title: "Add due-date reminders", keywords: [PR, "feat/due-reminders"],
    text: "Mail the borrower a reminder two days before a loan is due · the reminder job runs in the nightly scheduler" },
  login: { title: "Fix login redirect", keywords: ["acme/orbit-sync"],
    text: "After sign-in the app lands on /undefined instead of the page you came from · keep the return path in the OAuth state" },
  export: { title: "Export invoices as CSV", keywords: ["acme/ledger"],
    text: "Monthly invoice export for the accountant · one CSV per month, semicolon separated" },
};

export default class GotoDemo extends View {
  init(_props, cx) {
    const p = shared("goto.providers") ?? [];
    if (!p.includes("demo")) setShared("goto.providers", [...p, "demo"]);
    setShared("goto.handlers.demo", [{
      pattern: "github\\.com/([\\w.-]+)/([\\w.-]+)/pull/(\\d+)",
      title: "Review PR #{number} · {title}",
      subtitle: "{owner}/{repo} · {head} → {base}",
      run: [["goto.set", { key: "demo.review", value: "{url}" }]],
    }]);
    this.publish();
    cx.timer.every(1000, () => this.publish());
    const dir = `${appHome()}/control`;
    const read = async () => setShared("goto.demo.query", ((await readTextFile(`${dir}/query.txt`).catch(() => null)) ?? "").replace(/\n$/, ""));
    cx.spawn(async () => { await read(); for (;;) { await watchFolder(dir); await read(); } });
  }

  publish() {
    const tabs = new Map(spaces().flatMap((s) => s.tabs.map((t) => [t.id, t.name])));
    const items = agents().flatMap((a) => {
      const topic = TOPICS[tabs.get(a.tab)];
      return topic ? [{ id: a.address, focus: { terminal: a.address }, ...topic }] : [];
    });
    if (JSON.stringify(items) !== JSON.stringify(shared("goto.items.demo"))) setShared("goto.items.demo", items);
  }

  render() {
    return div();
  }
}
