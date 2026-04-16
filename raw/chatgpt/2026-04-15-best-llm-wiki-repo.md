# ChatGPT Share Transcript: Best LLM Wiki Repo

- Source URL: `https://chatgpt.com/share/69e050da-e1f4-83ea-9664-99bbd4aef88d`
- Collected: `2026-04-15`
- Published: `Unknown`
- Capture mode: `browser transcript snapshot`

## Transcript

This is a copy of a conversation between ChatGPT & Anonymous.

Report conversation
You said:
find me the best "second brain" repo created based on andrei karpathy's LLM Wiki concept.

see below my findings related to the topic.
karpathy's orignal tweet: https://x.com/karpathy/status/2039805659525644595?s=20
karpathy's idea in a gist format: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
a supporting tweet: https://x.com/coreyganim/status/2041144598446092411?s=20

You said:
does codex have any plugins that serves as a second brain?

You said:
what about mem

You said:
Uploaded an image
i meant: https://get.mem.ai/

You said:
which one is better, mem or swarmvault?

You said:
what is pkm?

You said:
ok. you suggested swarmvault and i will go with that. you need to teach me how to set it up and use

You said:
before doing anything else, karpathy uses claude code - i assume. i use codex. did you translated everything into codex? and will it work as it works in claude code?

You said:
i do not know what hooks do? so are missing out something by using codex? if yes what?

You said:
codex has automations. could those not take hooks place?

You said:
well, hell no. i want this to be automatic. i cannot spend any energy on that

ChatGPT said:
Then you?re fine.

I need to correct one point: you can still get automatic behavior with Codex.
Not through Codex automations, but through SwarmVault?s own git hooks.

Run:

swarmvault install --agent codex
swarmvault hook install

SwarmVault?s docs say hook install writes post-commit and post-checkout hooks, and those automatically run swarmvault watch --repo --once --code-only after git events.

So:
- automatic repo refresh: yes
- Codex-specific model advisory hooks like Claude: no
- For your ?no manual effort? requirement, this is the right path.

You said:
will it be updating my wiki automatically as well?

ChatGPT said:
Not fully.

The automatic git-hook path runs swarmvault watch --repo --once --code-only after commit/checkout, and the docs explicitly say that code-only refresh updates code pages and graph structure but skips non-code semantic re-analysis; they also say: ?Run a normal swarmvault compile when you also want non-code semantic re-analysis.?

So:
- automatic after git events: yes
- code pages / graph update automatically: yes
- full wiki semantic update automatically: no

That is the gap.

You said:
full wiki semantic update automatically: no what can i do for that?

ChatGPT said:
Two workable paths:

Best

Run a persistent watcher instead of relying only on hooks:

swarmvault watch --repo

watch triggers import and compile cycles when files change, and with --repo it refreshes tracked repo roots too.

Make that command start automatically with Windows Task Scheduler / Startup.

Alternative

Replace SwarmVault?s default git-hook command with a custom one that runs:

swarmvault watch --repo --once
or
swarmvault compile

Default hooks only run --code-only.

For full automatic semantic wiki updates, persistent swarmvault watch --repo is the right answer.
