// password.test -------------------------------------------------------------

// Tests for Orchestrator.password() method (via Orchestrator.token()).

// External Modules ----------------------------------------------------------

const chai = require("chai");
const expect = chai.expect;

// Internal Modules ----------------------------------------------------------

import {
    credentialMap,
    resetAll,
    TestOrchestratorHandlers,
} from "./TestOrchestratorHandlers";
import { Orchestrator } from "../Orchestrator";
import {
    PasswordTokenRequest,
    TokenResponse
} from "../types";


const PASSWORD_GRANT_TYPE = "password";
const TOKEN_TYPE = "Bearer";

// Test Globals --------------------------------------------------------------

const orchestrator = new Orchestrator(TestOrchestratorHandlers);

// Test Lifecycle Hooks ------------------------------------------------------

beforeEach(() => {

    resetAll();

});

// Test Suites ---------------------------------------------------------------

describe("Orchestrator.password()", () => {

    it("should fail on incorrect password", async () => {
        try {
            const request: PasswordTokenRequest = {
                grant_type: PASSWORD_GRANT_TYPE,
                password: "invalid",
                username: "betty"
            }
            await orchestrator.token(request);
            expect.fail("Should have thrown invalid credentials error");
        } catch (error) {
            // Expected result
            expect(error.message).equals("credentials: Invalid credentials");
        }
    })

    it("should fail on incorrect username", async () => {
        try {
            const request: PasswordTokenRequest = {
                grant_type: PASSWORD_GRANT_TYPE,
                password: "rubble",
                username: "invalid"
            }
            await orchestrator.token(request);
            expect.fail("Should have thrown invalid credentials error");
        } catch (error) {
            // Expected result
            expect(error.message).equals("credentials: Invalid credentials");
        }
    })

    it("should fail on unauthorized scope", async () => {
        const request: PasswordTokenRequest = {
            grant_type: PASSWORD_GRANT_TYPE,
            password: "flintstone",
            scope: "unavailable",
            username: "fred",
        }
        try {
            await orchestrator.token(request);
            expect.fail("Should have thrown invalid scope error");
        } catch (error) {
            // Expected result
            expect(error.message).equals(`scope: Scope '${request.scope}' not allowed`);
        }
    })

    it("should pass on valid credentials (no requested scope)", async () => {
        const user = credentialMap.get("fred");
        if (!user) {
            throw new Error("test failure - cannot find user 'fred'");
        }
        const request: PasswordTokenRequest = {
            grant_type: PASSWORD_GRANT_TYPE,
            password: "flintstone",
            username: "fred"
        }
        try {
            const response: TokenResponse = await orchestrator.token(request);
            if (!response.refresh_token) {
                expect.fail("Should have returned a refresh token");
            }
            expect(response.scope).equals(user.scope);
            expect(response.token_type).equals(TOKEN_TYPE);
        } catch (error) {
            expect.fail("Should not have thrown " + JSON.stringify(error));
        }
    })

    it("should pass on valid credentials (with requested scope)", async () => {
        const user = credentialMap.get("wilma");
        if (!user) {
            throw new Error("test failure - cannot find user 'wilma'");
        }
        const request: PasswordTokenRequest = {
            grant_type: PASSWORD_GRANT_TYPE,
            password: "flintstone",
            scope: "all",
            username: "wilma"
        }
        try {
            const response: TokenResponse = await orchestrator.token(request);
            if (!response.refresh_token) {
                expect.fail("Should have returned a refresh token");
            }
            expect(response.scope).equals(request.scope);
            expect(response.token_type).equals(TOKEN_TYPE);
        } catch (error) {
            expect.fail("Should not have thrown " + JSON.stringify(error));
        }
    })

})
