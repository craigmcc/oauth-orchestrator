// errors --------------------------------------------------------------------

// Classes defining OAuth2 errors that can be returned by this library
// or by the handlers it is configured to use.

// Base Error Class ----------------------------------------------------------

export type Source = string | Error;

/**
 * Abstract base class for all errors used in this library.  Developers should
 * utilize the specific error subclasses for each specific use case.
 *
 * @param source                A string message or an Error to be wrapped
 * @param context               Additional context for this error
 * @param status                HTTP status code (if this error is returned)
 */
export abstract class OAuthError extends Error {

    constructor(source: Source, context?: string) {
        super(source instanceof Error ? source.message : source);
        this.inner = source instanceof Error ? source : undefined;
        this.error = "oauth_error";
        this.error_description = (source instanceof Error) ? source.message : source;
        this.status = 500;
    }

    context: string | undefined;
    inner: Error | undefined;
    error: string;
    error_description: string;
    status: number;

}

// Specific Error Classes ----------------------------------------------------

/**
 * The request has invalid/expired credentials, authorization code,
 * or refresh token.
 */
export class InvalidGrantError extends OAuthError {
    constructor(source: Source, context?: string) {
        super(source, context);
    }
    error = "invalid_grant";
    status = 401; // TODO - some implementations say 400?
}

/**
 * The request has a missing or invalid parameter.
 */
export class InvalidRequestError extends OAuthError {
    constructor(source: Source, context?: string) {
        super(source, context);
    }

    error = "invalid_request";
    status = 400;
}

/**
 * The requested scope is invalid, unknown, malformed, or
 * extends the scope granted by the resource owner.
 */
export class InvalidScopeError extends OAuthError {
    constructor(source: Source, context?: string) {
        super(source, context);
    }
    error = "invalid_scope";
    status = 403;
}

/**
 * The requested access or refresh token is expired, revoked, or does not exist.
 */
export class InvalidTokenError extends OAuthError {
    constructor(source: Source, context?: string) {
        super(source, context);
    }
    error = "invalid_token";
    status = 401;
}

/**
 * An uncaught Error from some function was caught, and is being passed
 * on to the caller.
 */
export class ServerError extends OAuthError {
    constructor(source: Source, context?: string) {
        super(source, context);
    }
    error = "server_error";
    status = 500;
}

/**
 * The requested grant type is not supported by this server.
 */
export class UnsupportedGrantTypeError extends OAuthError {
    constructor(source: Source, context?: string) {
        super(source, context);
    }
    error = "unsupported_grant_type";
    status = 400;
}

