/**
 * Assemble / normalize row shapes for API JSON (`_id`, nested media).
 */

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {Record<string, unknown> | null}
 */
export function withId(row) {
  if (!row) return null;
  const { id, ...rest } = row;
  return { _id: id, ...rest };
}

/**
 * @param {{ avatarUrl?: string, avatarLocalPath?: string } & Record<string, unknown>} user
 */
export function shapeUser(user) {
  if (!user) return null;
  const {
    id,
    avatarUrl,
    avatarLocalPath,
    password,
    refreshToken,
    forgotPasswordToken,
    forgotPasswordExpiry,
    emailVerificationToken,
    emailVerificationExpiry,
    ...rest
  } = user;

  return {
    _id: id,
    avatar: {
      url: avatarUrl ?? "https://via.placeholder.com/200x200.png",
      localPath: avatarLocalPath ?? "",
    },
    ...rest,
  };
}

/**
 * @param {{ mainImageUrl?: string, mainImageLocalPath?: string, id?: string } & Record<string, unknown>} product
 * @param {Array<{ id: string, url: string, localPath: string }>} [subImages]
 */
export function shapeProduct(product, subImages = []) {
  if (!product) return null;
  const { id, mainImageUrl, mainImageLocalPath, ...rest } = product;
  return {
    _id: id,
    mainImage: {
      url: mainImageUrl,
      localPath: mainImageLocalPath ?? "",
    },
    subImages: subImages.map((img) => ({
      _id: img.id,
      url: img.url,
      localPath: img.localPath ?? "",
    })),
    ...rest,
  };
}

/**
 * @param {{ coverImageUrl?: string, coverImageLocalPath?: string, id?: string } & Record<string, unknown>} profile
 */
export function shapeSocialProfile(profile) {
  if (!profile) return null;
  const { id, coverImageUrl, coverImageLocalPath, ...rest } = profile;
  return {
    _id: id,
    coverImage: {
      url: coverImageUrl ?? "https://via.placeholder.com/800x450.png",
      localPath: coverImageLocalPath ?? "",
    },
    ...rest,
  };
}

/**
 * @param {{ id?: string } & Record<string, unknown>} post
 * @param {Array<{ id: string, url: string, localPath?: string }>} [images]
 */
export function shapeSocialPost(post, images = []) {
  if (!post) return null;
  const { id, ...rest } = post;
  return {
    _id: id,
    images: images.map((img) => ({
      _id: img.id,
      url: img.url,
      localPath: img.localPath ?? "",
    })),
    ...rest,
  };
}

/**
 * @param {Record<string, unknown>} order
 */
export function shapeOrderAddress(order) {
  if (!order) return null;
  const {
    addressLine1,
    addressLine2,
    city,
    country,
    pincode,
    state,
    ...rest
  } = order;
  return {
    ...rest,
    address: {
      addressLine1,
      addressLine2,
      city,
      country,
      pincode,
      state,
    },
  };
}
