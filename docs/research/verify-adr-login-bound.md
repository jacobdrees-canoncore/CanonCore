# How self-hosted media and photo servers bound repeated wrong-password guesses

Every claim here is checked against the source that owns it: the project's own repository at a named
tag, its own documentation repository, its own issue tracker and discussion threads. No blog post, no
secondary summary, nothing from memory. Where a lookup failed, the verdict is UNFOUND and the gap is
left open rather than filled.

**Section 7 at the end is the summary**: one table per product, and the five architecture questions
answered directly.

Verdicts used:

- **CONFIRMED** — the owner's own source says this, with the citation given.
- **CONTRADICTED** — the owner's own source says something materially different.
- **UNFOUNDED** — no source was found in this run that supports it.
- **UNFOUND** — a lookup was attempted for it in this run and returned nothing either way.
- **JUDGEMENT** — a reading of the code, not a sentence the owner wrote.

Run date: **2026-09-12**. Versions read, all resolved on the run date:

| Project | Tag read | Published |
| --- | --- | --- |
| `jellyfin/jellyfin` | `v12.0` | 2026-09-08T01:38:39Z |
| `advplyr/audiobookshelf` | `v2.36.0` | 2026-07-27T22:59:30Z |
| `immich-app/immich` | `v3.2.0` | 2026-09-10T16:00:52Z |
| `nextcloud/server` | `v32.0.15` | 2026-09-10T13:54:33Z |

(`gh api repos/<repo>/releases/latest`, all four 2026-09-12.)

---

## 1. Jellyfin — a per-account lockout that DISABLES the account, stored in the database

Repository `jellyfin/jellyfin`, tag `v12.0`. Documentation repository `jellyfin/jellyfin.org`,
default branch. Web client `jellyfin/jellyfin-web`, default branch. All lookups 2026-09-12.

### 1.1 What happens on a failed login

**CONFIRMED.** The whole bound lives in one `else` branch of
`Jellyfin.Server.Implementations/Users/UserManager.cs`, in `AuthenticateUser`
(`gh api repos/jellyfin/jellyfin/contents/Jellyfin.Server.Implementations/Users/UserManager.cs?ref=v12.0`),
lines 678-700:

```csharp
else
{
    user.InvalidLoginAttemptCount++;
    int? maxInvalidLogins = user.LoginAttemptsBeforeLockout;
    if (maxInvalidLogins.HasValue && user.InvalidLoginAttemptCount >= maxInvalidLogins)
    {
        user.SetPermission(PermissionKind.IsDisabled, true);
        dbContext.Update(user);
        await dbContext.SaveChangesAsync()
            .ConfigureAwait(false);
        await _eventManager.PublishAsync(new UserLockedOutEventArgs(user)).ConfigureAwait(false);
        _logger.LogWarning(
            "Disabling user {Username} due to {Attempts} unsuccessful login attempts.",
            user.Username,
            user.InvalidLoginAttemptCount);
    }

    await dbContext.Users
        .Where(e => e.Id == user.Id)
        .ExecuteUpdateAsync(e => e.SetProperty(f => f.InvalidLoginAttemptCount, f => f.InvalidLoginAttemptCount + 1))
        .ConfigureAwait(false);

    _logger.LogInformation(
        "Authentication request for {UserName} has been denied (IP: {IP}).",
        user.Username,
        remoteEndPoint);
}
```

There is no delay, no 429 and no per-request penalty. The lockout is a **state change on the account**:
`PermissionKind.IsDisabled` is set to true, permanently, until something clears it. The next attempt —
right password or wrong — is refused earlier in the same method, at lines 622-630:

```csharp
if (user.HasPermission(PermissionKind.IsDisabled))
{
    _logger.LogInformation(
        "Authentication request for {UserName} has been denied because this account is currently disabled (IP: {IP}).",
        username,
        remoteEndPoint);
    throw new SecurityException(
        $"The {user.Username} account is currently disabled. Please consult with your administrator.");
}
```

### 1.2 Where the count is stored, and whether success resets it

**CONFIRMED: the database, and yes.**

Both numbers are columns on the `Users` table in `jellyfin.db`.
`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/User.cs` at `v12.0`:

```csharp
public int InvalidLoginAttemptCount { get; set; }
...
public int? LoginAttemptsBeforeLockout { get; set; }
```

and the EF model snapshot
(`src/Jellyfin.Database/Jellyfin.Database.Providers.Sqlite/Migrations/JellyfinDbModelSnapshot.cs`)
declares them as `b.Property<int>("InvalidLoginAttemptCount").HasColumnType("INTEGER")` and
`b.Property<int?>("LoginAttemptsBeforeLockout").HasColumnType("INTEGER")` — **no default value on
either**. The lockout flag itself is a row in the `Permissions` table with `Kind = 2`
(`Jellyfin.Database.Implementations/Enums/PermissionKind.cs`: `IsDisabled = 2`).

Nothing here is in memory. A restart does not lift a Jellyfin lockout.

Reset on success, `UserManager.cs` lines 671-676:

```csharp
await dbContext.Users
    .Where(e => e.Id == user.Id)
    .ExecuteUpdateAsync(e => e.SetProperty(f => f.InvalidLoginAttemptCount, 0))
    .ConfigureAwait(false);
_logger.LogInformation("Authentication request for {UserName} has succeeded.", user.Username);
```

A correct password zeroes the counter. But note the ordering: the disabled check at line 622 runs
**before** the password is even evaluated, so once the account is disabled no correct password can
reach the reset.

### 1.3 The default for an ADMINISTRATOR versus a normal user

**CONTRADICTED.** Jellyfin's own documentation and its own web client both say the default is three
tries for a normal user and five for an administrator. The server has no such branch: it maps to
**3 for everybody**, and the number 5 does not appear on this code path in any version checked.

The documentation, `jellyfin/jellyfin.org`, `docs/general/server/users/adding-managing-users.md`,
under "Locking and Unlocking users":

> `Failed login attempts before user is locked out` Determines how many incorrect login attempts can
> be made before lockout occurs, disabling the user. 0 means inheriting the default of 3 for non-admin
> and 5 for admin, -1 disables lockout

The web client string, `jellyfin/jellyfin-web`, `src/strings/en-us.json`:

```json
"OptionLoginAttemptsBeforeLockoutHelp": "A value of zero means inheriting the default of three tries for normal users and five for administrators. Setting this to -1 will disable the feature."
```

The server, `UserManager.UpdatePolicyAsync` at `v12.0` (lines 859-865), with its own comment:

```csharp
// The default number of login attempts is 3, but for some god forsaken reason it's sent to the server as "0"
int? maxLoginAttempts = policy.LoginAttemptsBeforeLockout switch
{
    -1 => null,
    0 => 3,
    _ => policy.LoginAttemptsBeforeLockout
};
```

