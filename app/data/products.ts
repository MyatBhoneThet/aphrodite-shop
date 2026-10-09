export type UserRole = "normal" | "wholesale" | "staff" | "admin";

export type ProductType = "laptop" | "accessory";

export type Product = {
  id: number;
  name: string;
  type: ProductType;
  /** Production workbook tab this product was synced from
   *  ("Laptops" | "Accessories" | "PC Parts"); absent for manual products. */
  sourceSheet?: string;
  category: string;
  brand: string;
  price: number;
  /** Legacy single wholesale price. No longer used for pricing (quantity
   *  tiers are authoritative) and never sent to non-admin clients. */
  wholesalePrice?: number;
  image: string;
  model3D?: string;
  stock: "In Stock" | "Out of Stock";
  /** Authoritative numeric inventory. Only serialized for admins. */
  stockQuantity?: number;
  specs: {
    [key: string]: unknown;
    cpu?: string;
    ram?: string;
    storage?: string;
    display?: string;
    detail?: string;
  };
  fullSpecs: {
    [key: string]: unknown;
    processor?: string;
    ram?: string;
    storage?: string;
    graphics?: string;
    display?: string;
    battery?: string;
    weight?: string;
    ports?: string;
    operatingSystem?: string;
    warranty?: string;
    condition?: string;
    color?: string;
    detail?: string;
  };
};
