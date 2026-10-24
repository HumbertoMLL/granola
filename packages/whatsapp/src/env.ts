/**
 * Variables WA_* leídas de forma perezosa para que `tsc` y `next build` pasen
 * sin credenciales de Meta. Sin WA_ACCESS_TOKEN el cliente entra en "dry run".
 */
export type WhatsAppEnv = {
  phoneNumberId: string | undefined;
  businessAccountId: string | undefined;
  accessToken: string | undefined;
  verifyToken: string | undefined;
  appSecret: string | undefined;
  /** Versión de Graph API. Default v21.0. */
  graphVersion: string;
};

export function readWhatsAppEnv(env: NodeJS.ProcessEnv = process.env): WhatsAppEnv {
  return {
    phoneNumberId: env.WA_PHONE_NUMBER_ID || undefined,
    businessAccountId: env.WA_BUSINESS_ACCOUNT_ID || undefined,
    accessToken: env.WA_ACCESS_TOKEN || undefined,
    verifyToken: env.WA_VERIFY_TOKEN || undefined,
    appSecret: env.WA_APP_SECRET || undefined,
    graphVersion: env.WA_GRAPH_VERSION || "v21.0",
  };
}
