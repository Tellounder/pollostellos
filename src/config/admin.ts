const fallbackEmail = "pollostellos.arg@gmail.com";

export const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL ?? fallbackEmail
).toLowerCase();
