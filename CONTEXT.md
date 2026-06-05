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
A named tournament bracket prediction created by a User. A User may hold many Bets. Each Bet has a user-given **label** and system-managed timestamps (`createdAt`, `updatedAt`). A Bet contains two kinds of prediction:
- **Group Prediction**: the user's predicted finishing order for each of the 12 groups, and their ranked ordering of the 12 third-place teams (determining which eight advance).
- **Knockout Prediction**: the user's selected winner for each match in the knockout bracket, stored as a sparse map of match ID to team ID. Winners propagate forward through the bracket and are cascade-cleared when a group prediction change invalidates them.

### Profile
A User's public-facing identity: `name` and optional `image`. A User may edit their own Profile (name and image only; email is immutable). Admins and super_admins may view any User's Profile together with their Bet list.
