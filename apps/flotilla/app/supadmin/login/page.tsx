import { getPlatformSettings } from "@/lib/platform-settings";
import { SupadminLoginForm } from "./SupadminLoginForm";

export default async function SupadminLoginPage() {
  const { productName, logoUrl, copyrightText } = await getPlatformSettings();

  return (
    <SupadminLoginForm productName={productName} logoUrl={logoUrl} copyrightText={copyrightText} />
  );
}
