import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { USER_TEMPORARY_TOKEN_EXPIRY } from "@/constants.js";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function isPasswordCorrect(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function generateAccessToken(user) {
  return jwt.sign(
    {
      _id: user.id ?? user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    {
      _id: user.id ?? user._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * @description Tokens for email verification / password reset.
 */
export function generateTemporaryToken() {
  const unHashedToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");
  const tokenExpiry = Date.now() + USER_TEMPORARY_TOKEN_EXPIRY;

  return { unHashedToken, hashedToken, tokenExpiry };
}
