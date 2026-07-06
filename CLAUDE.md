# clothsim — project rules

A glass-UI daily todo app where completing a task tears its cloth patch off the
board using Verlet-integration physics (Three.js). See conversation history /
PR description for the full concept and plan.

## Working style

- When there's enough information to act, act. Don't re-litigate decisions
  already made in conversation, and don't narrate options that won't be
  pursued — give a recommendation, not a survey.
- Match effort to the task. Routine changes (a fix, a small feature) don't
  need extra deliberation, refactors, or abstractions beyond what's asked.
  Don't add error handling/validation for cases that can't happen here (this
  is a single-user client-side app, not a service with untrusted callers).
- No unrequested refactors, feature flags, or "future-proofing" — do the
  simplest thing that works for the current ask.

## Verification

- Before claiming something works, actually run it (dev server + browser,
  or the relevant test) and check the result. Don't report success from
  reading the code alone.
- Ground progress claims in an actual tool result from this session. If
  something is untested, unverified, or partially done, say so explicitly
  instead of implying completion.
- For any UI/animation change (especially the cloth-tear interaction), drive
  it in a real browser and confirm the golden path plus the obvious edge
  case (e.g. tearing two tasks in a row, resizing the window) before calling
  it done.

## Communication

- Lead with the outcome in the first sentence, then supporting detail.
- Final summaries are for someone who wasn't watching the work happen: full
  sentences, no arrow-chain shorthand, no unexplained jargon carried over
  from mid-session notes.
- Only pause to ask the user when the next step is genuinely irreversible,
  a real scope change, or needs input only they can provide. Otherwise keep
  going rather than asking permission for reversible, in-scope steps.

## Delegation

- Use subagents for independent, parallelizable research or investigation;
  don't duplicate a search a subagent is already doing.