The same three-arm switch, with the same `0 => 3`, is in `v10.11.11` (line 816), in `v10.8.0`
(line 637) and in the user-database migration routine
`Jellyfin.Server/Migrations/Routines/20250420100000_MigrateUserDb.cs` (line 115) at `v12.0`. No arm
anywhere consults `PermissionKind.IsAdministrator`, and
`gh search code --repo jellyfin/jellyfin "IsAdministrator 5 LoginAttempts"` returns nothing.

**A second and larger correction, JUDGEMENT.** The out-of-the-box default is not 3 either — it is
**no lockout at all**. `User`'s constructor sets `InvalidLoginAttemptCount = 0` and never touches
`LoginAttemptsBeforeLockout`, the column is nullable with no database default, and the guard is
`if (maxInvalidLogins.HasValue && ...)`. A user created by `CreateUserInternalAsync` therefore has
`LoginAttemptsBeforeLockout = NULL` and cannot be locked out. The `0 => 3` mapping only ever runs
inside `UpdatePolicyAsync` — that is, when an administrator saves a user policy, or when a pre-existing
user is carried across by the migration routine. Consistently, `GetUserDto` reports the absent value
to the client as `-1`:

```csharp
LoginAttemptsBeforeLockout = user.LoginAttemptsBeforeLockout ?? -1,
```

(`UserManager.cs` line 495) and `-1` is the UI's "disabled". So on a fresh install the feature is off
until somebody turns it on.

**A third observation, JUDGEMENT.** On the attempt that trips the lockout, the stored count is
incremented twice. `UserQuery` ends `.AsNoTracking()` (`UserManager.cs` lines 135-144), so
`user.InvalidLoginAttemptCount++` mutates a detached entity; the lockout branch then calls
`dbContext.Update(user)` and `SaveChangesAsync()`, which writes the whole row including that
incremented count, and the unconditional `ExecuteUpdateAsync(... + 1)` immediately afterwards adds
another one. The lockout decision itself is unaffected (it is made on the in-memory value) and the
log line prints the right number; only the persisted counter overshoots by one.

### 1.4 Can a locked-out administrator unlock themselves?

**CONFIRMED: no.** `PermissionKind.IsDisabled` is written in exactly two places in `UserManager.cs`:
set to `true` by the lockout branch (line 684), and set to `policy.IsDisabled` by `UpdatePolicyAsync`
(line 880). `UpdatePolicyAsync` is reached only from
`Jellyfin.Api/Controllers/UserController.cs`, `UpdateUserPolicy`:

```csharp
[HttpPost("{userId}/Policy")]
[Authorize(Policy = Policies.RequiresElevation)]
```

which requires an already-authenticated administrator. The password-reset path does not help:
`DefaultPasswordResetProvider.StartForgotPasswordProcess` writes a PIN file and only when
`isInNetwork`, and redeeming it changes the password — nothing on that path clears `IsDisabled` or
zeroes `InvalidLoginAttemptCount`.

There is a guard rail in the same controller, and the lockout path walks straight past it:

```csharp
// If disabling
if (newPolicy.IsDisabled && user.HasPermission(PermissionKind.IsAdministrator))
{
    return StatusCode(StatusCodes.Status403Forbidden, "Administrators cannot be disabled.");
}
```

An administrator cannot be disabled *by another administrator through the API*. The lockout in
`UserManager` calls `SetPermission` directly and never passes through this controller, so it can and
does disable an administrator.

### 1.5 What the project tells a locked-out administrator to do

**CONFIRMED: edit the SQLite database by hand.** `jellyfin/jellyfin.org`,
`docs/general/administration/troubleshooting.md`, section "Unlock locked user account":

> When the admin account is locked out and the Forgot Password feature is not working, you have to
> unlock the user manually. To do that, you need to find the `jellyfin.db` file on your system. The
> default location on Linux is: `/var/lib/jellyfin/data/`.

and the remedy itself:

```sql
UPDATE Users SET InvalidLoginAttemptCount = 0 WHERE Username = 'LockedUserName';
UPDATE Permissions SET Value = 0 WHERE Kind = 2 AND UserId IN (SELECT Id FROM Users WHERE Username = 'LockedUserName');
```

`Kind = 2` is `IsDisabled`, as above. The page offers the same two statements through SQLiteBrowser
for desktop users. There is no CLI subcommand and no configuration-file escape: the documented route
is a raw write to the database.

### 1.6 Per-IP or per-request rate limiting

**CONFIRMED: none. The bound is entirely per-account.**

- `Directory.Packages.props` at `v12.0` contains no rate-limiting or throttling package
  (`grep -i "ratelimit\|Throttl"` → no match).
- `gh search code --repo jellyfin/jellyfin` for `AddRateLimiter`, `UseRateLimiter` and
  `EnableRateLimiting` — ASP.NET Core's own built-in middleware — returns **zero** results for each.
- The only `RateLimit` identifiers in the codebase are `RateLimitExceededException` (used by the
  MusicBrainz and ListenBrainz metadata providers, i.e. outbound) and
  `UserPolicy.RemoteClientBitrateLimit`.

Two adjacent controls exist and are not rate limits: `PermissionKind.EnableRemoteAccess` refuses a
user outside the local network outright, and `UserPolicy.MaxActiveSessions` caps concurrent sessions.

### 1.7 What an operator can see

**CONFIRMED, three things.**

1. **An activity-log row on lockout, and only on lockout.**
   `Jellyfin.Server.Implementations/Events/Consumers/Users/UserLockedOutLogger.cs` consumes
   `UserLockedOutEventArgs` and calls `_activityManager.CreateAsync(new ActivityLog(...)) { LogSeverity = LogLevel.Error }`
   with the localized string `UserLockedOutWithName`, which in
   `Emby.Server.Implementations/Localization/Core/en-US.json` is `"User {0} has been locked out"`.
   Individual refusals get no activity row; only `AuthenticationSucceededWithUserName`
   (`"{0} successfully authenticated"`) exists for the success side.

2. **A log line per refusal, at Information.** The message template is
   `"Authentication request for {UserName} has been denied (IP: {IP})."` The file sink's output
   template in `Jellyfin.Server/Resources/Configuration/logging.json` is
   `[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz}] [{Level:u3}] [{ThreadId}] {SourceContext}: {Message}{NewLine}{Exception}`
   — `{Message}` without the `:lj` flags the console sink uses, so Serilog renders the string property
   with quotes in the file. That is why the project's own fail2ban filter expects quotes.

