import { eq } from "drizzle-orm";
import { carts } from "@/models/apps/ecommerce/cart.models.js";
import { ecomProfiles } from "@/models/apps/ecommerce/profile.models.js";
import { socialProfiles } from "@/models/apps/social-media/profile.models.js";

/**
 * Ensure related ecommerce cart/profile + social profile rows exist after user create.
 * Call from auth controllers after inserting a user.
 *
 * @param {import("drizzle-orm").NodePgDatabase | import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {string} userId
 */
export async function ensureUserSideEffects(db, userId) {
  const [ecomProfile] = await db
    .select({ id: ecomProfiles.id })
    .from(ecomProfiles)
    .where(eq(ecomProfiles.owner, userId))
    .limit(1);

  if (!ecomProfile) {
    await db.insert(ecomProfiles).values({ owner: userId });
  }

  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.owner, userId))
    .limit(1);

  if (!cart) {
    await db.insert(carts).values({ owner: userId });
  }

  const [socialProfile] = await db
    .select({ id: socialProfiles.id })
    .from(socialProfiles)
    .where(eq(socialProfiles.owner, userId))
    .limit(1);

  if (!socialProfile) {
    await db.insert(socialProfiles).values({ owner: userId });
  }
}
