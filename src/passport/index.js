import { eq } from "drizzle-orm";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { UserLoginType, UserRolesEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { hashPassword } from "@/models/apps/auth/user.helpers.js";
import { users } from "@/models/apps/auth/user.models.js";
import { ensureUserSideEffects } from "@/models/apps/auth/user.side-effects.js";
import { shapeUser } from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";

/**
 * @param {import("drizzle-orm").NodePgDatabase | import("drizzle-orm/postgres-js").PostgresJsDatabase} db
 * @param {{
 *   email: string;
 *   username: string;
 *   password: string;
 *   avatarUrl?: string;
 *   loginType: string;
 * }} payload
 */
async function createOAuthUser(db, payload) {
  const hashedPassword = await hashPassword(payload.password);

  return db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        email: payload.email.toLowerCase().trim(),
        username: payload.username.toLowerCase().trim(),
        password: hashedPassword,
        isEmailVerified: true,
        role: UserRolesEnum.USER,
        avatarUrl: payload.avatarUrl ?? "https://via.placeholder.com/200x200.png",
        avatarLocalPath: "",
        loginType: payload.loginType,
      })
      .returning();

    if (!createdUser) {
      throw new ApiError(500, "Error while registering the user");
    }

    await ensureUserSideEffects(tx, createdUser.id);
    return shapeUser(createdUser);
  });
}

try {
  passport.serializeUser((user, next) => {
    next(null, user._id ?? user.id);
  });

  passport.deserializeUser(async (id, next) => {
    try {
      if (!dbInstance) {
        next(new ApiError(500, "Database is not connected"), null);
        return;
      }

      const [user] = await dbInstance
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (user) next(null, shapeUser(user));
      else next(new ApiError(404, "User does not exist"), null);
    } catch (error) {
      next(
        new ApiError(
          500,
          "Something went wrong while deserializing the user. Error: " + error
        ),
        null
      );
    }
  });

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_, __, profile, next) => {
        try {
          if (!dbInstance) {
            next(new ApiError(500, "Database is not connected"), null);
            return;
          }

          const email = profile._json.email?.toLowerCase()?.trim();
          if (!email) {
            next(new ApiError(400, "Google account email is missing"), null);
            return;
          }

          const [user] = await dbInstance
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (user) {
            if (user.loginType !== UserLoginType.GOOGLE) {
              next(
                new ApiError(
                  400,
                  "You have previously registered using " +
                    user.loginType?.toLowerCase()?.split("_").join(" ") +
                    ". Please use the " +
                    user.loginType?.toLowerCase()?.split("_").join(" ") +
                    " login option to access your account."
                ),
                null
              );
              return;
            }
            next(null, shapeUser(user));
            return;
          }

          const createdUser = await createOAuthUser(dbInstance, {
            email,
            // Password is unused for SSO; still hashed for schema NOT NULL
            password: profile._json.sub,
            username: email.split("@")[0],
            avatarUrl: profile._json.picture,
            loginType: UserLoginType.GOOGLE,
          });

          next(null, createdUser);
        } catch (error) {
          next(
            error instanceof ApiError
              ? error
              : new ApiError(500, "Error while registering the user"),
            null
          );
        }
      }
    )
  );

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
      },
      async (_, __, profile, next) => {
        try {
          if (!dbInstance) {
            next(new ApiError(500, "Database is not connected"), null);
            return;
          }

          const email = profile._json.email?.toLowerCase()?.trim();

          if (email) {
            const [user] = await dbInstance
              .select()
              .from(users)
              .where(eq(users.email, email))
              .limit(1);

            if (user) {
              if (user.loginType !== UserLoginType.GITHUB) {
                next(
                  new ApiError(
                    400,
                    "You have previously registered using " +
                      user.loginType?.toLowerCase()?.split("_").join(" ") +
                      ". Please use the " +
                      user.loginType?.toLowerCase()?.split("_").join(" ") +
                      " login option to access your account."
                  ),
                  null
                );
                return;
              }
              next(null, shapeUser(user));
              return;
            }
          } else {
            next(
              new ApiError(
                400,
                "User does not have a public email associated with their account. Please try another login method"
              ),
              null
            );
            return;
          }

          const githubUsername = profile?.username?.toLowerCase()?.trim();
          const [userNameExist] = githubUsername
            ? await dbInstance
                .select({ id: users.id })
                .from(users)
                .where(eq(users.username, githubUsername))
                .limit(1)
            : [null];

          const createdUser = await createOAuthUser(dbInstance, {
            email,
            password: profile._json.node_id,
            username: userNameExist
              ? email.split("@")[0]
              : githubUsername || email.split("@")[0],
            avatarUrl: profile._json.avatar_url,
            loginType: UserLoginType.GITHUB,
          });

          next(null, createdUser);
        } catch (error) {
          next(
            error instanceof ApiError
              ? error
              : new ApiError(500, "Error while registering the user"),
            null
          );
        }
      }
    )
  );
} catch (error) {
  console.error("PASSPORT ERROR: ", error);
}
