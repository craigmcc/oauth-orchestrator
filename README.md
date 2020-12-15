# oauth-orchestrator

Basic implementation of OAuth 2.0
[RFC 6749](https://tools.ietf.org/html/rfc6749)
back end functionality, suitable for integration with a Node-based web
application.

This document assumes you have at least a casual knowledge
of the terminology used in the OAuth 2.0 Specification - there are
gazillions of available tutorials, blogs, and articles about it
at your fingertips on the web.

## 1. Installation

```bash
npm install @craigmcc/oauth-orchestrator
```

TODO:  This will not work, of course, until I publish
the library to NPM.  That should happen soon.  In the mean
time, it's simple to download the sources from GitHub and
build it for yourself.

## 2. Features

- Supports `password` and `refresh` token grants for Authorization Server
  and/or Resource Server implementations.
  - Other grant types could be added, but these two met my initial needs.
- Supports an `authorize()` method that is available to Resource Server
  applications to verify the validity of an access token, as well as whether
  that access token is still valid, and whether it supports the scope
  required to perform a specific operation.  Calls to this method
  can be made from the HTTP request handler for your incoming requests.
- Library is **agnostic** about application-specific concerns, such as where
  and how user and token information is stored, or what HTTP framework
  might be in use.
- Instead, an application integrating this library must provide a small
  set (6) of handler functions to provide concrete implementations of
  necessary features.
- Although optimized for use cases where the Authorization Server (AS)
  and Resource Server (RS) are in the same application, it would be
  feasible to separate them by
  - Implementing the Orchestrator and its handlers in the AS.
  - Providing a means for RS request processing to remotely access the
    `authorize()` endpoint of the AS.

## 3.  Technologies

When I first set out to incorporate OAuth into one of my existing applications, I spent
a fair amount of time examining the plethora of libraries supporting OAuth in various
manners.  I even did test implementations of several, but always came across either
showstopping limitations in how the grant types I needed were implemented, libraries
that were not recently updated, or (important to me) libraries that originated in
the very ancient days of Javascript (no classes, no async/await, no Typescript).  That
did not appeal to me, as my intial target application was a green field creation
started in mid-2020, so I was not constrained by having to support older stuff.

As such, the following technologies form the basis of this library:
- Presumes a `Node JS` environment that supports the latest stuff (I use 14.15
  or later in my own applications).
- Implemented with `Typescript` that is transpiled to target **es6**.
- (Of course, the library can be used in a pure JavaScript environment,
  but if you came from a Java background like I did, object oriented
  development - especially type checking - is a HUGE quality improver.)
- (Personal Preference) - the tests for this library use Mocha and Chai
  (very fast, clean output, and I like "expect" type syntax).

What, no web framework like [Express](http://expressjs.com/), you ask?  Nope.

Indeed, if you peruse the included `package.json` file, you will see that
there are **no** runtime dependencies -- only compile time ones.  I wanted
to minimize the barriers to developers who want to integrate with any
server technologies that they choose (or that their company might impose).

Fear not, however, I use it in real life in Express-based applications.
The documentation below will include some snippets describing how I
generally integrate it.

## 4.  Integration Steps:

DEVELOPER NOTE:  The various data types and handler calling sequences
described below are documented in the `types.d.ts` file included in the
library (after installing, it will be at
*node_modules/@craigmcc/oauth-orchestrator/types.d.ts*.  For
Typescript-based applications, these types are all conveniently
exported so that you have can import and use them.  For
non-Typescript-based applications, the type definitions are liberally
documented and suitable for helping you get all the data objects
and function calling sequences built correctly.

### 4.1 Create Persistent Storage Implementations

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

### 4.1 Create Required `OrchestratorHandlers` Object and Handler Implementations

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

IMPLEMENTATION NOTE:  Because each of these handlers returns a (native)
JavaScript **Promise**, they are intended to be implemented as **async**
functions.  You will definitely need to brush up on your knowledge of
how asynchronous things work in JavaScript if you are not familiar
with them.  Fortunately, pretty much every web framework, database
interface, or HTTP client library you might use to implement things
are already very comfortable with promises, so they will fit in
pretty easily.

PERSONAL ASIDE:  My favorite approach is to declare these functions
as "async", and then use "await" on calls to other services that return
promises. Plus, I like to use try/catch blocks to deal with any errors
that those services might throw.  I find this MUCH easier to
understand than the ".then() and .catch()" paradigm you will
also see used all over the place in JavaScript libraries and
applications.  That approach also works, but it has a whole ton
of subtleties that makes it much harder to learn.

The implementation requirements for each handler are described in the
following sections (each preceeded with its Typescript signature, with
definitions of the parameters and return type).

#### 4.1.1 Authenticate User

```typescript
export type AuthenticateUser
    = (username: string, password: string)
    => Promise<User>;
```

For the Password Grant flow in OAuth, it is presumed that your
application will have some sort of login screen that asks for
username and password.  They are then submitted to the Orchestrator
in order to ask the AuthenticateUser handler to actually authenticate
these credentials.

The most common approach to this is to have your application
provide an API endpoint (often `/oauth/authenticate` but this
is up to you) that triggers a call to the Authenticate User
handler, via a Password Grant request to the Orchestrator's
*token()* method.

If authentication is successful, your handler should return a
**User** object, as described above. Orchestrator will then
use that object to create an access token and (optional, but
turned on by default) refresh token.

If authentication fails, or any other problem occurs, simply
throw an appropriate error.  This will get passed back to your
logic that called the authen

#### 4.1.2 Create Access Token

```typescript
export type CreateAccessToken
    = (expires: Date, scope: string, userId: Identifier)
    => Promise<AccessToken>;
```

This handler will be called whenever the Orchestrator needs
to create a new access token.  This will happen in at least
the following scenarios:
- A newly logging in user is sucessfully authenticated,
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

#### 4.1.3 Create Refresh Token

```typescript
export type CreateRefreshToken
    = (accessToken: string, expires: Date, userId: Identifier)
    => Promise<RefreshToken>;
```

This handler will be called if the Orchestrator is configured
to return refresh tokens (it is by default), a refresh token
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

#### 4.1.4 Retrieve Access Token

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
when the Revoke Access Token handler is called, to avoid
stale tokens from being used for additional requests.

#### 4.1.5 Retrieve Refresh Token

```typescript
export type RetrieveRefreshToken
    = (token: string)
    => Promise<RefreshToken>;
```

Existing refresh tokens are retrieved by this handler,
whenever needed for the Refresh Token flow.

As usual, if your server environment has problems, or if
the requested refresh token does not exist, throw an Error.

#### 4.1.6 Revoke Access Token (and any related Refresh Tokens)

```typescript
export type RevokeAccessToken
    = (token: string)
    => Promise<void>;
```

TODO

### 4.2 Create Optional `OrchestratorOptions` To Override Defaults

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

### 4.3 Instantiate and Configure an `Orchestrator` Singleton

TODO

### 4.4 Integrate Authorization Calls In Your Resource Server

TODO

## 5 Example Implementation Notes

### 5.1 Introduction

As described above, I am using this library for my personal
projects.  The following notes describe how I chose to use it
in an Express-based web application that provides REST API
calls, many of which need to be accessed only by logged in
users.  In addition, "admin" users can perform more operations
(for example creating/updating/deleting) than "regular" users
can do, so I use the "scope" capabilities to distinguish
between them.

This is by no means the only approach that can be taken,
but having something concrete to examine should help as
you plan how to integrate OAuth capabilities into your
own application.

NOTE:  In my particular case, the Authorization Server
and Resource Server components are part of the same web
application.  Therefore, they can share a single instance
of Orchestrator, with the `authorize()` calls being done
by the Resource Server's HTTP request handlers, and the
same database used for the rest of the application.  The two
main functional responsibilities could be separated,
if you set up back-channel communications between the two.

### 5.2 The Library Application

TODO - general description of what the application does.

### 5.3 Scope Definitions

TODO - how I named the various scopes.

### 5.4 Authorization Server Integration

TODO - how I implemented the handlers described above,
and integrated the Orchestrator into the root of the
application.

### 5.5 Per Request Authorization

TODO - how I implemented calls to the `authorize()` method
into my Express user, via Express's "middleware" plugin
architecture.

