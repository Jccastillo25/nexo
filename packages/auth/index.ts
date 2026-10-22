// @nexo/auth — sesión, empresa activa, URL del panel, cierre de sesión y marca
// de la plataforma, compartidos por todas las zonas de Nexo. Solo servidor:
// un Client Component que necesite signOut lo importa de "@nexo/auth/acciones".
//
// Como todas las zonas viven bajo nexo.materialesjcastillo.com, la cookie de
// sesión es nativa del dominio: no hace falta compartir cookies entre
// subdominios.
import "server-only";

export { getCompanyId } from "./empresa";
export { getPanelUrl } from "./panel";
export { sesionActual, contextoActual, misPermisos, type Sesion, type Contexto } from "./sesion";
export { signOut } from "./acciones";
export {
  getPlatformSettings,
  revalidarPlatformSettings,
  DEFAULT_PLATFORM_SETTINGS,
  ETIQUETA_PLATFORM_SETTINGS,
  type PlatformSettings,
  type PlatformBullet,
} from "./platform-settings";
