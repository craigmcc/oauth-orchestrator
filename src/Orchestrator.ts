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
    InvalidScopeError,
    InvalidTokenError,
    OAuthError,
    ServerError,
    UnsupportedGrantTypeError,
} from "./errors";

const PASSWORD_GRANT_TYPE = "password";
const REFRESH_GRANT_TYPE = "refresh_token";
const SUPERUSER_SCOPE = process.env.SUPERUSER_SCOPE; // null means no such scope
const TOKEN_TYPE = "Bearer";

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
     *                      (if "", any scope is allowed)
     *
     * @throws Any error discovered through orchestration, or returned
     *         by a handler
     */
    async authorize(token: string, required: string): Promise<void> {

        let accessToken: AccessToken;

        try {

            // Look up the requested access token
            try {
                accessToken = await this.handlers.retrieveAccessToken(token);
            } catch (error) {
                throw new InvalidTokenError(
                    error as Error,
                    "Orchestrator.authenticate.retrieveAccessToken()"
                );
            }

            // Validate expiration and sufficient scope
            if ((new Date()) > accessToken.expires) {
                throw new InvalidTokenError(
                    "token: Expired access token",
                    "Orchestrator.authenticate.checkExpiration()"
                );
            }
            if (!this.includedScope(required, accessToken.scope)) {
                throw new InvalidScopeError(
                    "scope: Required scope not authorized for this access token",
                    "Orchestrator.authenticate.checkScope()"
                );
            }

        } catch (error) {
            if (error instanceof OAuthError) {
                throw error;
            } else {
                throw new ServerError(
                    error as Error,
                    "Orchestrator.authorize()"
                )
            }
        }
    }

    /**
     * Revoke the specified access token if it exists, along with any
     * related refresh tokens.  Otherwise, throw an appropriate exception
     *
     * @param token         Access token value to be revoked
     *
     * @throws Any error discovered through orchestration, or returned
     *         by a handler
     */
    async revoke(token: string): Promise<void> {

        try {

            await this.handlers.revokeAccessToken(token);

        } catch (error) {
            if (error instanceof OAuthError) {
                throw error;
            } else {
                throw new InvalidTokenError(
                    "token: Invalid access token",
                    "Orchestrator.revoke()"
                );
            }
        }
    }

    /**
     * Process a request for an access token (and refresh token, if that option
     * is configured), if the requested grant type is supported.
     *
     * @param request: TokenRequest     Request for token to be processed
     *
     * @returns Promise<TokenResponse>  Response containing resulting tokens
     *
     * @throws Any error discovered through orchestration, or returned
     *         by a handler
     */
    async token(request: TokenRequest): Promise<TokenResponse> {
        let response: TokenResponse;
        switch (request.grant_type) {
            case PASSWORD_GRANT_TYPE:
                response = await this.password(request as PasswordTokenRequest);
                break;
            case REFRESH_GRANT_TYPE:
                response = await this.refresh(request as RefreshTokenRequest);
                break;
            default:
                throw new UnsupportedGrantTypeError(
                    `grant_type: '${request.grant_type}' is not supported`,
                    "Orchestrator.token()"
                );
        }
        return response;
    }

    // Private Methods -------------------------------------------------------

    /**
     * Calculate and return a token expires Date, based on the current Date
     * and an offset (in seconds).
     *
     * @param offset            Offset (in seconds) from now
     */
    private calculateExpires(offset: number): Date {
        let expiresMilliseconds: number =
            Date.now() + (offset * 1000);
        let now: Date = new Date();
        now.setTime(expiresMilliseconds);
        return now;
    }

    /**
     * Is the required scope within the bounds of the allowed scope?
     * If required scope is "", always returns true.
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
        // Handle "" required scope as meaning it is ok
        if ("" === required) {
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

    /**
     * Process a request for an access token (and refresh token, if that
     * option is configured), given the specified password request parameters.
     *
     * @param request: PasswordTokenRequest Request for token to be processed
     *
     * @returns Promise<TokenResponse>      Response containing resulting tokens
     */
    private async password(request: PasswordTokenRequest): Promise<TokenResponse> {

        let accessToken: AccessToken;
        let refreshToken: RefreshToken;
        let user: User;

        try {

            // Validate requesting user
            try {
                user = await this.handlers.authenticateUser
                    (request.username, request.password);
            } catch (error) {
                throw new InvalidGrantError(error as Error,
                    "Orchestrator.password.authenticateUser()"
                );
            }

            // Validate requested scope (if any)
            let grantedScope: string;
            if (request.scope) {
                if (!this.includedScope(request.scope, user.scope)) {
                    throw new InvalidScopeError(
                        `scope: Scope '${request.scope}' not allowed`,
                        "Orchestrator.password.checkScope()");
                } else {
                    grantedScope = request.scope;
                }
            } else {
                grantedScope = user.scope;
            }

            // Generate the requested access token
            try {
                let expires: Date = this.calculateExpires(this.accessTokenLifetime);
                accessToken = await this.handlers.createAccessToken
                   (expires, grantedScope, user.userId);
            } catch (error) {
                throw new InvalidTokenError(
                    error as Error,
                    "Orchestrator.password.createAccessToken()"
                );
            }

            // Generate the requested refresh token (if any)
            if (this.issueRefreshToken) {
                try {
                    let expires = this.calculateExpires(this.refreshTokenLifetime);
                    refreshToken = await this.handlers.createRefreshToken
                        (accessToken.token, expires, user.userId);
                } catch (error) {
                    throw new InvalidTokenError(
                        error as Error,
                        "Orchestrator.password.createRefreshToken()"
                    );
                }
            }

            // Compose and return the results
            const response: TokenResponse = {
                access_token: accessToken.token,
                expires_in: this.accessTokenLifetime,
                // @ts-ignore
                refresh_token: refreshToken ? refreshToken.token : undefined,
                scope: grantedScope,
                token_type: TOKEN_TYPE,
            }
            return response;

        } catch (error) {
            if (error instanceof OAuthError) {
                throw error;
            } else {
                throw new ServerError(error as Error, "Orchestrator.password()");
            }
        }

    }

    /**
     * Process a request for an access token (and refresh token, if that
     * option is configured), given the specified refresh request parameters.
     *
     * @param request: RefreshTokenRequest  Request for token to be processed
     *
     * @returns Promise<TokenResponse>      Response containing resulting tokens
     */
    private async refresh(request: RefreshTokenRequest): Promise<TokenResponse> {

        let newAccessToken: AccessToken;
        let newRefreshToken: RefreshToken;
        let oldAccessToken: AccessToken;
        let oldRefreshToken: RefreshToken;

        try {

            // Look up the existing refresh token
            try {
                oldRefreshToken = await this.handlers.retrieveRefreshToken
                    (request.refresh_token);
            } catch (error) {
                throw new InvalidTokenError(
                    error as Error,
                    "Orchestrator.refresh.retrieveRefreshToken()"
                );
            }

            // Verify that this token has not expired
            if ((new Date()) > oldRefreshToken.expires) {
                throw new InvalidTokenError(
                    "token: Expired refresh token",
                    "Orchestrator.refresh.checkExpiration()"
                )
            }

            // Look up the corresponding access token
            try {
                oldAccessToken = await this.handlers.retrieveAccessToken
                    (oldRefreshToken.accessToken);
            } catch (error) {
                throw new InvalidTokenError(
                    error as Error,
                    "Orchestrator.refresh.retrieveAccessToken()"
                )
            }
            // We do not care if the access token has expired (since we
            // are going to create a new one), but we do care that it exists
            // so that we can forward the scope and userId information

            // Generate a new access token
            try {
                let expires: Date =
                    this.calculateExpires(this.accessTokenLifetime);
                newAccessToken = await this.handlers.createAccessToken
                        (expires, oldAccessToken.scope, oldAccessToken.userId);
            } catch (error) {
                throw new InvalidTokenError(
                    error as Error,
                    "Orchestrator.refresh.createAccessToken()"
                );
            }

            // If configured, generate a new refresh token
            if (this.issueRefreshToken) {
                try {
                    let expires: Date
                        = this.calculateExpires(this.refreshTokenLifetime);
                    newRefreshToken = await this.handlers.createRefreshToken
                        (newAccessToken.token, expires, oldAccessToken.userId);
                } catch (error) {
                    throw new InvalidTokenError(
                        error as Error,
                        "Orchestrator.refresh.createRefreshToken()"
                    );
                }
            }

            // Revoke the old access token (and any associated refresh tokens)
            try {
                await this.handlers.revokeAccessToken(oldAccessToken.token);
            } catch (error) {
                // NOTE - Should we throw, or just note it and return the new stuff?
                throw new InvalidTokenError(
                    error as Error,
                    "Orchestrator.refresh.revokeAccessToken()"
                );
            }

            // Compose and return the response
            const response: TokenResponse = {
                access_token: newAccessToken.token,
                expires_in: this.accessTokenLifetime,
                // @ts-ignore
                refresh_token: newRefreshToken ? newRefreshToken.token : undefined,
                scope: newAccessToken.scope,
                token_type: TOKEN_TYPE,
            }
            return response;

        } catch (error) {
            if (error instanceof OAuthError) {
                throw error;
            } else {
                throw new ServerError(error as Error, "Orchestrator.refresh()");
            }
        }

    }

}

export default Orchestrator;
