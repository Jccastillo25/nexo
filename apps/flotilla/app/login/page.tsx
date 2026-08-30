import { getPlatformSettings } from "@/lib/platform-settings";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const { productName, logoUrl, copyrightText } = await getPlatformSettings();

  return <LoginForm productName={productName} logoUrl={logoUrl} copyrightText={copyrightText} />;
}