3. **A fail2ban recipe the project ships itself.**
   `docs/general/post-install/networking/9_advanced/fail2ban.md`:

   ```
   [Definition]
   failregex = ^.*Authentication request for .* has been denied \(IP: "<ADDR>"\)\.
   ```

   with the jail it recommends:

   ```
   [jellyfin]
   backend = auto
   enabled = true
   port = 80,443
   protocol = tcp
   filter = jellyfin
   maxretry = 3
   bantime = 86400
   findtime = 43200
   logpath = /path_to_logs/log_*.log
   ```

   and a prerequisite worth carrying: "Jellyfin log level set to `Info` (failed authentication entries
   are not logged at `Error`)."

---

## 2. Audiobookshelf — a per-IP request rate limiter, in memory, no account state at all

Repository `advplyr/audiobookshelf`, tag `v2.36.0`. Documentation repository
`audiobookshelf/audiobookshelf-docs`, default branch. All lookups 2026-09-12.

### 2.1 Is there a rate limiter on the login route?

**CONFIRMED.** `server/Auth.js` at `v2.36.0`, line 320:

```js
router.post('/login', this.authRateLimiter, passport.authenticate('local'), async (req, res) => {
```

`this.authRateLimiter` is built once in the constructor (line 24) from
`RateLimiterFactory.getAuthRateLimiter()`.

The same single limiter instance also guards `POST /auth/refresh` (line 329), `GET /auth/openid`
(line 360), `GET /auth/openid/mobile-redirect` (line 378), the OpenID callback (line 383),
`GET /auth/openid/config` (line 456), and — from `server/routers/ApiRouter.js` line 190 —
`PATCH /api/me/password`. One instance means **one shared counter per IP across all seven routes**.

### 2.2 Library, window, maximum, keying

**CONFIRMED, all four.** `server/utils/rateLimiterFactory.js` at `v2.36.0`, in full at the top:

```js
const { rateLimit, RateLimitRequestHandler } = require('express-rate-limit')
...
class RateLimiterFactory {
  static DEFAULT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
  static DEFAULT_MAX = 40 // 40 attempts
```

and the key:

```js
keyGenerator: (req) => {
  // Override keyGenerator to handle proxy IPs
  return requestIp.getClientIp(req) || req.ip
},
```

- Library: **`express-rate-limit`**, pinned at **7.5.1** in `package-lock.json` at `v2.36.0`
  (`node_modules/express-rate-limit 7.5.1`); `package.json` declares `"express-rate-limit": "^7.5.1"`.
- Window: **600000 ms (10 minutes)**.
- Maximum: **40** requests per window.
- Keyed **per client IP**, resolved through the bundled `requestIp` helper so an upstream proxy's
  `X-Forwarded-For` is honoured rather than the socket address. Not global, not per account.

### 2.3 Configurable by environment variable

**CONFIRMED, three variables, two of them documented.** From the same file:

```js
// Disable by setting max to 0
if (process.env.RATE_LIMIT_AUTH_MAX === '0') { ... next() ... }
...
if (parseInt(process.env.RATE_LIMIT_AUTH_WINDOW) > 0) { windowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW) }
...
if (parseInt(process.env.RATE_LIMIT_AUTH_MAX) > 0) { max = parseInt(process.env.RATE_LIMIT_AUTH_MAX) }
...
let message = 'Too many authentication requests'
if (process.env.RATE_LIMIT_AUTH_MESSAGE) { message = process.env.RATE_LIMIT_AUTH_MESSAGE }
```

The documentation, `audiobookshelf/audiobookshelf-docs`,
`docs/documentation/install/11.env-configuration.md`, under "Security":

| Variable | Default | Description |
| --- | --- | --- |
| `RATE_LIMIT_AUTH_WINDOW` | `600000` | Rate limiting window in milliseconds |
| `RATE_LIMIT_AUTH_MAX` | `40` | Maximum auth attempts per window. Use 0 to disable |

**`RATE_LIMIT_AUTH_MESSAGE` is not documented** — it exists in the code and appears nowhere in the
docs repository (`gh search code --repo audiobookshelf/audiobookshelf-docs "RATE_LIMIT_AUTH"` returns
only this one page).

Setting `RATE_LIMIT_AUTH_MAX=0` replaces the middleware with `(req, res, next) => next()` and logs
`[RateLimiterFactory] Authentication rate limiting disabled by ENV variable`. Audiobookshelf can
therefore be run with **no bound whatsoever**, by one environment variable.

### 2.4 What an over-limit caller gets back

**CONFIRMED.** From the handler in `rateLimiterFactory.js`:

```js
res.status(429).json({
  error: message
})
```

