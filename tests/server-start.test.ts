import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe( "server startup", () =>
{
    it( "should not reference removed VYRDX route registration", async () =>
    {
        const serverIndexPath = join( process.cwd(), "server/index.ts" );
        const content = await readFile( serverIndexPath, "utf-8" );

        // Verify stale registerVyrdxRoutes call is removed
        expect( content ).not.toContain( "registerVyrdxRoutes" );

        // Verify other removed VYRDX route registrations are gone
        expect( content ).not.toContain( "registerVyrdxGateApiRoutes" );
        expect( content ).not.toContain( "registerVyrdxBusinessMotionRoutes" );
        expect( content ).not.toContain( "registerVyrdxLaunchMonitorRoutes" );
        expect( content ).not.toContain( "registerVyrdxTelemetryRoutes" );
        expect( content ).not.toContain( "registerVyrdxBotFlyerRoutes" );
        expect( content ).not.toContain( "registerVyrdxMarketLaunchRoomRoutes" );
        expect( content ).not.toContain( "registerVyrdxAdditionalRooms" );
        expect( content ).not.toContain( "registerVyrdxContactRoutes" );
        expect( content ).not.toContain( "registerVyrdxApiKeyRoutes" );
        expect( content ).not.toContain( "registerVyrdxV1Routes" );
    } );
} );

// Made with Bob
