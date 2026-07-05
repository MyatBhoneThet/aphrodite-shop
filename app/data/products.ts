export type UserRole = "normal" | "wholesale" | "admin";

export type ProductType = "laptop" | "accessory";

export type Product = {
  id: number;
  name: string;
  type: ProductType;
  category: string;
  brand: string;
  price: number;
  wholesalePrice?: number;
  image: string;
  model3D?: string;
  stock: "In Stock" | "Out of Stock";
  specs: {
    cpu?: string;
    ram?: string;
    storage?: string;
    display?: string;
    detail?: string;
  };
  fullSpecs: {
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
