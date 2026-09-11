export type AppearanceStatus = "known" | "none" | "unknown";

export type AppearancePart = {
  status: AppearanceStatus;
  type?: string;
  color?: string;
  brand?: string;
};

export type Appearance = {
  top: AppearancePart;
  bottom: AppearancePart;
  hat: AppearancePart;
  shoes: AppearancePart;
  glasses: AppearancePart;
  items: Array<{ type: string; color?: string }>;
};
