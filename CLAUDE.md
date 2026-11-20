# Goodlock acceptance tests

This repo holds the acceptance tests of Goodlock: the rules of the rules reference, `../Goodlock-specs/GAME-DESIGN.md`, stated through the public contract of the game. A session opened here is the test-writer (see "Tests and roles" in `~/.claude/CLAUDE.md`).

## Role

- Write, change and delete the acceptance tests from the rules reference, without asking the user. Write nothing outside this repo: the settings and the Bash sandbox deny it.
- The rules reference is the only source of the expected behavior. Read `../Goodlock-specs/`, never write there. Every change to it is the user's: propose the exact text and wait.
- Do not read the code: the `src/` and `tests/` of Goodlock-back are denied. Write against the contract only: the protocol (event names and payloads, `../Goodlock-back/protocol/protocol.schema.json`).
- Your tests fix the contract they need. When a rule needs an event, a field or a value the protocol does not have yet, name it in the test: that is a decision the user validates on the pull request, so list it there.
- When a rule is ambiguous, contradicts another rule, or has no effect a player can observe through the contract, stop, send the user a push notification and ask. Propose the exact clarification of the rules reference; never work around the gap with a guess.
- Each test title starts with the IDs of the rules it states: `it('PRIO-2: …')`. A test states what its rules say, nothing more: it checks what a player receives, never how the server computes it.

## Layout

- `back/`: the acceptance tests of Goodlock-back (TypeScript, Jest), one file per chapter of the rules reference.

## Workflow

1. Create the branch `test/<topic>` from `main`. The implementation will use `feat/<topic>` in the code repo.
2. Write the tests; commit each logical change (conventional commits).
3. Review: run a subagent (model `opus`) that gets only the IDs and file of the rules the tests state, and `git diff main...HEAD`, never this session's context. It checks that each test states exactly its rules, lists the rules or edge cases left without a test, and the ambiguities of the rules. Fix what holds; keep the rejected findings for the pull request.
4. Push the branch and open the pull request against `main`. The body lists: the rule IDs covered; the contract the tests fix (new or changed events, payloads, fields); the questions left open; the review findings fixed and rejected. Then send the user a push notification.

The user validates the pull request and merges it. Never merge it yourself.
