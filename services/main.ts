import app from "@adonisjs/core/services/app";
import type { Datatables } from "../src/datatables.js";

let datatables: Datatables;

/**
 * Returns a singleton instance of the datatables from the
 * container
 */
await app.booted(async () => {
  datatables = await app.container.make("datatables");
});

export { datatables as default };
