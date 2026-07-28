export type Transport = "usb" | "wifi";

export interface ProductIdentity {
  binName: string;
  stateDirName: string;
  defaultPreviewPort: number;
  defaultHelperPort: number;
}

export const SERVE_SIM_PRODUCT: ProductIdentity = {
  binName: "serve-sim",
  stateDirName: "serve-sim",
  defaultPreviewPort: 3200,
  defaultHelperPort: 3100,
};

export const SERVE_DEVICE_PRODUCT: ProductIdentity = {
  binName: "serve-device",
  stateDirName: "serve-device",
  defaultPreviewPort: 4200,
  defaultHelperPort: 4100,
};
