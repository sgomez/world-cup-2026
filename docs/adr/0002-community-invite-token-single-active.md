# ADR 0002: Community Invite Link Is a Single Rotating Token

**Status:** Accepted  
**Date:** 2026-06-06

Each Community has exactly one active invite token at a time. The Community Owner may regenerate the token, which permanently invalidates the previous one. Anyone who holds the current token URL may join the Community.

## Considered Options

**Single-use tokens per invitee.** The owner generates N tokens, each usable once. Rejected because it requires per-invite tracking, a management UI, and adds friction for the simple friend-group use case this feature targets.

**Permanent non-revocable token.** Simpler still, but gives the owner no recourse if the link leaks. Rejected because removal of leaked-link joiners is cumbersome — regenerating the token is a much cheaper corrective action.

## Consequences

- Schema holds one `inviteToken` field on `Community`. Regeneration is a single field update.
- There is no audit trail of who was invited vs. who found the link. Membership is the only record.
- If the owner regenerates the token, anyone who already joined keeps their membership — only future joins via the old link are blocked.
