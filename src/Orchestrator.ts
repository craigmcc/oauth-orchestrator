// Orchestrator ==============================================================

// Concrete orchestration of basic OAuth2 Authorization Server capabilities,
// as well as a mechanism for a Resource Server to validate a token and
// determine whether it meets the requested scope requirements.

// OAuth2 [RFC 6749] Grant Types Supported:
// * Resource Owner Password Credentials Grant [Section 4.3]
// * Refreshing an Access Token [Section 6]
// * Revoking an Access Token [Not specified in the standard]

// This implementation has no notion of whether it is incorporated into a
// web application, or is used with a particular HTTP framework (like Express).
// It is up to the application incorporating this implementation to translate
// from incoming request objets, and to outgoing response objects, that
// correspond to the requirements of the network framework in use.

// Application-specific details are supported by application-supplied handler
// functions that must obey the API contracts specified here.  They are
// configured when an instance of the Orchestrator class is created.

// Internal Modules ==========================================================

import {
    AccessToken,
    OrchestratorHandlers,
    OrchestratorOptions,
    PasswordTokenRequest,
    RefreshToken,
    RefreshTokenRequest,
    TokenRequest,
    TokenResponse,
    User
} from "./types";
import {
    InvalidGrantError,
    InvalidRequestError,
    InvalidScopeError,
    InvalidTokenError,
    OAuthError,
    ServerError,
    UnsupportedGrantTypeError,
} from "./errors";

const SUPERUSER_SCOPE = process.env.SUPERUSER_SCOPE; // null means no such scope

// Public Classes ============================================================

export class Orchestrator {

    accessTokenLifetime: number = 86400;
    handlers: OrchestratorHandlers;
    issueRefreshToken: boolean = true;
    refreshTokenLifetime: number = 604800;

    /**
     * Construct a configured Orchestrator instance.
     *
     * @param handlers  Handler functions for environment specific operations
     * @param options   Optional overrides for default configuration parameters
     */
    constructor (handlers: OrchestratorHandlers, options?: OrchestratorOptions) {
        this.handlers = handlers;
        if (options) {
            if (options.accessTokenLifetime !== undefined) {
                this.accessTokenLifetime = options.accessTokenLifetime;
            }
            if (options.issueRefreshToken !== undefined) {
                this.issueRefreshToken = options.issueRefreshToken;
            }
            if (options.refreshTokenLifetime !== undefined) {
                this.refreshTokenLifetime = options.refreshTokenLifetime;
            }
        }
    }

    // Public Methods --------------------------------------------------------

    /**
     * Return successfully if the requested access token exists, has not
     * expired, and meets the required scope requirements.  Otherwise,
     * throw an appropriate exception.
     *
     * @param token         Access token value to be authorized
     * @param required      Required scope needed by the application
     *
     * @throws InvalidScopeError Access token does not satisfy scope
     * @throws InvalidTokenError Access token does not exist,
     *                           or it has expired
     */
    async authorize(token: string, required: string): Promise<void> {
        let accessToken: AccessToken;
        try {
            accessToken = await this.handlers.retrieveAccessToken(token);
            if ((new Date()) > accessToken.expires) {
                await Promise.reject(new InvalidTokenError("token: Expired access token"));
            }
            if (!this.includedScope(required, accessToken.scope)) {
                await Promise.reject(new InvalidScopeError("scope: Required scope not authorized for this access token"));
            }
            await Promise.resolve();
        } catch (error) {
            if (error instanceof Error) {
                await Promise.reject(error);
            } else {
                await Promise.reject(new InvalidTokenError("token: Missing access token"));
            }
        }
    }

    /**
     * Revoke the specified access token if it exists, along with any
     * related refresh tokens.  Otherwise, throw an appropriate exception
     *
     * @param token         Access token value to be revoked
     */
    async revoke(token: string): Promise<void> {
        try {
            await this.handlers.revokeAccessToken(token);
        } catch (error) {
            throw new InvalidTokenError(error, "Orchestrator.revoke()");
        }
    }

    /**
     * Process a request for an access token (and refresh token, if that option
     * is configured), if the requested grant type is supported.
     *
     * @param request: TokenRequest     Request for token to be processed
     *
     * @returns Promise<TokenResponse>  Response containing resulting tokens
     */

    // Private Methods -------------------------------------------------------

    /**
     * Is the required scope within the bounds of the allowed scope?
     *
     * @param required              Scope to be tested
     * @param allowed               Scope allowed by this token
     */
    private includedScope(
        required: string,
        allowed: string
    ) : boolean {
        // Handle superuser token (if any is configured) specially
        if (SUPERUSER_SCOPE && (allowed.includes(SUPERUSER_SCOPE))) {
            return true;
        }
        // Otherwise, check for allowed
        let requiredScopes: string[]
            = required ? required.split(" ") : [];
        if (requiredScopes.length === 0) {
            return true;
        }
        let allowedScopes: string[]
            = allowed ? allowed.split(" ") : [];
        if (allowedScopes.length === 0) {
            return false;
        }
        let result = true;
        requiredScopes.forEach(requiredScope => {
            let match: boolean = false;
            allowedScopes.forEach(allowedScope => {
                if (requiredScope === allowedScope) {
                    match = true;
                }
            });
            if (!match) {
                result = false;
            }
        });
        return result;
    }

}

export default Orchestrator;
