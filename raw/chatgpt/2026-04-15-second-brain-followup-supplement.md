# ChatGPT Supplement: Second Brain Follow-up

- Source URL: `user-supplied supplement in current Codex thread`
- Collected: `2026-04-15`
- Published: `Unknown`
- Capture mode: `manual user quote`

## Transcript

User said:
sure, but i still do not know how to set it up and use. i understand the general purpose of it, but especially how karpathy uses it and how you say that i should use ... that is confusing me.

ChatGPT said:
I?m narrowing this to two things: Karpathy?s actual workflow, and the smallest Codex setup that gives you the same behavior without extra complexity.

The confusing part is that there are two layers of work:

- Setup once
- Run repeatedly

Karpathy?s own use is simple: he keeps an LLM agent open beside Obsidian; the LLM edits a persistent markdown wiki, and he mainly browses the results. In his pattern, raw sources are read-only, the wiki is writable, and the wiki accumulates synthesis over time instead of re-deriving it each time.

For Codex, translate that as:

- AGENTS.md = repo rules for how Codex should maintain the wiki
- .agents/skills/.../SKILL.md = optional reusable workflow
- wiki/ = Codex-written knowledge layer

Codex reads AGENTS.md automatically, and skills are the reusable workflow mechanism.

For game_hub5, I?d use this mental model:

- Live sources: codebase, current docs
- Stable sources: pasted decisions, specs, chat outcomes
- Compiled layer: wiki/

So you do not manually maintain notes. You tell Codex:
?ingest this decision,? ?refresh wiki from current code,? ?update affected pattern pages,? or ?answer from wiki first, then verify against code.? That is the actual usage loop Karpathy is pointing at.
