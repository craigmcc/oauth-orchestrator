# oauth-orchestrator

Basic implementation of OAuth 2.0
[RFC 6749](https://tools.ietf.org/html/rfc6749), and the corresponding
usage of Bearer tokens for authorizing incoming requests
[RFC 6750](https://tools.ietf.org/html/rfc6750).
It provides back end functionality, suitable for integration with a
Node-based web application.

It supports the **Resource Owner Password Credentials Grant** (Section 4.3)
and the **Refreshing an Access Token** (Section 6) flows.

The primary focus is supporting use cases where (in RFC 6749 terminology)
the **Authorization Server** (which validates passwords and gives out
access and refresh tokens) and the **Resource Server** (which authorizes
incoming requests and performs your application logic) are in the same
web application.  However, it would be straightforward to split these
responsibilities into different servers with support for some
back-channel communication between the two.

## 1. Installation

```bash
npm install @craigmcc/oauth-orchestrator
```

TODO:  This will not work, of course, until I publish
the library to NPM.  That should happen soon.  In the mean
time, it's simple to
[download the sources](https://github.com/craigmcc/oauth-orchestrator) from GitHub and
build it for yourself.

If you do this, [npm link](https://docs.npmjs.com/cli/v6/commands/npm-link)
makes it easy to develop an application that depends on Orchestrator, without
having to formally declare it as a dependency.

## 2. Features

- Supports *password* and *refresh* token grants for Authorization Server
  implementations.
- Supports an `authorize()` method for the Resource Server
  to verify the validity of an access token (is it a valid
  token, has it expired, does it possess the scope required for the
  application function being requested) on each request to a protected
  API endpoint.
- Orchestrator is **agnostic** about application-specific concerns, such as:
  - Where and how user information is stored.
  - Where and how access token and refresh token information is stored.
  - What HTTP framework might be in use.
- Instead, an application integrating this library must provide a small
  set (6) of handler functions to provide concrete integrations of
  necessary features.

Authenticating client applications (via client_id and
client_secret properties) is not currently supported.   This is
a likely future addition, but to maintain backwards compatibility
it will likely remain optional.

## 3.  Technologies

In contrast to many of the OAuth packages currently available for
Node-based web applications, Orchestrator strives to be minimalist
in its requirements.  Indeed, if you peruse the `package.json` file,
defining it, you will note that there are **zero** runtime dependencies.
It also presumes that a reasonably current set of technologies are available.

As such, the following technologies form the basis of this library:
- [NodeJS](https://nodejs.org/en/).  I use version 14.15 or later,
  although it may work with previous versions.
- [Typescript](https://www.typescriptlang.org).  Coming out of a
  primarily Java-based software development career, the object
  orientation and error catching was very comfortable.  I use
  version 4.1 or later, transpiling to target **es6** by default.
  The library should (of course) be usable in pure Javascript
  environments as well.
- [Mocha](https://mochajs.org/)  and [Chai](https://www.chaijs.com/)
  for testing.  This was mostly personal preference, but I like
  the robust support for async/await based functions out of the
  box, as well as the cleaner output formats than some other
  testing libraries.

No web framework is defined as a dependency - it is up to the
handler functions provided by your integration to adapt to
whatever request/response support your web framework offers.
I use [Express](https://expressjs.com) for my own personal
projects, where the middleware support makes integration for
authorization calls very easy, but it should be possible to
use other frameworks as well.

## 4.  Integration Steps:

### 4.1 Developer Notes

For Typescript-based applications, all the type definitions
mentioned below are exported by the library, so you can say
things like this in your application:

```typescript
import {
  AccessToken,
  RefreshToken,
  User } 
from "@craigmcc/oauth-orchestrator";
```

For non-Typescript-based applications, you cannot reference the
type definitions in your code, but they are available to read in
a liberally commented text file, which (after installation) will be at
*node_modules/@craigmcc/oauth-orchestrator/types.d.ts* relative
to your project directory.  This will help you get the parameter types
and return values right on your handler function implementations.

### 4.2 Create Persistent Storage Implementations

Your application is responsible for providing persistent storage
(typically in a database, but that is up to you) for the following
object types:

**AccessToken** - Access tokens that are created
  or retrieved by the Orchestrator.

```typescript
export interface AccessToken {
    expires: Date;              // Timestamp when this token expires
    scope: string;              // Scope granted to this token
    token: string;              // Actual access token value
    userId: Identifier;         // User this token is associated with
}
```

The *token* field of an access token is an opaque string that is
send on each request to the Resource Server.  They expire at
a certain time, and can be refreshed or revoked (which is
effectively a logout operation).

To minimize security risks, you should
generate reasonably long random character strings as token values.

**RefreshToken** - Refresh tokens that are created
  or retrieved by the Orchestrator.

```typescript
export interface RefreshToken {
    accessToken: string;        // Access token value this refresh token is for
    expires: Date;              // Timestamp when this token expires
    token: string;              // Actual refresh token value
    userId: Identifier;         // User this token is associated with
}
```

If configured (and it is by default), a user who successfully
authenticates will receive both an access token and a refresh
token.  The refresh token will generally have a much longer
lifetime than an access token, and can (when the access token
nears its expiration) be exchanged for a new access token and
refresh token, without requiring the user to be authenticated
again.

**User** - Instances of all users allowed to be authenticated.

```typescript
export type Identifier = string | number;

export interface User {
    scope: string;              // Space-separated scopes granted to this user.
    userId: Identifier;         // Unique user identifier.
}
```

For maximum flexibility, an **Identifer** is either a string
or a number.

This is all that the Orchestrator needs to keep track of about
users, once they have been authenticated.
- **scope** - A space delimited maximum list of permissions that
  this user will be granted when they authenticate.  (They can
  ask for fewer permissions if they want, but that is optional).
- **userId** - An opaque identifier for this user (typically
  it is the primary key for your user table, but can be
  whatever you want as long as it is unique between users).
  This identifier is used to tie together the tokens that have
  been granted to this user.

If you have a much richer model of what a "user" is in your
application, that is fine.  Because Orchestrator does not
care about these details, all you have to do is satisfy the
object definition above in order to operate successfully with it.

Note in particular that there are no *username* or *password*
fields included in this object.  Orchestrator does not need to
know or care about those details.  If you use the Password Grant
approach to OAuth, you'll be requiring the user to specify
username and password to perform the authentication, but after
that they no longer matter, and are not kept inside.

Indeed, even the mechanism that your application uses
to perform this authentication is totally up to you as well.

We will get to how your Resource Server can leverage the `authorize()`
capability to check for access on each request later, after we
set up the Authorization Server integration.

### 4.3 Create Required `OrchestratorHandlers` Object and Handler Implementations

The definition of an `OrchestratorHandler` is pretty straightforward.
It is merely a list that maps implementation-specific handlers to
names that the Orchestrator knows, so that it can call out to your
methods as needed.  The Typescript-y version of this object is:

```typescript
export interface OrchestratorHandlers {
    authenticateUser: AuthenticateUser;
    createAccessToken: CreateAccessToken;
    createRefreshToken: CreateRefreshToken;
    retrieveAccessToken: RetrieveAccessToken;
    retrieveRefreshToken: RetrieveRefreshToken;
    revokeAccessToken: RevokeAccessToken;
}
```

It is likely easiest to create this object in a separate file
(MyOrchestratorHandlers.ts or whatever), which also includes the
non-exported implementations of each handler function.  For more
complex scenarios, you might prefer to separate the handlers into
their own individual files.

Note that all the handler functions return Promises, and are
therefore expected to be *async* functions.  Fortunately, pretty
much any libraries you need for database access, password hashing,
and your web framework will be very comfortable with this.

As a personal preference, I like using "await" over then/catch chains
(with try/catch blocks to deal with errors as needed), but that style
choice us up to you.  There is no support for the older Javascript
style of appending a callback function to the parameters.

The implementation requirements for each handler are described in the
following sections (along with the Typescript signature, with
definitions of the parameters and return type).

#### 4.3.1 Authenticate User

```typescript
export type AuthenticateUser
    = (username: string, password: string)
    => Promise<User>;
```

For the Password Grant flow in OAuth, it is presumed that your
application will have some sort of login screen that asks for
username and password.  These are then submitted to the Orchestrator
in order to ask the AuthenticateUser handler to actually authenticate
these credentials.

The most common approach to this is to have your application
provide an API endpoint (often `/oauth/token` but this
is up to you) with incoming data that looks like a
`PasswordTokenRequest` that triggers a call to the
`AuthenticateUser` handler.  Per the OAuth specification,
this request should have property names matching those in
`PasswordTokenRequest`, with content type
**application/x-www-form-urlencoded** (i.e. the standard
format for form submission).

If authentication is successful, your handler should return a
**User** object, as described above. Orchestrator will then
use that object to create an access token and (optional, but
turned on by default) refresh token, which will be returned
as a `TokenResponse` object (in JSON format).

If authentication fails (invalid username or password) an
`InvalidGrantError` will be returned to you, with the underlying
error included in the *inner* property.  To avoid showing
potentially sensitive information to client callers, this
property should be suppressed in any response sent back to
the calling application.

IMPLEMENTATION NOTE:  It is **strongly** recommended that you
do not store plaintext passwords in a database!  Instead,
encrypt them with a one-way hash function (I like bcrypt but
the choice is yours), and implement your authentication handler
to verify the submitted password against the hashed version
retrieved from your database.  Just be sure that you use the
same algorithm for hashing and verifying.

#### 4.3.2 Create Access Token

```typescript
export type CreateAccessToken
    = (expires: Date, scope: string, userId: Identifier)
    => Promise<AccessToken>;
```

This handler will be called whenever the Orchestrator needs
to create a new access token.  This will happen in
the following scenarios:
- A newly logging in user is successfully authenticated,
  and needs to receive an access token for use on all
  the subsequent API requests for that user.
- An existing logged in user has a valid access token, but
  it is approaching the end of its life.  The client
  application recognizes this situation, and uses the
  refresh token it previously received to trigger
  creation of a new access token and (optional)
  refresh token.  As a side effect, the old tokens will
  be revoked so that they are no longer valid.

The returned access token will be returned to the user,
and then it's *token* value will be sent with each
incoming API request, in order to prove the user's
identity has been confirmed, and to validate whether
the user is allowed to perform the operation being
requested (by comparing the *scope* assigned to this
token to that required by the requested operation).

If your application has problems storing or returning this
token, simply throw an appropriate Error.

#### 4.3.3 Create Refresh Token

```typescript
export type CreateRefreshToken
    = (accessToken: string, expires: Date, userId: Identifier)
    => Promise<RefreshToken>;
```

This handler will be called if Orchestrator is configured
to return refresh tokens (it is by default), and a refresh token
will be created via this call, at the same time that a new
access token was created.

If your application has problems storing or returning this
token, simply throw an appropriate Error.

If your application turns off refresh token creation, it will
not be possible to use such a token to receive new tokens.
When the user's access token eventually expires, calls to
the `authorize()` Orchestrator method will start failing
(if you follow best practices, an HTTP 401 status will be
returned to the user), after which they will need to
reauthenticate to continue using the application.

#### 4.3.4 Retrieve Access Token

```typescript
export type RetrieveAccessToken
    = (token: string)
    => Promise<AccessToken>;
```

This handler will be called whenever an incoming request is
authorized (via a call to the `authorize()` method of the
Orchestrator).  You do not need to worry about checking
whether the token has expired or not - Orchestrator will take
care of that detail.

If the requested token does not exist, or your internal
systems have problems, throw an approprite Error.

PERFORMANCE NOTE:  This handler will be called **many many**
times - once per API call to a protected resource.  If this
creates performance issues, consider using some sort of
in-memory cache to minimize the number of database calls
needed.  Just be sure that you purge the cache entries
when the `RevokeAccessToken` handler is called, to avoid
stale tokens from being used for additional requests.

#### 4.3.5 Retrieve Refresh Token

```typescript
export type RetrieveRefreshToken
    = (token: string)
    => Promise<RefreshToken>;
```

Existing refresh tokens are retrieved by this handler,
whenever needed for the Refresh Token flow.

As usual, if your server environment has problems, or if
the requested refresh token does not exist, throw an Error.

#### 4.3.6 Revoke Access Token (and any related Refresh Tokens)

```typescript
export type RevokeAccessToken
    = (token: string)
    => Promise<void>;
```

Conventionally, your application will offer an endpoint (I like
to use `DELETE /oauth/token`, but this it is up to you) that
effectively logs the user off by removing or deactivating the
specified access token, along with any associated access tokens.
The processing logic for this endpoint will call this handler.
Afterwards, the access token that was used will no longer be
valid, and the user will need to log back in again via the
Password Grant flow.

Whether you offer such an endpoint or not, you will
want to build some sort of scheduled job (daily or whatever) to
prune expired access tokens (and their corresponding refresh
tokens, if any).

### 4.4 Create Optional `OrchestratorOptions` To Override Defaults

If you want to modify some or all of the configuration options
for the Orchestrator, you can create an options object that is
passed to the Orchestrator at instantiation time.  The type
definitions for this object describe the options that can be
modified, with default values in square brackets.

```typescript
export interface OrchestratorOptions {
    accessTokenLifetime?: number;       // In seconds [86400, one day]
    issueRefreshToken?: boolean;        // Issue refresh token with
                                        // access token? [true]
    refreshTokenLifetime?: number;      // In seconds [604800, one week]
}
```

### 4.5 Instantiate and Configure an `Orchestrator` Singleton

In the top-level Javascript object that controls your application,
include logic similar to this:

```typescript
import { Orchestrator } from "@craigmcc/oauth-orchestrator";
import { MyOrchestratorHandlers } from "...wherever...";
export const OAuthOrchestrator: Orchestrator
  = new Orchestrator(MyOrchestratorHandlers);
```

This will make a configured `OAuthOrchestrator` instance available
to any other part of your application that needs access to it.

If you want to override some of the configuration properties, pass
a suitable `OrchestratorOptions` object as the second parameter
to the constructor.

### 4.6 Integrate Authorization Calls In Your Resource Server

TODO

### 4.7 Client Application Responsibilities

TODO
