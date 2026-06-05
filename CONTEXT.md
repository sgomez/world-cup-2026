# World Cup 2026 Sweepstake — Domain Glossary

## Terms

### User
A registered person on the platform. Identified by email. Authenticated via magic link. Every User has exactly one **Role**.

### Role
The access level of a User. One of three values:
- `user` — default. Can manage their own Bets and profile. Cannot see other users.
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
- `closed` — the User has explicitly locked the Bet. Predictions cannot be edited. Can be re-opened to `draft` before the Bet Deadline.

Status reflects user intent, not time. After the **Bet Deadline**, all write operations on any Bet are blocked regardless of status.

### Bet Deadline
The hard cut-off after which no Bet mutations are permitted: **2026-06-11 19:00 UTC**. Enforced on both client and server. Applies to: create, remove, copy, and edit (predictions + label).

### Bet Limit
Maximum number of Bets a User may hold at once. Configurable via environment variable (`MAX_BETS_PER_USER`), default **3**. Enforced on both client and server at create and copy time.

### Bet Copy
Creating a new Bet in `draft` status pre-populated with all predictions and the label of an existing Bet. The new Bet's label is prefixed with `"Copy of "`. If the resulting label exceeds 200 characters, it is truncated to fit.

### Profile
A User's public-facing identity: `name` and optional `image`. A User may edit their own Profile (name and image only; email is immutable). Admins and super_admins may view any User's Profile together with their Bet list.
