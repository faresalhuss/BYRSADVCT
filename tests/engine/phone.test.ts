import { describe, expect, it } from "vitest";
import { formatPhoneInput, normalizePhone, telHref } from "@/lib/phone";

describe("phone formatting", () => {
  it("formats progressively as the user types", () => {
    expect(formatPhoneInput("")).toBe("");
    expect(formatPhoneInput("6")).toBe("(6");
    expect(formatPhoneInput("678")).toBe("(678");
    expect(formatPhoneInput("6782")).toBe("(678) 2");
    expect(formatPhoneInput("678224")).toBe("(678) 224");
    expect(formatPhoneInput("6782249")).toBe("(678) 224-9");
    expect(formatPhoneInput("6782249057")).toBe("(678) 224-9057");
    expect(formatPhoneInput("1-678-224-9057")).toBe("(678) 224-9057");
    expect(formatPhoneInput("(678) 224-9057")).toBe("(678) 224-9057");
  });
  it("leaves international and over-long numbers as typed", () => {
    expect(formatPhoneInput("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhoneInput("67822490571234")).toBe("67822490571234");
  });
  it("normalizes stored values and builds tel links", () => {
    expect(normalizePhone("6782249057")).toBe("(678) 224-9057");
    expect(normalizePhone("  ")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("678-224")).toBe("678-224");
    expect(telHref("(678) 224-9057")).toBe("tel:+16782249057");
    expect(telHref("+44 20 7946 0958")).toBe("tel:+442079460958");
  });
});
