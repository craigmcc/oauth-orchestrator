// TestOrchestratorHandlers ==================================================

// OrchestratorHandlers implementation for tests.

// Internal Modules ==========================================================

import {
    AccessToken,
    AuthenticateUser,
    CreateAccessToken,
    CreateRefreshToken,
    Identifier,
    OrchestratorHandlers,
    RefreshToken,
    RetrieveAccessToken,
    RetrieveRefreshToken,
    RevokeAccessToken,
    User
} from "../types";

// Private Objects ===========================================================

const authenticateUser: AuthenticateUser
    = async (username: string, password: string): Promise<User> =>
{
    const credential: Credential | undefined = credentialMap.get(username);
    if (credential) {
        if (password === credential.password) {
            const user: User = {
                scope: credential.scope,
                userId: credential.userId
            }
            return user;
        } else {
            throw new Error(`credentials: Invalid credentials`);
        }
    } else {
        throw new Error(`credentials: Invalid credentials`);
    }
}

const createAccessToken: CreateAccessToken
    = async (expires: Date, scope: string, userId: Identifier): Promise<AccessToken> =>
{
    const accessToken: AccessToken = {
        expires: expires,
        scope: scope,
        token: "access" + (++nextAccessTokenId),
        userId: userId
    }
    accessTokenMap.set(accessToken.token, accessToken);
    return accessToken;
}

const createRefreshToken: CreateRefreshToken
    = async (accessToken: string, expires: Date, userId: Identifier): Promise<RefreshToken> =>
{
    const refreshToken: RefreshToken = {
        accessToken: accessToken,
        expires: expires,
        token: "refresh" + (++nextRefreshTokenId),
        userId: userId
    }
    refreshTokenMap.set(refreshToken.token, refreshToken);
    return refreshToken;
}

const retrieveAccessToken: RetrieveAccessToken
    = async (token: string): Promise<AccessToken> =>
{
    // Dummy to force error handling
    if ("oops" === token) {
        throw new Error("retrieveAccessToken: oops");
    }
    // Normal lookup
    const accessToken: AccessToken | undefined = accessTokenMap.get(token);
    if (accessToken) {
        return accessToken;
    } else {
        throw new Error(`retrieveAccessToken: Missing token ${token}`);
    }
}

const retrieveRefreshToken: RetrieveRefreshToken
    = async (token: string): Promise<RefreshToken> =>
{
    // Dummy to force error handling
    if ("oops" === token) {
        throw new Error("retrieveRefreshToken: oops");
    }
    // Normal lookup
    const refreshToken: RefreshToken | undefined = refreshTokenMap.get(token);
    if (refreshToken) {
        return refreshToken;
    } else {
        throw new Error(`retrieveRefreshToken: Missing token ${token}`);
    }
}

const revokeAccessToken: RevokeAccessToken
    = async (token: string): Promise<void> =>
{
    if (accessTokenMap.delete(token)) {
        let refreshTokens: RefreshToken[] = [];
        for (let refreshToken of refreshTokenMap.values()) {
            refreshTokens.push(refreshToken);
        }
        refreshTokens.forEach(refreshToken => {
            if (token === refreshToken.accessToken) {
                refreshTokenMap.delete(refreshToken.token);
            }
        });
        return;
    } else {
        throw new Error(`revokeAccessToken: Missing token ${token}`);
    }
}

// Public Objects ============================================================

export const TestOrchestratorHandlers: OrchestratorHandlers = {
    authenticateUser: authenticateUser,
    createAccessToken: createAccessToken,
    createRefreshToken: createRefreshToken,
    retrieveAccessToken: retrieveAccessToken,
    retrieveRefreshToken: retrieveRefreshToken,
    revokeAccessToken: revokeAccessToken,
}

export default TestOrchestratorHandlers;

// Test Data =================================================================

export interface Credential extends User {
    password: string;
    username: string;
}

let nextAccessTokenId: number = 0;
let nextRefreshTokenId: number = 0;

export const credentialMap : Map<string, Credential>
    = new Map<string, Credential>(); // key = username
export const accessTokenMap : Map<string, AccessToken>
    = new Map<string, AccessToken>(); // key = token
export const refreshTokenMap : Map<string, RefreshToken>
    = new Map<string, RefreshToken>(); // key = token

// Clear all internal data
export const clearAll = () : void => {
    credentialMap.clear();
    accessTokenMap.clear();
    refreshTokenMap.clear();
    nextAccessTokenId = 0;
    nextRefreshTokenId = 0;
}

// Clear and repopulate with dummy data
export const resetAll = () : void => {

    clearAll();

    // Set up valid users (ALL users must have "all" scope
    credentialMap.set("barney", {
        password: "rubble",
        scope: "rubbles all",
        userId: "barney",
        username: "barney",
    });
    credentialMap.set("betty", {
        password: "rubble",
        scope: "rubbles all",
        userId: "betty",
        username: "betty",
    });
    credentialMap.set("fred", {
        password: "flintstone",
        scope: "all flintstones",
        userId: "fred",
        username: "fred",
    });
    credentialMap.set("wilma", {
        password: "flintstone",
        scope: "all flintstones",
        userId: "wilma",
        username: "wilma",
    });
    credentialMap.set("mister", {
        password: "slate",
        scope: "flintstones all rubbles",
        userId: "slate",
        username: "slate",
    });

    // Set up an access token for each user with their default scope values
    const accessTokenExpires: Date = new Date(); // TODO - add offset
    credentialMap.forEach(credential => {
        createAccessToken(
            accessTokenExpires,
            credential.scope,
            credential.userId
        );
    });

    // Set up a refresh token for each access token
    const refreshTokenExpires: Date = new Date(); // TODO - add offset
    accessTokenMap.forEach(accessToken => {
        createRefreshToken(
            accessToken.token,
            refreshTokenExpires,
            accessToken.userId
        );
    });

}
