import { assertSafeTestDatabase } from "./database-safety.js";

// Runs before test modules are loaded, so even a test-local reset cannot bypass the guard.
assertSafeTestDatabase();
