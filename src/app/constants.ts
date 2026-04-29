export const APP_NAME = "IPL Jatiloka Residence";

export const PUBLIC_DASHBOARD_MODES = ["aggregate", "kavling_status"] as const;

export type PublicDashboardMode = (typeof PUBLIC_DASHBOARD_MODES)[number];

export const DEFAULT_PUBLIC_DASHBOARD_MODE: PublicDashboardMode = "aggregate";
