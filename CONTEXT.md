# World Cup 2026 Sweepstake — Domain Glossary

## Terms

### User
A registered person on the platform. Identified by email. Authenticated via magic link. Every User has exactly one **Role**.

### Role
The access level of a User. One of three values:
- `user` — default. Can manage their own Bets and profile. Cannot see other users, except within shared Communities: may see the Member List at any time, and other Members' Bets after the Bet Deadline.
- `admin` — elevated. Can view all User profiles and Bets. Can grant or revoke the `admin` role on other Users. Cannot demote themselves.
- `super_admin` — permanent owner. Assigned to the first User who registers on the platform. Has all `admin` privileges. Cannot be demoted by anyone, including other `super_admin`s.

Only one `super_admin` exists at any time (the first registrant). All other elevated users hold `admin`.

### Bet
A named tournament bracket prediction created by a User. A User may hold many Bets. Each Bet has a user-given **label**, a **status**, and system-managed timestamps (`createdAt`, `updatedAt`). A Bet contains two kinds of prediction:
- **Group Prediction**: the user's predicted finishing order for each of the 12 groups, and their ranked ordering of the 12 third-place teams (determining which eight advance).
- **Knockout Prediction**: the user's selected winner for each match in the knockout bracket, stored as a sparse map of match ID to team ID. Winners propagate forward through the bracket and are cascade-cleared when a group prediction change invalidates them.

### Bet Status
The user-intent state of a Bet. One of two values:
- `draft` — the Bet is being worked on. Predictions can be edited.
- `closed` — the User has explicitly locked the Bet. A Bet can only transition to `closed` once predictions for all matches (including all group standings and all 32 knockout matches) are complete. Once closed, predictions cannot be edited. Can be re-opened to `draft` before the Bet Deadline.

Status reflects user intent, not time. After the **Bet Deadline**, all write operations on any Bet are blocked regardless of status.

### Bet Deadline
The hard cut-off after which no Bet mutations are permitted: **2026-06-11 19:00 UTC**. Enforced on both client and server. Applies to: create, remove, copy, and edit (predictions + label).

### Bet Limit
Maximum number of Bets a User may hold at once. Configurable via environment variable (`MAX_BETS_PER_USER`), default **3**. Enforced on both client and server at create and copy time.

### Bet Copy
Creating a new Bet in `draft` status pre-populated with all predictions and the label of an existing Bet. The new Bet's label is prefixed with `"Copy of "`. If the resulting label exceeds 200 characters, it is truncated to fit.

### Bet Signature
A deterministic fingerprint of a **closed** Bet's *scoreable content* — the only data that affects its score. Two Bets with identical scoreable content always have identical Signatures, regardless of group-stage arrangement; conversely, any change that would change the score changes the Signature. The scoreable content is the set of teams reaching each knockout round (Round of 32, Round of 16, Quarter-finals, Semi-finals, Final), plus the predicted **Champion** and the predicted **third-place winner**. Group standings and individual match-ups are *not* part of it — only which teams reach each round. The Signature is derived data: it is always computed from the prediction and never stored. It is shown only for `closed` Bets (a draft has none). The Signature serves as a public commitment: it can be shown before the Bet Deadline (alongside the Bet's label and owner) without revealing the prediction, and verified against the revealed Bet afterwards.

### Profile
A User's public-facing identity: `name` and optional `image`. A User may edit their own Profile (name and image only; email is immutable). Admins and super_admins may view any User's Profile together with their Bet list.

### Community
A named group of Users created by one User (the **Community Owner**). Identified by a unique **slug** derived from its name at creation time. A User may belong to many Communities. Communities exist to let members compare predictions after the competition begins. Admins and super_admins may view all Communities (member lists and owner) via the admin panel.

### Community Owner
The User who created a Community. The Owner may invite new members (via an **Invite Link**), remove existing members, and delete the Community. Ownership is not transferable. The Owner cannot leave a Community — to exit, they must delete it.

### Community Member
A User who has joined a Community. Within a Community, Members can see the **Member List** at any time. Members can see each other's full Bet predictions only **after the Bet Deadline** (2026-06-11 19:00 UTC). Before the deadline, a Member's predictions are invisible to other Members; however, the label, owner, and **Bet Signature** of each *closed* Bet are visible to fellow Members before the deadline (a public commitment without revealing the prediction). Draft Bets remain fully hidden until the deadline.

### Member List
The list of Users belonging to a Community. Visible to all Members of that Community at any time.

### Invite Link
A URL containing a single-token secret generated by the Community Owner. Anyone with the link may join the Community. Only one active Invite Link exists per Community at a time. The Owner may regenerate the Invite Link at any time, which permanently invalidates the previous one.

### Leaderboard *(future)*
A ranked list of Community Members ordered by prediction accuracy score within a Community. Not implemented in the current iteration.
