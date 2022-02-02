// authorize.test ------------------------------------------------------------

// Tests for Orchestrator.authorize() method

// External Modules ----------------------------------------------------------

const chai = require("chai");
const expect = chai.expect;

// Internal Modules ----------------------------------------------------------

import {
    accessTokenMap,
    resetAll,
    TestOrchestratorHandlers,
} from "./TestOrchestratorHandlers";
import { Orchestrator } from "../Orchestrator";
import { AccessToken } from "../types";

// Test Globals --------------------------------------------------------------

const orchestrator = new Orchestrator(TestOrchestratorHandlers);

// Test Lifecycle Hooks ------------------------------------------------------

beforeEach(() => {

    resetAll();

});

// Test Suites ---------------------------------------------------------------

describe("Orchestrator.authorize()", () => {

    it("should fail on expired access token", async () => {
        const TOKEN: string = "access1";
        const accessToken: AccessToken | undefined = accessTokenMap.get(TOKEN);
        if (accessToken) {
            try {
                accessToken.expires = new Date("2020-07-04T12:00:00Z");
                await orchestrator.authorize(accessToken.token, accessToken.scope);
                expect.fail(`Should have rejected expired token ${TOKEN}`);
            } catch (error) {
                // Expected result
                expect((error as Error).message).equals(`token: Expired access token`);
            }
        } else {
            expect.fail(`Should have retrieved access token ${TOKEN}`);
        }
    })

    it("should fail on invalid access token", async () => {
        const TOKEN: string = "invalid";
        try {
            await orchestrator.authorize(TOKEN, "all");
            expect.fail(`Should have rejected invalid token ${TOKEN}`);
        } catch (error) {
            // Expected result
            expect((error as Error).message).equals(`token: Invalid access token`);
        }
    })

    it("should fail on invalid scope", async () => {
        const TOKEN: string = "access2";
        const accessToken: AccessToken | undefined = accessTokenMap.get(TOKEN);
        if (accessToken) {
            try {
                accessToken.expires = new Date("2099-07-04T12:00:00Z");
                await orchestrator.authorize(TOKEN, "invalid");
                expect.fail(`Should have rejected scope error on token ${TOKEN}`);
            } catch (error) {
                // Expected result
                expect((error as Error).message).equals(`scope: Required scope not authorized for this access token`);
            }
        } else {
            expect.fail(`Should have retrieved access token ${TOKEN}`);
        }
    })

    it("should handle server error", async () => {
        const TOKEN: string = "oops";
        try {
            await orchestrator.authorize(TOKEN, "all");
            expect.fail(`Test should have thrown error`);
        } catch (error) {
            // Expected result
            expect((error as Error).message).equals(`retrieveAccessToken: oops`);
        }
    })

    it("should pass on 'all' scope", async () => {
        const TOKEN: string = "access3";
        const SCOPE: string = "all";
        const accessToken: AccessToken | undefined = accessTokenMap.get(TOKEN);
        if (accessToken) {
            try {
                accessToken.expires = new Date("2099-07-04T12:00:00Z");
                await orchestrator.authorize(TOKEN, SCOPE);
                // Expected result
            } catch (error) {
                expect.fail("Should not have thrown " + JSON.stringify(error));
            }
        } else {
            expect.fail(`Should have retrieved access token ${TOKEN}`);
        }
    })

    it("should pass on valid scope", async () => {
        const TOKEN: string = "access3";
        const accessToken: AccessToken | undefined = accessTokenMap.get(TOKEN);
        if (accessToken) {
            try {
                accessToken.expires = new Date("2099-07-04T12:00:00Z");
                await orchestrator.authorize(TOKEN, accessToken.scope);
                // Expected result
            } catch (error) {
                expect.fail("Should not have thrown " + JSON.stringify(error));
            }
        } else {
            expect.fail(`Should have retrieved access token ${TOKEN}`);
        }
    })

});
