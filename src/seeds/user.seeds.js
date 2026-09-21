import { faker } from "@faker-js/faker";
import { count } from "drizzle-orm";
import fs from "fs";
import { AvailableUserRoles, UserRolesEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { hashPassword } from "@/models/apps/auth/user.helpers.js";
import { users } from "@/models/apps/auth/user.models.js";
import { ensureUserSideEffects } from "@/models/apps/auth/user.side-effects.js";
import { carts } from "@/models/apps/ecommerce/cart.models.js";
import { ecomProfiles } from "@/models/apps/ecommerce/profile.models.js";
import { socialProfiles } from "@/models/apps/social-media/profile.models.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { getRandomNumber, removeLocalFile } from "@/utils/helpers.js";
import { USERS_COUNT } from "@/seeds/_constants.js";

// Array of fake users (plain passwords kept for seed-credentials.json).
// First user is always ADMIN — ecommerce seed requires an admin owner.
const seedUserBlueprints = new Array(USERS_COUNT).fill("_").map((_, index) => ({
  avatarUrl: faker.image.avatar(),
  avatarLocalPath: "",
  username: faker.internet.userName().toLowerCase(),
  email: faker.internet.email().toLowerCase(),
  password: faker.internet.password(),
  isEmailVerified: true,
  role:
    index === 0
      ? UserRolesEnum.ADMIN
      : AvailableUserRoles[getRandomNumber(2)],
}));

/**
 * @description Seeding middleware for users api which other api services can use which are dependent on users
 */
const seedUsers = asyncHandler(async (req, res, next) => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }

  const [userCountRow] = await dbInstance
    .select({ value: count() })
    .from(users);
  const userCount = Number(userCountRow?.value ?? 0);

  if (userCount >= USERS_COUNT) {
    // Don't re-generate the users if we already have them in the database
    next();
    return;
  }

  // Wipe prior seed users + dependent profiles/carts (FK-safe via owner deletes).
  // Domain seed cleanup for other tables is handled by those seed modules / reset-db.
  await dbInstance.delete(carts);
  await dbInstance.delete(ecomProfiles);
  await dbInstance.delete(socialProfiles);
  await dbInstance.delete(users);

  removeLocalFile("./public/temp/seed-credentials.json"); // remove old credentials

  const credentials = [];

  for (const blueprint of seedUserBlueprints) {
    credentials.push({
      username: blueprint.username,
      password: blueprint.password,
      role: blueprint.role,
    });

    const hashedPassword = await hashPassword(blueprint.password);

    await dbInstance.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          avatarUrl: blueprint.avatarUrl,
          avatarLocalPath: blueprint.avatarLocalPath,
          username: blueprint.username,
          email: blueprint.email,
          password: hashedPassword,
          isEmailVerified: blueprint.isEmailVerified,
          role: blueprint.role,
        })
        .returning({ id: users.id });

      if (!created?.id) {
        throw new ApiError(500, "Failed to seed user");
      }

      await ensureUserSideEffects(tx, created.id);
    });
  }

  // Once users are created dump the credentials to the json file
  const json = JSON.stringify(credentials);

  fs.writeFileSync("./public/temp/seed-credentials.json", json, "utf8");

  // proceed with the request
  next();
});

/**
 * @description This api gives the saved credentials generated while seeding.
 */
const getGeneratedCredentials = asyncHandler(async (req, res) => {
  try {
    const json = fs.readFileSync("./public/temp/seed-credentials.json", "utf8");
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          JSON.parse(json),
          "Dummy credentials fetched successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      404,
      "No credentials generated yet. Make sure you have seeded social media or ecommerce api data first which generates users as dependencies."
    );
  }
});

export { getGeneratedCredentials, seedUsers };