**HTTP 429**, body `{"error":"Too many authentication requests"}` unless `RATE_LIMIT_AUTH_MESSAGE`
overrides the string. `standardHeaders: true, legacyHeaders: false` is set, which in
express-rate-limit 7.5.1 resolves to `draft-6` (`source/lib.ts`: "The default value for the
`standardHeaders` option is `false`. If set to `true`, it resolve to `draft-6`"), so `RateLimit-*`
headers accompany every response on these routes.

### 2.5 Does a SUCCESSFUL login skip or reset the counter?

**CONFIRMED: no, on both halves.** This is the sharpest difference from Jellyfin.

The middleware is mounted **before** `passport.authenticate('local')`, so it increments on every
request that reaches the route, regardless of outcome. express-rate-limit would only undo that if
`skipSuccessfulRequests` were set; `source/lib.ts` at `v7.5.1` gives the defaults:

```ts
requestPropertyName: 'rateLimit',
skipFailedRequests: false,
skipSuccessfulRequests: false,
```

and `rateLimiterFactory.js` sets neither. Nor is there any manual reset: `gh search code --repo
advplyr/audiobookshelf "resetKey"` returns **zero** results.

So Audiobookshelf bounds **attempts**, not refusals. Forty logins in ten minutes from one IP — even
forty correct ones — and the forty-first is refused with 429.

### 2.6 There is no per-account bound

**CONFIRMED.** `server/auth/LocalAuthStrategy.js` at `v2.36.0` is the entire local-password path.
`verifyCredentials` loads the user, compares with bcrypt, and on failure calls
`logFailedLoginAttempt` and `done(null, null)`. No counter is read, written or stored; there is no
`isLocked`, no `failedAttempts`, no lockout column on the user model.

A vestige of an earlier design survives in the settings object.
`server/objects/settings/ServerSettings.js` declares, under a `// Security/Rate limits` comment:

```js
this.rateLimitLoginRequests = 10
this.rateLimitLoginWindow = 10 * 60 * 1000 // 10 Minutes
```

persists both and returns both from `toJSON()`. **Nothing reads them**:
`gh search code --repo advplyr/audiobookshelf "rateLimitLoginRequests"` returns exactly one file,
`ServerSettings.js` itself. An operator who sets these in the server settings changes nothing.

### 2.7 Where the state lives, and what an operator can see

**Storage: in memory, lost on restart. CONFIRMED.** No `store` option is passed, so
express-rate-limit 7.5.1 uses its default `MemoryStore`, whose own source
(`source/memory-store.ts` at `v7.5.1`) is two JavaScript Maps in the process:

```ts
previous = new Map<string, Client>()
current = new Map<string, Client>()
```

Restart the container and every IP's count is zero again.

**Refused attempts are logged, twice over. CONFIRMED.**

Per refusal, at ERROR, `server/auth/LocalAuthStrategy.js`:

```js
Logger.error(`[LocalAuth] Failed login attempt for username "${username}" from ip ${requestIp.getClientIp(req)} (${message})`)
```

The parenthesised reason is one of `'User not found'`, `'User is not active'`, `'Invalid password'`,
`'Root user has no password set'`, or
`'User has no password set. Might have been created with OpenID'` — which means the log
distinguishes a wrong password from an unknown username even though the HTTP response does not.

Per rate-limit trip, at WARN, `rateLimiterFactory.js`:

```js
Logger.warn(`[RateLimiter] Rate limit exceeded - IP: ${ip}, Endpoint: ${method} ${endpoint}, User-Agent: ${userAgent}`)
```

There is no table and no UI surface for either.

### 2.8 When this landed

**CONFIRMED.** `gh api "repos/advplyr/audiobookshelf/commits?path=server/utils/rateLimiterFactory.js"`:

- `ac381854` 2025-07-07T21:23:15Z — "Add rate limiter for auth endpoints"
- `f081a7fd` 2025-07-12T15:32:35Z — "Update rate limiter to use requestIp as key, pass in configurable error message"
- `030e43f3` 2025-07-12T15:51:07Z — "Support disabled rate limiter by setting max to 0, add logs when rate limit is changed from default"

It shipped in `v2.26.0` (published 2025-07-12T19:31:21Z), whose release body lists:

> - Rate limiter for authentication endpoints (See #4460) (in #4444)

i.e. it arrived as part of the same JWT-auth rewrite covered in `verify-adr-products.md` §1.2, not as
a response to an incident.

---

## 3. Immich — no bound in the application at all, by maintainer decision

Repository `immich-app/immich`, tag `v3.2.0`. All lookups 2026-09-12.

### 3.1 Does the server bound login attempts?

**CONFIRMED: no.** `server/src/services/auth.service.ts` at `v3.2.0`, the whole of `login`:

```ts
async login(dto: LoginCredentialDto, details: LoginDetails) {
  const config = await this.getConfig({ withCache: false });
  if (!config.passwordLogin.enabled) {
    throw new UnauthorizedException('Password login has been disabled');
  }

  const user = await this.userRepository.getByEmail(dto.email, { withPassword: true });
  // Always run bcrypt so response time is constant regardless of whether the email
  // is registered, preventing timing-based user enumeration.
  const isAuthenticated = this.cryptoRepository.compareBcrypt(dto.password, user?.password ?? LOGIN_DUMMY_HASH);

  if (!user || !user.password || !isAuthenticated) {
    this.logger.warn(`Failed login attempt for user ${dto.email} from ip address ${details.clientIp}`);
    throw new UnauthorizedException('Incorrect email or password');
  }

  return this.createLoginResponse(user, details);
}
```

No counter, no delay, no state. Immich does do one thing carefully — the constant-time bcrypt against
`LOGIN_DUMMY_HASH` to close user enumeration — but the guess rate is unbounded.

The controller confirms there is no guard.
`server/src/controllers/auth.controller.ts`:

```ts
@Post('login')
@Endpoint({ summary: 'Login', ... })
@Authenticated({ public: true })
async login(...)
```

`@Authenticated({ public: true })` is the only decorator; there is no throttling attribute.

Corroborating negatives, all run 2026-09-12:

- `server/package.json` at `v3.2.0` has no `@nestjs/throttler`, no `express-rate-limit`, no
  `rate-limiter-flexible` — the `@nestjs/*` dependencies are `bullmq, common, core, platform-express,
  platform-socket.io, schedule, swagger, websockets` only.
- `gh search code --repo immich-app/immich` for `ThrottlerGuard`, `express-rate-limit`,
  `rate-limiter-flexible`, `bruteforce` and `TooManyRequests` returns **zero** results for each.
  A search for `Throttle` matches only `docs/docs/administration/jobs-workers.md`, two
  front-end timeline files and an Android changelog.
- `server/src/middleware/` contains eight files — `asset-upload.interceptor.ts`, `auth.guard.ts`,
  `auth.guard.spec.ts`, `error.interceptor.ts`, `file-upload.interceptor.ts`,
  `global-exception.filter.ts`, `logging.interceptor.ts`, `websocket.adapter.ts` — none of them a
  rate limiter.
- The PIN-code path is unbounded too: `validatePinCode` in the same service simply throws
  `new BadRequestException('Wrong PIN code')` with no counter.

The best independent measurement is the reporter's own, on discussion #21165 (2025-08-22):

> As it stands, I can attempt to login to my instance, using the same email address & IP address,
> thousands of times a minute, with no 429 response or lockout, after which a correct email +
> password combination result in a valid session being created.

### 3.2 The maintainers' stated position

**CONFIRMED, three statements, all from repository members.**

**PR #23892**, "implements several security enhancement", opened 2025-11-14T11:51:26Z by
`LuckyCoders`. Its body proposes exactly the missing control:

> **HTTP Headers & Rate Limiting**: Integrates `helmet` for essential security headers (e.g., HSTS,
> referrer policy) and `express-rate-limit` to prevent brute-force attacks on the global API and
> stricter limits for login/OAuth endpoints.

It was closed unmerged at 2025-11-14T11:58:57Z — **seven and a half minutes later** — by `bo0tzz`
(MEMBER), with:

> These things should mostly be handled on the reverse proxy side or with a tool like fail2ban.
> @LuckyCoders please discuss with us before opening any more of these LLM-generated PRs.

`"merged": false`. https://github.com/immich-app/immich/pull/23892

**Discussion #18861**, "[Feature] User lock out for 5 minutes if more than 3 login failures are
detected within 5 minutes", Feature Request category, opened 2025-06-02T…, closed the same day at
2025-06-02T12:45:14Z with `stateReason: RESOLVED`. The only reply, from `bo0tzz` (MEMBER):

> You can handle this with tools like fail2ban.

https://github.com/immich-app/immich/discussions/18861

**Discussion #21165**, "[Feature] Implement rate limiting for login", opened 2025-08-22, closed
2025-08-22T23:55:42Z with `stateReason: DUPLICATE`. `bo0tzz` (MEMBER), 2025-08-23:

> It absolutely is a duplicate, as recently as yesterday (#21132). Dupe of #18861.

https://github.com/immich-app/immich/discussions/21165

So the request is neither open nor unanswered: it is closed, twice, with one consistent answer —
**the operator's reverse proxy or fail2ban, not the application**.

A fourth thread bears on the practicality of that answer. **Discussion #18174**, "[Feature] Easily
accessible log file for fail2ban" (2025-05-09, closed RESOLVED the same day) asks for a log file on
the host so fail2ban can read it. `danieldietzler` (MEMBER):

> By writing to stdout we let docker do the log handling, which offers much more flexibility. For an
> overview of which drivers you can use with docker out of the box, check out
> https://docs.docker.com/engine/logging/configure/#supported-logging-drivers :)

Immich logs to stdout only; the fail2ban plumbing is entirely the operator's problem.

### 3.3 What the documentation tells operators to do instead

**CONFIRMED for the remote-access stance; UNFOUND for any rate-limiting or fail2ban guidance.**

`docs/docs/guides/remote-access.md` at `v3.2.0` is the page that covers exposure, and it opens:

> :::danger
> Never forward port 2283 directly to the internet without additional configuration. This will expose
> the web interface via http to the internet, making you susceptible to man in the middle attacks.
> :::

It then gives three options in this order — **Option 1: VPN to home network** (Wireguard/OpenVPN),
**Option 2: Tailscale**, **Option 3: Reverse Proxy** (nginx plus Let's Encrypt, with Cloudflare named
for hiding the origin and Cloudflare Access named under Pros: "it is possible to set up access
controls that shield you from zero-day vulnerabilities on Immich. Cloudflare Access has a generous
free tier"). The page's closing Con is the project's own assessment:

> Depending on your configuration, both the Immich web interface and API may be exposed to the
> internet. Immich is under very active development and the existence of severe security
> vulnerabilities cannot be ruled out.

What is **not** there: the word fail2ban appears nowhere in the documentation
(`gh search code --repo immich-app/immich fail2ban` → 0 results), there is no rate-limiting guidance
in `docs/docs/administration/reverse-proxy.md`, and `SECURITY.md` does not exist at `v3.2.0`
(the contents API returns nothing for it). The fail2ban answer lives in maintainer replies on the
tracker, not in the manual.

### 3.4 What an operator can see

**CONFIRMED: one stdout log line, and nothing else.**

The line is the `logger.warn` quoted in §3.1:
`Failed login attempt for user ${dto.email} from ip address ${details.clientIp}`. It carries the
attempted **email** and the client IP, so a fail2ban filter is writable against it.

`server/src/repositories/logging.repository.ts` shows the rendering is NestJS's `ConsoleLogger` with
an Immich-specific context prefix (`MyConsoleLogger.formatContext` builds `[appName:context~correlationId]`),
optionally JSON (`options?.json`). There is no file sink.

There is no table behind it. `server/src/schema/tables` at `v3.2.0` lists no auth-attempt,
login-history or security-audit table; the `*-audit.table.ts` files (`asset-audit`, `album-audit`,
`user-audit`, …) are the sync-deletion audit tables for the mobile sync protocol, not a security log.
There is no admin UI showing failed logins.

---

## 4. Nextcloud — delay rather than lockout, keyed by IP subnet, in the database

Repository `nextcloud/server`, default branch at `v32.0.15`. All lookups 2026-09-12. This section is
the optional comparison and was kept to what the owner's code says.

### 4.1 The mechanism

**CONFIRMED.** `lib/private/Security/Bruteforce/Throttler.php`, class docblock:

> Class Throttler implements the bruteforce protection for security actions in Nextcloud.
>
> It is working by logging invalid login attempts to the database and slowing down all login attempts
> from the same subnet. The max delay is 30 seconds and the starting delay are 200 milliseconds.
> (after the first failed login)

The delay curve, `calculateDelay`:

```php
$firstDelay = 0.1;
if ($attempts > $this->config->getSystemValueInt('auth.bruteforce.max-attempts', self::MAX_ATTEMPTS)) {
    // Don't ever overflow. Just assume the maxDelay time:s
    return self::MAX_DELAY_MS;
}

$delay = $firstDelay * 2 ** $attempts;
if ($delay > self::MAX_DELAY) {
    return self::MAX_DELAY_MS;
}
return (int)\ceil($delay * 1000);
```

and the constants, `lib/public/Security/Bruteforce/IThrottler.php`:

```php
public const MAX_DELAY = 25;
public const MAX_DELAY_MS = 25000; // in milliseconds
public const MAX_ATTEMPTS = 10;
```

**CONTRADICTED, internally.** The docblock says "The max delay is 30 seconds"; the constant is
`MAX_DELAY_MS = 25000`, twenty-five. Both are Nextcloud's own text, in the same subsystem, and the
code is what runs. Doubling from 100 ms means the first failure costs 200 ms and the ceiling is
reached at attempt 8 (`0.1 * 2**8 = 25.6 s > 25`).

Applying it, `sleepDelay`:

```php
$delay = $this->getDelay($ip, $action);
if (!$this->config->getSystemValueBool('auth.bruteforce.protection.testing')) {
    usleep($delay * 1000);
}
```

and the hard stop, `sleepDelayOrThrowOnMax`: past `max-attempts` it re-counts the last 30 minutes and,
if still past it, `throw new MaxDelayReached('Reached maximum delay')` — the request is refused rather
than slept. The middleware wiring is
`lib/private/AppFramework/Middleware/Security/BruteForceMiddleware.php`, `beforeController`, which
reads the `#[BruteForceProtection(action: ...)]` attribute and calls
`$this->throttler->sleepDelayOrThrowOnMax($this->request->getRemoteAddress(), $action)`. The login
route carries it: `core/Controller/LoginController.php`, `tryLogin`, is decorated
`#[BruteForceProtection(action: 'login')]`.

### 4.2 Keying, storage, and reset

**Keyed by IP subnet, per action. CONFIRMED.** `registerAttempt` and `resetDelay` both go through
`$ipAddress->getSubnet()`, and every call is scoped by an `$action` string (`'login'`, `'sudo'`, …).
Not per account: OWASP's preferred key (see §5) is the one Nextcloud does not use.

**Stored in the database by default. CONFIRMED.** `lib/private/Server.php`:

```php
$this->registerService(\OC\Security\Bruteforce\Backend\IBackend::class, function ($c) {
    $config = $c->get(IConfig::class);
    if (!$config->getSystemValueBool('auth.bruteforce.protection.force.database', false)
        && ltrim($config->getSystemValueString('memcache.distributed', ''), '\\') === Redis::class) {
        $backend = $c->get(\OC\Security\Bruteforce\Backend\MemoryCacheBackend::class);
    } else {
        $backend = $c->get(\OC\Security\Bruteforce\Backend\DatabaseBackend::class);
    }

    return $backend;
});
```

So: the database unless a distributed Redis cache is configured, and forcibly the database if
`auth.bruteforce.protection.force.database` is set. A restart does not clear it in the default
configuration.

**Reset on successful login. CONFIRMED.** `lib/OC.php` hooks `postLogin`:

```php
$userSession->listen('\OC\User', 'postLogin', function () use ($userSession) {
    if (!defined('PHPUNIT_RUN') && $userSession->isLoggedIn()) {
        // reset brute force delay for this IP address and username
        $uid = $userSession->getUser()->getUID();
        $request = Server::get(IRequest::class);
        $throttler = Server::get(IThrottler::class);
        $throttler->resetDelay($request->getRemoteAddress(), 'login', ['user' => $uid]);
```

### 4.3 The IP allowlist

**CONFIRMED.** `lib/private/Security/Ip/BruteforceAllowList.php`:

```php
foreach ($this->appConfig->searchKeys('bruteForce', 'whitelist_') as $key) {
    $rangeString = $this->appConfig->getValueString('bruteForce', $key);
    ...
    $allowed = $range->contains($address);
```

The allowlist is app-config keys in the `bruteForce` namespace prefixed `whitelist_`, each holding an
IP range. `Throttler::registerAttempt`, `resetDelay` and `resetDelayForIP` all short-circuit on
`isBypassListed`, so an allowlisted range is never counted and never delayed. This is the escape hatch
Jellyfin does not have: a home LAN can be exempted while the internet is throttled.

### 4.4 Switches and operator tools

**CONFIRMED.** System config keys read by the throttler: `auth.bruteforce.protection.enabled`
(default `true` — the whole mechanism can be switched off), `auth.bruteforce.max-attempts`
(default `MAX_ATTEMPTS` = 10), `auth.bruteforce.protection.testing` (skips the `usleep`),
`auth.bruteforce.protection.force.database`.

Operator commands, both under `core/Command/Security/`:

- `security:bruteforce:attempts` — "Show bruteforce attempts status for a given IP address"
- `security:bruteforce:reset` — "resets bruteforce attempts for given IP address"

Log lines, both at info, from `sleepDelayOrThrowOnMax`:

```
IP address blocked because it reached the maximum failed attempts in the last 30 minutes [action: {action}, attempts: {attempts}, ip: {ip}]
IP address throttled because it reached the attempts limit in the last 12 hours [action: {action}, attempts: {attempts}, ip: {ip}]
```

---

## 5. OWASP — the Authentication Cheat Sheet on lockout versus throttling

Source: `OWASP/CheatSheetSeries`, `cheatsheets/Authentication_Cheat_Sheet.md`, default branch, read
via `gh api repos/OWASP/CheatSheetSeries/contents/cheatsheets/Authentication_Cheat_Sheet.md`
2026-09-12. This is the file the published cheat sheet is rendered from, so it is the owner's own text
rather than a summary of it.

The section is `#### Login Throttling`, and it opens:

> Login Throttling is a security mechanism used to prevent an attacker from making too many attempts
> at guessing a password through normal interactive means, it includes the following controls:
>
> - Maximum number of attempts.

Its first subsection is `##### Account Lockout`:

> The most common protection against these attacks is to implement account lockout, which prevents
> any more login attempts for a period after a certain number of failed logins.
>
> The counter of failed logins should be associated with the account itself, rather than the source
> IP address, in order to prevent an attacker from making login attempts from a large number of
> different IP addresses. There are a number of different factors that should be considered when
> implementing an account lockout policy in order to find a balance between security and usability:
>
> - The number of failed attempts before the account is locked out (lockout threshold).
> - The time period that these attempts must occur within (observation window).
> - How long the account is locked out for (lockout duration).
>
> Rather than implementing a fixed lockout duration (e.g., ten minutes), some applications use an
> exponential lockout, where the lockout duration starts as a very short period (e.g., one second),
> but doubles after each failed login attempt.
>
> - Amount of time to delay after each account lockout (max 2-3, after that permanent account lockout).
>
> When designing an account lockout system, care must be taken to prevent it from being used to cause
> a denial of service by locking out other users' accounts. One way this could be performed is to
> allow the use of the forgotten password functionality to log in, even if the account is locked out.

Three things this settles for the decision:

1. OWASP's stance is **per account, not per IP** — "The counter of failed logins should be associated
   with the account itself, rather than the source IP address". Audiobookshelf, Immich's recommended
   proxy answer and Nextcloud all key on IP; Jellyfin is the only one of the four that keys the way
   OWASP asks.
2. OWASP wants a **lockout duration**, not a permanent disable. All three of "lockout threshold",
   "observation window" and "lockout duration" are named as required parameters. Jellyfin has the
   threshold and no window and no duration: the disable is permanent.
3. OWASP names the denial-of-service failure mode explicitly and names the mitigation: "allow the use
   of the forgotten password functionality to log in, even if the account is locked out". Jellyfin
   does the opposite — §1.4 — which is why its own troubleshooting page is a SQL statement.

The cheat sheet gives no recommended attempt count or lockout duration beyond the illustrative "ten
minutes" and "one second" — **UNFOUND** for anyone wanting a number to cite from OWASP.

Adjacent controls the same section recommends, for completeness: `#### CAPTCHA` ("should be viewed as
a defense-in-depth control to make brute-force attacks more time-consuming and expensive, rather than
as a preventative … It may be more user-friendly to only require a CAPTCHA be solved after a small
number of failed login attempts") and `#### Security Questions and Memorable Words`.

---

## 6. The decision questions, answered

### 6.1 Which design can lock the only human out of their own server, and by whose action?

**Jellyfin, and only Jellyfin. By the action of any anonymous attacker on the network.**

Name the mechanism precisely: an unauthenticated `POST /Users/AuthenticateByName` carrying a known
username and any wrong password increments `Users.InvalidLoginAttemptCount` for that account. When it
reaches `Users.LoginAttemptsBeforeLockout`, `UserManager` writes `PermissionKind.IsDisabled = true`
into the `Permissions` table. From that moment `AuthenticateUser` refuses the account before it
evaluates the password, and the flag is cleared only by `UpdatePolicyAsync`, which is reachable only
through `POST /Users/{userId}/Policy` behind `[Authorize(Policy = Policies.RequiresElevation)]` —
an authenticated administrator. On a single-account instance there is no second administrator, so the
in-app route does not exist. The documented recovery is `sqlite3 jellyfin.db` and two `UPDATE`
statements (§1.5).

Two qualifications, both load-bearing:

- This requires the feature to be **on**. Per §1.3, a user created on a fresh Jellyfin has
  `LoginAttemptsBeforeLockout = NULL` and cannot be locked out at all. The exposure arrives when an
  administrator sets the policy value, or when a pre-v10.9 user is carried over by the migration
  routine (which maps the old `0` to `3`).
- The attacker needs the **username**. Jellyfin's login screen enumerates non-hidden users by design,
  which is what makes this cheap. Hiding the admin account (`PermissionKind.IsHidden`) reduces but
  does not remove it.

The other three cannot do this. Audiobookshelf's and Nextcloud's counters are keyed by IP or IP
subnet, so an attacker guessing from their own address burns their own quota; the owner at a different
address is unaffected. Immich has no counter to poison. The residual risk in the IP-keyed designs is
different and much smaller: an attacker **sharing** the owner's egress IP — a CGNAT pool, a corporate
network, or, more realistically, an attacker whose traffic arrives via the same reverse proxy when
`X-Forwarded-For` is not correctly configured — can exhaust the window the owner needs. That is a
timed inconvenience, not a lockout: Audiobookshelf's window is ten minutes and Nextcloud's counter
resets on the owner's next successful login.

### 6.2 Does any of them bound REFUSALS only, so a correct password always gets through?

**One does: Nextcloud, partially. Jellyfin bounds refusals but the consequence outlives them.
Audiobookshelf bounds attempts outright. Immich bounds nothing.**

- **Jellyfin — counts refusals, but the correct password is refused afterwards.** Only the failure
  branch increments, and success sets the count to `0`. So while the account is live, a correct
  password always gets through and clears the slate. The moment the threshold trips, the disabled
  check at `UserManager.cs` line 622 runs *before* the password is compared, and the correct password
  is refused for good. Refusal-counted, attempt-denied.
- **Audiobookshelf — counts attempts.** The limiter is mounted before `passport.authenticate`, and
  `skipSuccessfulRequests` is `false` (§2.5). Forty requests in ten minutes from one IP exhaust it
  whether they succeeded or failed, and the forty-first correct password gets a 429. This also means
  a busy legitimate client can exhaust the owner's own budget, since `/auth/refresh` shares the same
  counter.
- **Nextcloud — counts refusals, and a correct password both gets through and clears the count.**
  Below `max-attempts` the request is only delayed, never refused, so the right password always
  arrives (late), and `postLogin` then calls `resetDelay`. Above `max-attempts` within 30 minutes,
  `MaxDelayReached` refuses the request outright, and at that point a correct password is refused
  too — but the bound expires with the 30-minute window rather than persisting.
- **Immich — neither.** Every attempt is evaluated.

### 6.3 Concurrency: does each mechanism actually bound the guess RATE?

This is where the designs separate most sharply.

- **Jellyfin — yes, and absolutely.** The bound is a total count of failures, not a rate. Concurrency
  buys an attacker nothing: N concurrent wrong guesses simply trip the lockout sooner. Total guesses
  against an account with the feature on is capped at the threshold, full stop, for all time until
  somebody resets it. (The counter is guarded by `_userLock.LockAsync(userId)` around the
  authentication path and by a SQL-side `SetProperty(f => f.InvalidLoginAttemptCount, f => f.InvalidLoginAttemptCount + 1)`,
  so concurrent failures cannot lose increments.) **JUDGEMENT**, read from the code.
- **Audiobookshelf — yes, genuinely.** This is a counting limiter, not a sleep. `MemoryStore.increment`
  is a synchronous `client.totalHits++` inside a single-threaded Node event loop, executed in the
  middleware before the handler, and the request is rejected with 429 the moment the count exceeds
  `max`. Forty per ten minutes per IP is a real throughput ceiling regardless of how many sockets the
  attacker opens. **JUDGEMENT**, read from `source/memory-store.ts` and `source/lib.ts` at `v7.5.1`.
- **Nextcloud — mixed, and this is the classic trap.** `sleepDelay`/`sleepDelayOrThrowOnMax` call
  `usleep`, which occupies one PHP worker for the duration. Under concurrency that bounds the rate
  *per connection*, not in aggregate: an attacker with C concurrent requests gets roughly C guesses
  per delay period, limited by the web server's worker pool rather than by the throttler. What saves
  it is the second half — `MaxDelayReached` above `max-attempts` (default 10) in the last 30 minutes
  is a refusal, not a sleep, so the aggregate ceiling is roughly 10 failed guesses per subnet per
  30 minutes. The delay curve alone would not bound the rate; the throw does. **JUDGEMENT**.
- **Immich — no bound of any kind, so the question does not arise.** The only rate ceiling is bcrypt's
  own cost function multiplied by the server's core count, which is a performance property and not a
  security control.

The general lesson for the decision: a per-request sleep is not a bound. A counter that refuses is.

### 6.4 Is the state in memory (a restart lifts it) or in the database?

| Product | Where | Restart lifts it? | Evidence |
| --- | --- | --- | --- |
| Jellyfin | **Database.** `Users.InvalidLoginAttemptCount` (INTEGER) and a `Permissions` row with `Kind = 2` in `jellyfin.db` | **No** | `User.cs` properties + `JellyfinDbModelSnapshot.cs` (`b.Property<int>("InvalidLoginAttemptCount")`, `b.Property<int?>("LoginAttemptsBeforeLockout")`); the documented fix is a SQL `UPDATE` |
| Audiobookshelf | **Memory.** express-rate-limit 7.5.1 default `MemoryStore` — two `Map`s in the Node process | **Yes, completely** | `rateLimiterFactory.js` passes no `store`; `source/memory-store.ts` at `v7.5.1`: `previous = new Map<string, Client>()` / `current = new Map<string, Client>()` |
| Immich | **Nowhere.** No counter, no table | n/a | `auth.service.ts` `login()`; no auth-attempt table in `server/src/schema/tables` |
| Nextcloud | **Database by default** (`oc_bruteforce_attempts` via `DatabaseBackend`); memory only when a distributed Redis is configured and `auth.bruteforce.protection.force.database` is false | **No, by default** | `lib/private/Server.php` `IBackend` registration |

For a single-account instance the practical reading is: Audiobookshelf's bound is soft — a restart or
a container redeploy clears it, which also means it cannot lock anyone out for long. Jellyfin's is
hard and survives everything short of editing the database.

### 6.5 Is a refused attempt recorded where the operator can see it?

**All four log it; none of them show it in a UI except Jellyfin's lockout event.**

**Jellyfin** — per refusal, at Information:

```
Authentication request for {UserName} has been denied (IP: {IP}).
```

rendered into the log file by
`[{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz}] [{Level:u3}] [{ThreadId}] {SourceContext}: {Message}`.
Because the file sink uses bare `{Message}` (not `{Message:lj}` as the console sink does), Serilog
quotes the string property, which is why the project's own fail2ban filter is
`failregex = ^.*Authentication request for .* has been denied \(IP: "<ADDR>"\)\.` — and why the docs
insist the log level must be `Info`. On lockout there is additionally a WARN line
(`Disabling user {Username} due to {Attempts} unsuccessful login attempts.`) and an **activity-log
row visible in the admin dashboard**, severity Error, reading `User {0} has been locked out`
(`UserLockedOutLogger.cs` + `en-US.json` `UserLockedOutWithName`). Jellyfin is the only one of the
four with a UI surface for this.

**Audiobookshelf** — per refusal, at ERROR, with the reason attached:

```
[LocalAuth] Failed login attempt for username "jacob" from ip 203.0.113.7 (Invalid password)
```

and per rate-limit trip, at WARN:

```
[RateLimiter] Rate limit exceeded - IP: 203.0.113.7, Endpoint: POST /login, User-Agent: curl/8.4.0
```

No table, no UI. The reason string distinguishes `User not found` from `Invalid password`, which is
more than the HTTP response reveals — useful to an operator, and also a small enumeration surface for
anyone who can read the logs.

**Immich** — one line, at warn, to stdout only:

```
Failed login attempt for user someone@example.com from ip address 203.0.113.7
```

The attempted email and the client IP are both in it, so a fail2ban filter is writable. There is no
file to point fail2ban at: the maintainers' answer on discussion #18174 is that stdout plus a Docker
logging driver is the design. No table, no UI.

**Nextcloud** — `oc_bruteforce_attempts` rows (readable with `occ security:bruteforce:attempts <ip>`)
plus the two info lines quoted in §4.4. This is the only one of the four where refused attempts are
queryable as data rather than parsed out of text.

---

## 7. Summary

### 7.1 One row per product

| | Jellyfin v12.0 | Audiobookshelf v2.36.0 | Immich v3.2.0 | Nextcloud v32.0.15 |
| --- | --- | --- | --- | --- |
| Mechanism | Account lockout (permanent disable) | Request rate limit (429) | **None** | Exponential delay, then hard refusal |
| Keyed by | **Account** | **Client IP** | — | **IP subnet**, per action |
| Threshold | `LoginAttemptsBeforeLockout`; `0` → 3, `-1` → off, **NULL (new users) → off** | 40 requests / 10 min | — | 10 attempts (`auth.bruteforce.max-attempts`), refusal above that within 30 min |
| Counts attempts or refusals | Refusals (but a correct password is refused once locked) | **Attempts**, success included | — | Refusals |
| Reset on success | Yes, count → 0 (unless already locked) | **No** | — | Yes, `postLogin` → `resetDelay` |
| State lives | Database (`jellyfin.db`) | **Memory** (MemoryStore) | — | Database (`oc_bruteforce_attempts`) by default |
| Restart lifts it | No | **Yes** | — | No |
| Bounds rate under concurrency | Yes (total cap) | Yes (counting limiter) | No | Only via the `MaxDelayReached` throw; the `usleep` alone does not |
| Can lock out the only admin | **Yes, by any anonymous attacker** | No | No | No (subnet-keyed, expires, resettable) |
| Self-service recovery | **None — documented fix is a SQL `UPDATE`** | Wait 10 min, or restart | n/a | Wait, allowlist the IP, or `occ security:bruteforce:reset` |
| Allowlist / bypass | None | `RATE_LIMIT_AUTH_MAX=0` disables globally | n/a | Per-IP-range allowlist (`bruteForce` / `whitelist_*`) |
| Operator visibility | Log line + **admin activity log** | Two log lines | One stdout line | DB table + `occ` + log lines |
| Configurable by | Admin UI, per user | 2 documented env vars (+1 undocumented) | — | 4 system config keys + app-config allowlist |

### 7.2 Verdicts that went against the received story

| Claim | Verdict | What the owner actually says |
| --- | --- | --- |
| Jellyfin's lockout default is 3 for users and **5 for administrators** | **CONTRADICTED** | The docs and the web client both say it; the server maps `0 => 3` with no admin branch, in `v10.8.0`, `v10.11.11`, `v12.0` and the migration routine alike. `5` appears nowhere on this path. |
| Jellyfin locks out after 3 attempts **by default** | **CONTRADICTED** | `LoginAttemptsBeforeLockout` is a nullable column with no default and is not set by `User`'s constructor; the guard is `maxInvalidLogins.HasValue`. A newly created user has no lockout until an admin saves a policy. |
| Jellyfin refuses to disable administrators | **Half true** | `UserController.UpdateUserPolicy` returns 403 "Administrators cannot be disabled." — but `UserManager`'s lockout branch calls `SetPermission` directly and bypasses that controller entirely. |
| Audiobookshelf's login limit is the `rateLimitLoginRequests: 10` server setting | **CONTRADICTED** | That setting is vestigial. It is declared, persisted and serialised in `ServerSettings.js` and read by **nothing** — `gh search code` finds it in that one file. The live values are 40 / 10 minutes from `rateLimiterFactory.js` and the `RATE_LIMIT_AUTH_*` env vars. |
| Nextcloud's max brute-force delay is 30 seconds | **CONTRADICTED, by Nextcloud's own constants** | The `Throttler` docblock says 30 s; `IThrottler::MAX_DELAY_MS = 25000`. |
| Immich has some brute-force protection, or the request is open and unanswered | **CONTRADICTED** | None in code (no throttler dependency, no guard, no counter, no table), and the request is closed twice — #18861 RESOLVED, #21165 DUPLICATE — plus PR #23892 closed unmerged in 7.5 minutes, all with the same maintainer answer: reverse proxy or fail2ban. |
| OWASP recommends a specific attempt count | **UNFOUND** | The cheat sheet names the three parameters (threshold, observation window, lockout duration) and gives only illustrative values ("ten minutes", "one second"). No recommended number. |
| Any of these ships an account-keyed bound with a lockout *duration* | **UNFOUNDED** | Jellyfin is the only account-keyed one and its lockout is permanent, with no observation window and no expiry. None of the four implements the three-parameter policy OWASP describes. |

### 7.3 The one-sentence version

Of the four, only Jellyfin keys the bound where OWASP says to key it — and it is also the only one
that can hand an anonymous attacker the power to lock a single-account owner out of their own server
permanently, because it pairs an account-keyed counter with a lockout that has no duration, no
self-service recovery, and a database-edit as its documented remedy.
