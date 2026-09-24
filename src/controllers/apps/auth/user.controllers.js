import crypto from "crypto";
import { and, eq, gt, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { UserLoginType, UserRolesEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateTemporaryToken,
  hashPassword,
  isPasswordCorrect,
} from "@/models/apps/auth/user.helpers.js";
import { users } from "@/models/apps/auth/user.models.js";
import { ensureUserSideEffects } from "@/models/apps/auth/user.side-effects.js";
import { shapeUser } from "@/models/serializers.js";
import { ApiError } from "@/utils/ApiError.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "@/utils/helpers.js";
import { CLIENT_PATHS, getClientUrl } from "@/utils/clientUrls.js";
import {
  RESEND_TEMPLATE_ALIASES,
  emailVerificationTemplateVariables,
  resetPasswordTemplateVariables,
  sendEmail,
} from "@/utils/mail.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

const requireDb = () => {
  if (!dbInstance) {
    throw new ApiError(500, "Database is not connected");
  }
  return dbInstance;
};

/**
 * @param {string} userId
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const db = requireDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await db
      .update(users)
      .set({ refreshToken })
      .where(eq(users.id, userId));

    return { accessToken, refreshToken };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      "Something went wrong while generating the access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { email, username, password, role } = req.body;
  const db = requireDb();

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.toLowerCase().trim();

  const [existedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        eq(users.username, normalizedUsername),
        eq(users.email, normalizedEmail)
      )
    )
    .limit(1);

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }

  const hashedPassword = await hashPassword(password);
  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken();

  const createdUser = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: normalizedEmail,
        username: normalizedUsername,
        password: hashedPassword,
        isEmailVerified: false,
        role: role || UserRolesEnum.USER,
        emailVerificationToken: hashedToken,
        emailVerificationExpiry: new Date(tokenExpiry),
      })
      .returning();

    if (!user) {
      throw new ApiError(500, "Something went wrong while registering the user");
    }

    await ensureUserSideEffects(tx, user.id);
    return user;
  });

  await sendEmail({
    email: createdUser.email,
    subject: "Please verify your email",
    templateId: RESEND_TEMPLATE_ALIASES.emailVerification,
    variables: emailVerificationTemplateVariables(
      createdUser.username,
      // Frontend page that verifies the token and shows a success/error screen
      getClientUrl(CLIENT_PATHS.verifyEmail, { token: unHashedToken })
    ),
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { user: shapeUser(createdUser) },
        "Users registered successfully and verification email has been sent on your email."
      )
    );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const db = requireDb();

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  /** @type {import("drizzle-orm").SQL[]} */
  const identityFilters = [];
  if (username) {
    identityFilters.push(eq(users.username, username.toLowerCase().trim()));
  }
  if (email) {
    identityFilters.push(eq(users.email, email.toLowerCase().trim()));
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(...identityFilters))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  if (user.loginType !== UserLoginType.EMAIL_PASSWORD) {
    // If user is registered with some other method, require that same method.
    throw new ApiError(
      400,
      "You have previously registered using " +
        user.loginType?.toLowerCase() +
        ". Please use the " +
        user.loginType?.toLowerCase() +
        " login option to access your account."
    );
  }

  const isPasswordValid = await isPasswordCorrect(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user.id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: shapeUser(user),
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const db = requireDb();

  await db
    .update(users)
    .set({ refreshToken: null })
    .where(eq(users.id, req.user._id));

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out"));
});

/**
 * Browser navigations prefer HTML; curl / fetch with Accept: application/json stay JSON.
 * Lets legacy API verification links land on the UI instead of a raw JSON blob.
 */
const prefersHtmlResponse = (req) => req.accepts(["html", "json"]) === "html";

const emailVerificationUiRedirect = (status, message) =>
  getClientUrl(CLIENT_PATHS.verifyEmail, { status, message });

const verifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.params;
  const db = requireDb();
  const asHtml = prefersHtmlResponse(req);

  if (!verificationToken) {
    if (asHtml) {
      return res.redirect(
        emailVerificationUiRedirect("error", "Email verification token is missing")
      );
    }
    throw new ApiError(400, "Email verification token is missing");
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.emailVerificationToken, hashedToken),
        gt(users.emailVerificationExpiry, new Date())
      )
    )
    .limit(1);

  if (!user) {
    if (asHtml) {
      return res.redirect(
        emailVerificationUiRedirect("error", "Token is invalid or expired")
      );
    }
    throw new ApiError(489, "Token is invalid or expired");
  }

  await db
    .update(users)
    .set({
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      isEmailVerified: true,
    })
    .where(eq(users.id, user.id));

  if (asHtml) {
    return res.redirect(emailVerificationUiRedirect("success"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { isEmailVerified: true }, "Email is verified"));
});

const resendEmailVerification = asyncHandler(async (req, res) => {
  const db = requireDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user?._id))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  if (user.isEmailVerified) {
    throw new ApiError(409, "Email is already verified!");
  }

  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken();

  await db
    .update(users)
    .set({
      emailVerificationToken: hashedToken,
      emailVerificationExpiry: new Date(tokenExpiry),
    })
    .where(eq(users.id, user.id));

  await sendEmail({
    email: user.email,
    subject: "Please verify your email",
    templateId: RESEND_TEMPLATE_ALIASES.emailVerification,
    variables: emailVerificationTemplateVariables(
      user.username,
      getClientUrl(CLIENT_PATHS.verifyEmail, { token: unHashedToken })
    ),
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Mail has been sent to your mail ID"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const db = requireDb();
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decodedToken?._id))
      .limit(1);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user.id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const db = requireDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  const { unHashedToken, hashedToken, tokenExpiry } = generateTemporaryToken();

  await db
    .update(users)
    .set({
      forgotPasswordToken: hashedToken,
      forgotPasswordExpiry: new Date(tokenExpiry),
    })
    .where(eq(users.id, user.id));

  await sendEmail({
    email: user.email,
    subject: "Password reset request",
    templateId: RESEND_TEMPLATE_ALIASES.resetPassword,
    variables: resetPasswordTemplateVariables(
      user.username,
      // Frontend page that collects the new password and posts to reset-password
      getClientUrl(CLIENT_PATHS.forgotPassword, { token: unHashedToken })
    ),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Password reset mail has been sent on your mail id"
      )
    );
});

const resetForgottenPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;
  const db = requireDb();

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.forgotPasswordToken, hashedToken),
        gt(users.forgotPasswordExpiry, new Date())
      )
    )
    .limit(1);

  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      forgotPasswordToken: null,
      forgotPasswordExpiry: null,
      password: hashedPassword,
    })
    .where(eq(users.id, user.id));

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const db = requireDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user?._id))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await isPasswordCorrect(oldPassword, user.password);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid old password");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ password: hashedPassword })
    .where(eq(users.id, user.id));

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const assignRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  const db = requireDb();

  const [user] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Role changed for the user"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const handleSocialLogin = asyncHandler(async (req, res) => {
  const db = requireDb();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, req.user?._id))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user.id
  );

  return res
    .status(301)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .redirect(
      getClientUrl(CLIENT_PATHS.profile, { accessToken, refreshToken })
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  if (!req.file?.filename) {
    throw new ApiError(400, "Avatar image is required");
  }

  const db = requireDb();
  const avatarUrl = getStaticFilePath(req, req.file.filename);
  const avatarLocalPath = getLocalPath(req.file.filename);

  const [existing] = await db
    .select({
      id: users.id,
      avatarLocalPath: users.avatarLocalPath,
    })
    .from(users)
    .where(eq(users.id, req.user._id))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "User does not exist");
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      avatarUrl,
      avatarLocalPath,
    })
    .where(eq(users.id, existing.id))
    .returning();

  removeLocalFile(existing.avatarLocalPath);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        shapeUser(updatedUser),
        "Avatar updated successfully"
      )
    );
});

export {
  assignRole,
  changeCurrentPassword,
  forgotPasswordRequest,
  getCurrentUser,
  handleSocialLogin,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resendEmailVerification,
  resetForgottenPassword,
  updateUserAvatar,
  verifyEmail,
};
