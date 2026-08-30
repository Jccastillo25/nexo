// Datos reales de la empresa. Única fuente de verdad para nombre, contacto y
// dirección — se reutiliza en Header, Footer, Contáctenos y el botón de
// WhatsApp. Editar aquí si cambian.

export const EMPRESA = {
  nombre: "Materiales Jcastillo",
  eslogan: "Materiales de construcción",
  direccion:
    "Carretera Norte, Edificio Armando Guido, 1 cuadra al norte, mano izquierda",
  telefonoPbx: "+505 7517 7300",
  telefonoPbxHref: "tel:+50575177300",
  whatsappNumero: "+505 8786 2020",
  whatsappHref:
    "https://wa.me/50587862020?text=" +
    encodeURIComponent("Hola, quisiera más información sobre sus productos."),
} as const;
