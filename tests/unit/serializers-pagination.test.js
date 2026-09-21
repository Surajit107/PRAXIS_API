import { describe, expect, test } from "@jest/globals";
import { shapeUser, withId } from "@/models/serializers.js";
import {
  buildAggregatePaginateResponse,
  getDrizzlePaginationOptions,
} from "@/utils/helpers.js";

describe("serializers", () => {
  test("withId maps id → _id", () => {
    expect(withId({ id: "abc", title: "t" })).toEqual({
      _id: "abc",
      title: "t",
    });
    expect(withId(null)).toBeNull();
  });

  test("shapeUser nests avatar and strips secrets", () => {
    const shaped = shapeUser({
      id: "u1",
      username: "alice",
      email: "a@b.com",
      role: "USER",
      password: "hash",
      refreshToken: "rt",
      avatarUrl: "https://cdn/x.png",
      avatarLocalPath: "public/images/x.png",
      emailVerificationToken: "t",
      emailVerificationExpiry: new Date(),
      forgotPasswordToken: "f",
      forgotPasswordExpiry: new Date(),
      isEmailVerified: true,
    });

    expect(shaped).toMatchObject({
      _id: "u1",
      username: "alice",
      avatar: {
        url: "https://cdn/x.png",
        localPath: "public/images/x.png",
      },
    });
    expect(shaped.password).toBeUndefined();
    expect(shaped.refreshToken).toBeUndefined();
    expect(shaped.emailVerificationToken).toBeUndefined();
  });
});

describe("pagination helpers", () => {
  test("getDrizzlePaginationOptions applies defaults and customLabels", () => {
    const options = getDrizzlePaginationOptions({
      page: "2",
      limit: "5",
      customLabels: { docs: "products" },
    });

    expect(options.page).toBe(2);
    expect(options.limit).toBe(5);
    expect(options.customLabels.docs).toBe("products");
  });

  test("buildAggregatePaginateResponse matches standard paginate shape", () => {
    const result = buildAggregatePaginateResponse({
      docs: [{ _id: "1" }],
      totalDocs: 11,
      page: 2,
      limit: 5,
      customLabels: { docs: "items" },
    });

    expect(result).toEqual({
      items: [{ _id: "1" }],
      totalDocs: 11,
      limit: 5,
      page: 2,
      totalPages: 3,
      pagingCounter: 6,
      hasPrevPage: true,
      hasNextPage: true,
      prevPage: 1,
      nextPage: 3,
    });
  });
});
