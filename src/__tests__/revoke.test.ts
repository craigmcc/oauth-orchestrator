// revoke.test ---------------------------------------------------------------

// Tests for Orchestrator.revoke() method.

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

// Test Globals --------------------------------------------------------------

const orchestrator = new Orchestrator(TestOrchestratorHandlers);

// Test Lifecycle Hooks ------------------------------------------------------

beforeEach(() => {

    resetAll();

});

// Test Suites ---------------------------------------------------------------

describe("Orchestrator.revoke()", () => {

    it("should fail on invalid access token", async () => {
        const TOKEN: string = "invalid";
        try {
            await orchestrator.revoke(TOKEN);
            expect.fail("Should have rejected invalid access token");
        } catch (error) {
            // Expected result
            expect((error as Error).message).equals(`token: Invalid access token`);
        }
    })

    it("should pass on valid access token", async () => {
        const TOKEN: string = "access1";
        try {
            await orchestrator.revoke(TOKEN);
        } catch (error) {
            expect.fail("Should not have thrown "
                + JSON.stringify(error));
        }
    })

    it("should pass on clean up after successful revoke", async () => {
        const TOKEN: string = "access2";
        try {
            await orchestrator.revoke(TOKEN);
            const afterwards = accessTokenMap.get(TOKEN);
            if (afterwards) {
                expect.fail(`Should have removed access token ${TOKEN}`);
            }
            refreshTokenMap.forEach(refreshToken => {
                if (refreshToken.accessToken === TOKEN) {
                    expect.fail(`Should have removed refresh token ${refreshToken.token}`);
                }
            })
        } catch (error) {
            expect.fail("Should not have thrown "
                + JSON.stringify(error));
        }
    })

})
