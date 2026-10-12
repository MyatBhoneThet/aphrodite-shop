import { describe, expect, it } from "vitest";
import { normalizeYangonTownship, pickYangonTownship, YANGON_TOWNSHIPS } from "../app/lib/delivery-country";

// Values below are what OpenStreetMap actually returned for real pins around
// Yangon (October 2026). Each one used to leave the township empty.
describe("township names from a map pin", () => {
  it("accepts the spellings OpenStreetMap uses", () => {
    const cases: [string, string][] = [
      ["Kamaryut", "Kamayut"],
      ["Mayangone", "Mayangon"],
      ["Hlaingtharya (East)", "Hlaing Tharyar"],
      ["Hlaingtharya (West)", "Hlaing Tharyar"],
      ["Botahtaung", "Botataung"],
      ["Thanlyin", "Thanlyin"],
      ["Hlegu Township", "Hlegu"],
      ["Kawhmu Township", "Kawhmu"],
      ["Kungyangon", "Kungyangon"],
      ["Taikkyi Township", "Taikkyi"],
      ["Taik Kyi", "Taikkyi"],
      ["Thongwa Township", "Thongwa"],
      ["Kayan Township", "Khayan"],
      ["Dala Township", "Dala"],
      ["Twantay Township", "Twante"],
      ["Seikkyi Kanaungto", "Seikgyikanaungto"],
      ["hlaing-tharyar", "Hlaing Tharyar"],
      ["  Mingala  Taungnyunt  ", "Mingala Taungnyunt"],
      ["North Okkalarpa", "North Okkalapa"],
    ];
    for (const [written, expected] of cases) {
      expect(normalizeYangonTownship(written), written).toBe(expected);
    }
  });

  it("still knows every township we deliver to by its own name", () => {
    for (const township of YANGON_TOWNSHIPS) {
      expect(normalizeYangonTownship(township)).toBe(township);
      expect(normalizeYangonTownship(`${township} Township`)).toBe(township);
    }
  });

  it("does not mistake a district, a ward or another region for a township", () => {
    expect(normalizeYangonTownship("Kyauktada District")).toBeUndefined();
    expect(normalizeYangonTownship("Twantay District")).toBeUndefined();
    expect(normalizeYangonTownship("Dagon Myothit District")).toBeUndefined();
    expect(normalizeYangonTownship("No (10) Ward")).toBeUndefined();
    expect(normalizeYangonTownship("Yangon City")).toBeUndefined();
    expect(normalizeYangonTownship("Mandalay")).toBeUndefined();
    expect(normalizeYangonTownship("သံလျင်")).toBeUndefined();
    expect(normalizeYangonTownship("")).toBeUndefined();
    expect(normalizeYangonTownship(null)).toBeUndefined();
  });

  it("picks the township from whichever map field carries it", () => {
    // A pin in Latha: the district comes first and is skipped, the suburb is the township.
    expect(pickYangonTownship(["Kyauktada District", undefined, "Latha", undefined, undefined, undefined, undefined, "Yangon City"])).toBe("Latha");
    // A pin in Hlegu: only the municipality names it.
    expect(pickYangonTownship([undefined, undefined, undefined, "Hlegu Township", undefined, "Kyauk Aing", "Hlegu District", undefined])).toBe("Hlegu");
    // A pin in Bahan where the map calls the area Kamaryut.
    expect(pickYangonTownship([undefined, undefined, "Kamaryut", undefined, undefined, undefined, undefined, "Yangon City"])).toBe("Kamayut");
    expect(pickYangonTownship([undefined, "Yangon City"])).toBeUndefined();
  });
});
