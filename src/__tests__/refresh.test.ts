// refresh.test --------------------------------------------------------------

// Tests for Orchestrator.refresh() method (via Orchestrator.token()).

// External Modules ----------------------------------------------------------

const chai = require("chai");
const expect = chai.expect;

// Internal Modules ----------------------------------------------------------

import {
    accessTokenMap,
    refreshTokenMap,
    resetAll,
    TestOrchestratorHandlers,
} from "./TestOrchestratorHandlers";
import { Orchestrator } from "../Orchestrator";
import {
    AccessToken,
    RefreshToken,
    RefreshTokenRequest,
    TokenResponse
} from "../types";


const REFRESH_GRANT_TYPE = "refresh_token";
const TOKEN_TYPE = "Bearer";

// Test Globals --------------------------------------------------------------

const orchestrator = new Orchestrator(TestOrchestratorHandlers);

// Test Lifecycle Hooks ------------------------------------------------------

beforeEach(() => {

    resetAll();

});

// Test Suites ---------------------------------------------------------------

describe("Orchestrator.refresh()", () => {

    it("should fail on expired refresh token", async () => {
        const TOKEN = "refresh1";
        let refreshToken: RefreshToken | undefined
            = refreshTokenMap.get(TOKEN);
        if (refreshToken) {
            refreshToken.expires = new Date("2020-07-04T12:00:00Z");
            refreshTokenMap.set(TOKEN, refreshToken);
        } else {
            expect.fail(`Test error:  Cannot find refresh token '${TOKEN}'`);
        }
        const request: RefreshTokenRequest = {
            grant_type: REFRESH_GRANT_TYPE,
            refresh_token: TOKEN
        }
        try {
            await orchestrator.token(request);
            expect.fail("Should have thrown expired refresh token error");
        } catch (error) {
            // Expected result
            expect((error as Error).message).equals("token: Expired refresh token");
        }
    })

    it("should fail on invalid refresh token", async () => {
        const TOKEN = "invalid";
        const request: RefreshTokenRequest = {
            grant_type: REFRESH_GRANT_TYPE,
            refresh_token: TOKEN
        }
        try {
            await orchestrator.token(request);
            expect.fail("Should have thrown invalid refresh token error");
        } catch (error) {
            // Expected result
            expect((error as Error).message).equals("token: Invalid refresh token");
        }
    })

    it("should fail on invalid access token", async () => {
        const TOKEN = "refresh2";
        const refreshToken: RefreshToken | undefined
            = refreshTokenMap.get(TOKEN);
        if (refreshToken) {
            refreshToken.expires = new Date("2099-07-04T12:00:00Z");
            refreshTokenMap.set(TOKEN, refreshToken);
            accessTokenMap.delete(refreshToken.accessToken);
        } else {
            expect.fail(`Test error:  Cannot find refresh token '${TOKEN}'`);
        }
        const request: RefreshTokenRequest = {
            grant_type: REFRESH_GRANT_TYPE,
            refresh_token: TOKEN
        }
        try {
            await orchestrator.token(request);
            expect.fail("Should have thrown invalid access token error");
        } catch (error) {
            // Expected result
            expect((error as Error).message).equals("token: Invalid access token");
        }

    })

    it("should pass on valid refresh and access token", async () => {

        // Look up our existing tokens
        const TOKEN = "refresh3";
        let oldAccessToken: AccessToken | undefined
        const oldRefreshToken: RefreshToken | undefined
            = refreshTokenMap.get(TOKEN);
        if (oldRefreshToken) {
            oldRefreshToken.expires = new Date("2099-07-04T12:00:00Z");
            refreshTokenMap.set(TOKEN, oldRefreshToken);
            oldAccessToken = accessTokenMap.get(oldRefreshToken.accessToken);
            if (!oldAccessToken) {
                expect.fail(`Test error: Cannot find old access token ${oldRefreshToken.accessToken}`);
            }
        } else {
            expect.fail(`Test error:  Cannot find old refresh token '${TOKEN}'`);
        }

        // Perform the refresh operation
        const request: RefreshTokenRequest = {
            grant_type: REFRESH_GRANT_TYPE,
            // @ts-ignore
            refresh_token: oldRefreshToken?.token
        }
        let response: TokenResponse;
        try {
            response = await orchestrator.token(request);
            expect(response.token_type).equals(TOKEN_TYPE);
        } catch (error) {
            expect.fail("Should not have thrown " + JSON.stringify(error));
        }

        // Validate that the old tokens got revoked
        // @ts-ignore
        expect(accessTokenMap.get(oldAccessToken.token) === undefined).equals(true);
        // @ts-ignore
        expect(refreshTokenMap.get(oldRefreshToken.token) === undefined).equals(true);

        // Validate that the new tokens got created
        const newRefreshToken: RefreshToken | undefined
            // @ts-ignore - we know refresh tokens are configured
            = refreshTokenMap.get(response.refresh_token);
        if (!newRefreshToken) {
            // @ts-ignore
            expect.fail(`Test error:  Cannot find new refresh token ${response.refresh_token}`);
        }
        const newAccessToken: AccessToken | undefined
            // @ts-ignore
            = accessTokenMap.get(newRefreshToken.accessToken);
        if (!newAccessToken) {
            expect.fail(`Test error:  Cannot find new access token ${newRefreshToken?.accessToken}`);
        }

        // Validate that the appropriate values got forwarded
        // @ts-ignore
        expect(newRefreshToken.userId).equals(oldRefreshToken.userId);
        // @ts-ignore
        expect(newAccessToken.userId).equals(oldAccessToken.userId);
        // @ts-ignore
        expect(newAccessToken.userId).equals(newRefreshToken.userId);
        // @ts-ignore
        expect(newAccessToken.scope).equals(oldAccessToken.scope);

    })

})
