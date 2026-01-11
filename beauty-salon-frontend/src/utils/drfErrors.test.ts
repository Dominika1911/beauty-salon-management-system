import { describe, it, expect } from "vitest";
import { parseDrfError, pickFieldErrors } from "./drfErrors";

describe("utils/drfErrors – parseDrfError", () => {
  it("returns fallback message and empty fieldErrors when error has no response.data", () => {
    const parsed = parseDrfError({ message: "Boom" });

    expect(parsed.fieldErrors).toEqual({});
    expect(typeof parsed.message).toBe("string");
    expect(parsed.message).toContain("Boom");
  });

  it("passes through status when provided", () => {
    const parsed = parseDrfError({
      response: { status: 401, data: { detail: "Unauthorized" } },
    });

    expect(parsed.status).toBe(401);
    expect(parsed.message).toBe("Unauthorized");
  });

  it("handles response.data as string", () => {
    const parsed = parseDrfError({
      response: { status: 500, data: "Server exploded" },
    });

    expect(parsed.status).toBe(500);
    expect(parsed.message).toBe("Server exploded");
    expect(parsed.fieldErrors).toEqual({});
  });

  it("handles response.data being null/number/array (unexpected shapes) without throwing", () => {
    const parsedNull = parseDrfError({ response: { status: 400, data: null } });
    expect(parsedNull.status).toBe(400);
    expect(parsedNull.fieldErrors).toEqual({});
    expect(typeof parsedNull.message).toBe("string");

    const parsedNum = parseDrfError({ response: { status: 400, data: 123 } });
    expect(parsedNum.status).toBe(400);
    expect(parsedNum.fieldErrors).toEqual({});
    expect(typeof parsedNum.message).toBe("string");

    const parsedArr = parseDrfError({ response: { status: 400, data: ["x"] } });
    expect(parsedArr.status).toBe(400);
    expect(parsedArr.fieldErrors).toEqual({});
    expect(typeof parsedArr.message).toBe("string");
  });

  it("prefers detail as message when present", () => {
    const parsed = parseDrfError({
      response: {
        status: 400,
        data: {
          detail: "Bad request",
          username: ["too short"],
        },
      },
    });

    expect(parsed.message).toBe("Bad request");
    expect(parsed.fieldErrors).toEqual({ username: "too short" });
  });

  it("uses non_field_errors when detail is absent", () => {
    const parsed = parseDrfError({
      response: {
        status: 400,
        data: {
          non_field_errors: ["Invalid credentials"],
          password: ["Too weak"],
        },
      },
    });

    expect(parsed.message).toBe("Invalid credentials");
    expect(parsed.fieldErrors).toEqual({ password: "Too weak" });
  });

  it("collects only field errors and ignores detail/non_field_errors as fields", () => {
    const parsed = parseDrfError({
      response: {
        status: 400,
        data: {
          detail: "Bad request",
          non_field_errors: ["x"],
          username: ["u1", "u2"],
          password: ["p1"],
        },
      },
    });

    expect(parsed.fieldErrors).toEqual({
      username: "u1",
      password: "p1",
    });
  });

  it("stringifies non-string items inside field error arrays", () => {
    const parsed = parseDrfError({
      response: {
        status: 400,
        data: {
          username: [123],
          password: [false],
        },
      },
    });

    expect(parsed.fieldErrors).toEqual({
      username: "123",
      password: "false",
    });
  });
});

describe("utils/drfErrors – pickFieldErrors", () => {
  it("returns empty object when fieldErrors is undefined", () => {
    const picked = pickFieldErrors(undefined, {
      username: "Nazwa użytkownika",
      password: "Hasło",
    });

    expect(picked).toEqual({});
  });

  it("picks only keys that exist in template", () => {
    const picked = pickFieldErrors<{ username: string; password: string }>(
      {
        username: "Too short",
        password: "Too weak",
        extra: "Should be ignored",
      },
      {
        username: "Nazwa użytkownika",
        password: "Hasło",
      }
    );

    expect(picked).toEqual({
      username: "Too short",
      password: "Too weak",
    });
  });
});
