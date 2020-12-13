// types =====================================================================

// Typescript type definitions that integrating applications must be aware of.

// Data Model Types ==========================================================

/**
 * Arbitrary (from the viewpoint of this library) identifier for an object.
 * Such identifiers must be unique within the object type they refer to.
 */
export type Identifier = string | number;

/**
 * An OAuth2 access token associated with a user.
 */
export interface AccessToken {
    expires: Date;              // Timestamp when this token expires
    scope: string;              // Scope granted to this token
    token: string;              // Actual access token value
    userId: Identifier;         // User this token is associated with
}

/**
 * An OAuth2 refresh token associated with a user.
 */
export interface RefreshToken {
    accessToken: string;        // Access token value this refresh token is for
    expires: Date;              // Timestamp when this token expires
    token: string;              // Actual refresh token value
    userId: Identifier;         // User this token is associated with
}

/**
 * An authorized user and associated scope assigned to that person.  Note that
 * details of how users are identified and stored is outside the scope of the
 * Orchestrator.  Only the details it requires are described here.
 */
export interface User {
    scope: string;              // Space-separated scopes granted to this user.
    userId: Identifier;         // Unique user identifier.
}

// Request and Response Types ================================================

/**
 * Input parameters that must be included on any request to the Token service.
 * For ease of translation, field names match those in the OAuth
 * Specification.  More detailed interfaces for each supported grant type
 * extend this interface.
 */
export interface TokenRequest {
    grant_type: string;         // Grant type being requested
    scope?: string;             // (Optional) scope being requested
}

/**
 * Extended interface for token requests of grant type "password".
 */
export interface PasswordTokenRequest extends TokenRequest {
    password: string;           // User password
    username: string;           // User username
}

/**
 * Extended interface for token requests of grant type "refresh_token".
 */
export interface RefreshTokenRequest extends TokenRequest {
    refresh_token: string;      // Refresh token for which to return
                                // a new access token (and maybe a
                                // refresh token as well).
}

/**
 * Output parameters returned by a successful Token service request.
 * For ease of translation, field names match those in the OAuth
 * Specification.
 */
export interface TokenResponse {
    access_token: string;       // Newly created access token
    expires_in: number;         // Lifetime (in seconds) of this access token
    refresh_token?: string;     // Optional refresh token
    scope: string;              // Scope assigned to this access token
    token_type: string;         // Token type supported by this server
}

// Orchestrator Configuration Objects ========================================

/**
 * Applications integrating the Orchestrator MUST provide an instance
 * implementing this interface, to define the application-specific
 * handler functions that will be utilized by the Orchestrator.
 */

export interface OrchestratorHandlers {
    authenticateUser:           AuthenticateUser;
    createAccessToken:          CreateAccessToken;
    createRefreshToken:         CreateRefreshToken;
    retrieveAccessToken:        RetrieveAccessToken;
    retrieveRefreshToken:       RetrieveRefreshToken;
    revokeAccessToken:          RevokeAccessToken;
}

/**
 * Applications integrating the Orchestrator MAY provide an instance
 * implementing this interface, to define overrides for configuration
 * values that affect operation of the Orchestrator.  Default values
 * are listed in square brackets in the comments.
 */
export interface OrchestratorOptions {
    accessTokenLifetime?: number;       // In seconds [86400, one day]
    issueRefreshToken?: boolean;        // Issue refresh token with
                                        // access token? [true]
    refreshTokenLifetime?: number;      // In seconds [604800, one week]
}

// Implementation Provided Handlers ==========================================

/**
 * Validate the specified user credentials, and return a corresponding User
 * object, or throw an Error if the user could not be validated (wrong
 * credentials, no such user, or other failure cause).
 */
export type AuthenticateUser
    = (username: string, password: string)
    => Promise<User>;

/**
 * Return a promise to create, save, and return a new access token,
 * or throw an Error if the token could not be saved.  The returned
 * "token" field must be unique.
 *
 * @param expires           JavaScript Date representing the
 *                          date/time this token will expire
 * @param userId            User identifier this token will
 *                          be owned by
 * @param scope             Space-delimited string of scope(s)
 *                          granted to this token
 */
export type CreateAccessToken
    = (expires: Date, scope: string, userId: Identifier)
    => Promise<AccessToken>;

/**
 * Return a promise to create, save, and return a new refresh token,
 * or throw an Error if the token could not be saved.  The returned
 * "token" field must be unique.
 *
 * @param accessToken       Access token value this refresh token
 *                          will be associated with
 * @param expires           JavaScript Date representing the
 *                          date/time this token will expire
 * @param userId            User identifier this will be owned by
 */
export type CreateRefreshToken
    = (accessToken: string, expires: Date, userId: Identifier)
    => Promise<RefreshToken>;

/**
 * Return a promise for the requested access token (if it exists),
 * or throw an Error if it does not exist.  There is no need to confirm
 * that the access token has expired or not.
 *
 * @param token             Access token value to be retrieved
 */
export type RetrieveAccessToken
    = (token: string)
    => Promise<AccessToken>;

/**
 * Return a promise for the requested refresh token (if it exists),
 * or throw an Error if it does not exist.  There is no need to confirm
 * that the access token has expired or not.
 *
 * @param token             Refresh token value to be retrieved
 */
export type RetrieveRefreshToken
    = (token: string)
    => Promise<RefreshToken>;

/**
 * Revoke the requested access token (it it exists), as well as any
 * related refresh tokens.  Otherwise, throw an error.
 *
 * @param token             Access token value to be revoked
 */
export type RevokeAccessToken
    = (token: string)
    => Promise<void>;

