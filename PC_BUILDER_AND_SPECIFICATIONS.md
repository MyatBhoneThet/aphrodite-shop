# Category specifications and PC Build Planner

This update makes the product page show only specifications that belong to the product being viewed. It also adds a catalogue-based PC Build Planner at `/pc-builder`.

## Where customers find the planner

The planner is linked from three visible places:

1. **PC Builder** in the desktop header.
2. **Build a PC** in the category cards on the home page.
3. The **Plan a complete PC from your budget** banner above the PC-parts section.

The existing chatbot also recognises PC-build questions and sends the customer to the planner.

## How the planner works

The customer enters a minimum budget, a maximum budget, and a purpose. The supported purposes are office work, gaming, streaming, creative work, development, and 3D/AI work.

The planner loads the current public catalogue, keeps only in-stock recognised PC parts, and creates up to three suggestions:

- **Value** targets the minimum budget.
- **Balanced** targets the midpoint.
- **Performance** targets the maximum budget.

For gaming, streaming, creative, and 3D work it includes a dedicated graphics card. Office and development plans do not force a dedicated GPU. A complete plan can contain CPU, motherboard, memory, GPU when needed, storage, power supply, case, and CPU cooling.

The generated total uses the real retail prices stored for the selected products. The planner never invents a product. If a required category is absent, it displays the missing category and marks the plan **Needs review**.

The first compatibility checks are automatic:

- CPU socket against motherboard socket.
- Motherboard memory type against RAM type.

Staff must still confirm BIOS support, case clearances, CPU cooler capacity, graphics-card length, power connectors, and PSU wattage before accepting the final order.

## Product categories the planner recognises

For best results, use these category names in Admin or in the Google Sheet's **PC Parts** tab:

- `CPU` or `Processor`
- `Motherboard`
- `RAM` or `Memory`
- `GPU` or `Graphics Card`
- `Storage`, `SSD`, `NVMe`, or `HDD`
- `PSU` or `Power Supply`
- `Case` or `Chassis`
- `Cooling`, `Cooler`, `AIO`, or `Case Fan`

Names such as Ryzen, Core i7, GeForce RTX, Radeon, DDR5, NVMe, and 80 Plus also help recognition.

## Entering category-specific specifications

Open **Admin → Products**, add or edit a product, and enter JSON in **Short specs** and **Full specs**. All values may be strings, numbers, or booleans. Empty values, `-`, and `N/A` are not shown to customers.

The database already stores these fields as JSON, so this update does not require a new SQL migration.

### Laptop example

Set the product type to `laptop`.

```json
{
  "processor": "Intel Core Ultra 7 155H",
  "ram": "16 GB LPDDR5X",
  "storage": "1 TB PCIe NVMe SSD",
  "graphics": "Intel Arc Graphics",
  "display": "14 inch 2.8K OLED, 120 Hz",
  "battery": "75 Wh",
  "weight": "1.32 kg",
  "ports": "2x Thunderbolt 4, HDMI 2.1, USB-A",
  "operatingSystem": "Windows 11 Home",
  "color": "Midnight Black",
  "warranty": "2 years"
}
```

Only filled laptop fields are displayed. A missing battery or weight row is omitted instead of displaying `-`.

### CPU example

```json
{
  "socket": "AM5",
  "cores": 6,
  "threads": 12,
  "clockSpeed": "3.8 GHz, up to 5.1 GHz",
  "architecture": "Zen 4",
  "integratedGraphics": "AMD Radeon Graphics",
  "tdp": "65 W",
  "warranty": "3 years"
}
```

### Motherboard example

```json
{
  "socket": "AM5",
  "chipset": "B650",
  "formFactor": "ATX",
  "memoryType": "DDR5",
  "memorySlots": "4 DIMM, up to 192 GB",
  "expansionSlots": "1x PCIe 4.0 x16",
  "m2Slots": "3x M.2",
  "network": "2.5 Gb LAN, Wi-Fi 6E"
}
```

### Memory example

```json
{
  "capacity": "32 GB",
  "memoryType": "DDR5",
  "speed": "6000 MT/s",
  "kit": "2 x 16 GB",
  "latency": "CL30"
}
```

### Graphics card example

```json
{
  "gpu": "NVIDIA GeForce RTX 4070 SUPER",
  "vram": "12 GB GDDR6X",
  "memoryType": "GDDR6X",
  "interface": "PCIe 4.0 x16",
  "boostClock": "2475 MHz",
  "recommendedPsu": "650 W",
  "displayOutputs": "3x DisplayPort 1.4a, 1x HDMI 2.1a",
  "dimensions": "234 x 124 x 40 mm",
  "warranty": "3 years"
}
```

### Storage example

```json
{
  "capacity": "1 TB",
  "driveType": "NVMe SSD",
  "interface": "PCIe 4.0",
  "formFactor": "M.2 2280",
  "readSpeed": "7,000 MB/s",
  "writeSpeed": "6,000 MB/s"
}
```

### Power supply example

```json
{
  "wattage": "750 W",
  "efficiency": "80 Plus Gold",
  "modularity": "Fully modular",
  "formFactor": "ATX",
  "connectors": "2x EPS, 3x PCIe, 1x 12VHPWR"
}
```

### PC case example

```json
{
  "motherboardSupport": "ATX, Micro-ATX, Mini-ITX",
  "caseType": "Mid tower",
  "gpuClearance": "Up to 400 mm",
  "coolerClearance": "Up to 170 mm",
  "includedFans": "3 x 120 mm",
  "color": "Black"
}
```

### CPU cooler example

```json
{
  "coolerType": "240 mm AIO liquid cooler",
  "socketSupport": "AM5, AM4, LGA1700",
  "radiatorSize": "240 mm",
  "noiseLevel": "Up to 31 dBA"
}
```

### Monitor accessory example

```json
{
  "screenSize": "27 inch",
  "resolution": "2560 x 1440 QHD",
  "refreshRate": "180 Hz",
  "panel": "IPS",
  "responseTime": "1 ms",
  "ports": "2x HDMI 2.0, 1x DisplayPort 1.4",
  "warranty": "3 years"
}
```

Mouse, keyboard, and headset pages similarly select only their relevant fields, such as connection, DPI, switches, layout, driver, microphone, or battery life.

## Files implementing this feature

- `app/lib/product-specifications.ts` classifies products and builds category-specific rows.
- `app/products/[id]/page.tsx` renders the relevant title, summary, and table.
- `app/lib/pc-builder.ts` selects in-stock parts, applies budget targets, and performs initial compatibility checks.
- `app/pc-builder/page.tsx` is the customer-facing budget form and results page.
- `app/components/Navbar.tsx`, `app/components/CategoryGrid.tsx`, and `app/page.tsx` expose the planner.
- `app/components/ChatbotButton.tsx` recognises PC-build questions.

## Google Sheets note

The current PC Parts importer receives the product description rather than separate columns for every technical field. It can extract common values from clear descriptions, such as `AM5`, `DDR5`, `32 GB`, `750 W`, or `240 mm`. For the best specification table and compatibility matching, enter the structured Full specs JSON through Admin or extend the Sheet/importer with dedicated specification columns later.

