import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmAction, matchesConfirmText, registerConfirmOpener } from "../app/admin/confirm";

afterEach(() => {
  registerConfirmOpener(null);
  vi.unstubAllGlobals();
});

describe("matchesConfirmText", () => {
  it("accepts the word in any case with stray spaces", () => {
    expect(matchesConfirmText("DELETE", "DELETE")).toBe(true);
    expect(matchesConfirmText("  delete ", "DELETE")).toBe(true);
  });

  it("rejects anything else, including a partial word and an empty string", () => {
    expect(matchesConfirmText("DELET", "DELETE")).toBe(false);
    expect(matchesConfirmText("delete it", "DELETE")).toBe(false);
    expect(matchesConfirmText("", "DELETE")).toBe(false);
  });
});

describe("confirmAction", () => {
  it("hands the options to the mounted dialog and returns its answer", async () => {
    const opener = vi.fn().mockResolvedValue(true);
    registerConfirmOpener(opener);

    const options = { title: "Delete this product?", requireText: "DELETE" };
    await expect(confirmAction(options)).resolves.toBe(true);
    expect(opener).toHaveBeenCalledWith(options);

    opener.mockResolvedValue(false);
    await expect(confirmAction(options)).resolves.toBe(false);
  });

  describe("with no dialog mounted", () => {
    it("never allows the action when there is no browser to ask", async () => {
      await expect(confirmAction({ title: "Delete?" })).resolves.toBe(false);
    });

    it("asks for the typed word and only accepts it", async () => {
      const prompt = vi.fn().mockReturnValue("delete");
      vi.stubGlobal("window", { prompt, confirm: vi.fn() });
      await expect(confirmAction({ title: "Delete?", requireText: "DELETE" })).resolves.toBe(true);
      expect(prompt).toHaveBeenCalledOnce();

      prompt.mockReturnValue("nope");
      await expect(confirmAction({ title: "Delete?", requireText: "DELETE" })).resolves.toBe(false);

      prompt.mockReturnValue(null);
      await expect(confirmAction({ title: "Delete?", requireText: "DELETE" })).resolves.toBe(false);
    });

    it("uses a plain confirm when no word is required", async () => {
      const confirm = vi.fn().mockReturnValue(true);
      vi.stubGlobal("window", { prompt: vi.fn(), confirm });
      await expect(confirmAction({ title: "Turn off code?" })).resolves.toBe(true);
      expect(confirm).toHaveBeenCalledOnce();
    });
  });
});
