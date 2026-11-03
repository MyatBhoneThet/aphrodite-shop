import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/backend", () => ({ authenticate: vi.fn() }));
vi.mock("../app/lib/admin-audit", () => ({ recordAdminAction: vi.fn() }));
vi.mock("../app/lib/supabase", () => ({
  requireBackoffice: vi.fn(),
  selectHomepageAds: vi.fn(),
  updateHomepageAd: vi.fn(),
  uploadHomepageAdObject: vi.fn(),
  deleteHomepageAdObject: vi.fn(),
}));

import { NextRequest } from "next/server";
import { DELETE, POST } from "../app/api/admin/home-ads/[id]/burmese/route";
import { adImagePath, assertAdImage } from "../app/lib/homepage-ad-image";
import { authenticate } from "../app/lib/backend";
import * as db from "../app/lib/supabase";

const ad = {
  id: "ad-1",
  title: "Thadingyut promotion",
  image_url: "https://x/en.png",
  storage_path: "uploads/en.png",
  image_url_my: null as string | null,
  storage_path_my: null as string | null,
};

function upload(file: File | null) {
  const form = new FormData();
  if (file) form.set("file", file);
  return new NextRequest("https://shop.test/api/admin/home-ads/ad-1/burmese", { method: "POST", body: form });
}
const context = { params: Promise.resolve({ id: "ad-1" }) };

describe("banner image rules", () => {
  it("accepts JPG, PNG and WebP up to 8 MB only", () => {
    expect(() => assertAdImage(new File(["x"], "a.png", { type: "image/png" }))).not.toThrow();
    expect(() => assertAdImage(new File(["x"], "a.gif", { type: "image/gif" }))).toThrow(/JPG, PNG or WebP/);
    expect(() => assertAdImage(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }))).toThrow(/8 MB/);
    expect(() => assertAdImage(null)).toThrow(/Choose/);
  });

  it("gives the Burmese copy its own path", () => {
    const file = new File(["x"], "my banner!.png", { type: "image/png" });
    expect(adImagePath(file, "-my")).toMatch(/^uploads\/[0-9a-f-]{36}-my-my-banner-\.png$/);
  });
});

describe("the Burmese version of a banner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authenticate).mockResolvedValue({ id: "admin-1", role: "admin" } as never);
    vi.mocked(db.selectHomepageAds).mockResolvedValue([ad] as never);
    vi.mocked(db.uploadHomepageAdObject).mockResolvedValue("https://x/my.png");
    vi.mocked(db.updateHomepageAd).mockImplementation(async (_id, fields) => ({ ...ad, ...fields }) as never);
    vi.mocked(db.deleteHomepageAdObject).mockResolvedValue(undefined);
  });

  it("stores the uploaded picture next to the English one", async () => {
    const response = await POST(upload(new File(["x"], "my.png", { type: "image/png" })), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ad.image_url_my).toBe("https://x/my.png");
    expect(vi.mocked(db.updateHomepageAd).mock.calls[0][1]).toMatchObject({ image_url_my: "https://x/my.png" });
    // The English image is left untouched.
    expect(db.deleteHomepageAdObject).not.toHaveBeenCalled();
  });

  it("deletes the old Burmese file when it is replaced", async () => {
    vi.mocked(db.selectHomepageAds).mockResolvedValue([{ ...ad, image_url_my: "https://x/old.png", storage_path_my: "uploads/old-my.png" }] as never);
    await POST(upload(new File(["x"], "new.png", { type: "image/png" })), context);
    expect(db.deleteHomepageAdObject).toHaveBeenCalledWith("uploads/old-my.png");
  });

  it("rejects a file that is not an image and uploads nothing", async () => {
    const response = await POST(upload(new File(["x"], "a.pdf", { type: "application/pdf" })), context);
    expect(response.status).toBe(400);
    expect(db.uploadHomepageAdObject).not.toHaveBeenCalled();
  });

  it("removes the Burmese image so visitors see English again", async () => {
    vi.mocked(db.selectHomepageAds).mockResolvedValue([{ ...ad, image_url_my: "https://x/my.png", storage_path_my: "uploads/my.png" }] as never);
    const response = await DELETE(new NextRequest("https://shop.test/x", { method: "DELETE" }), context);

    expect(response.status).toBe(200);
    expect(vi.mocked(db.updateHomepageAd).mock.calls[0][1]).toEqual({ image_url_my: null, storage_path_my: null });
    expect(db.deleteHomepageAdObject).toHaveBeenCalledWith("uploads/my.png");
  });

  it("says not found for an unknown banner", async () => {
    vi.mocked(db.selectHomepageAds).mockResolvedValue([]);
    const response = await POST(upload(new File(["x"], "my.png", { type: "image/png" })), context);
    expect(response.status).toBe(404);
  });
});
