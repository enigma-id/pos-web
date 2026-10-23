import logoSukabread from '../assets/logo.png';

const DEFAULT_LOGO = logoSukabread;

export const resolveReceiptLogo = outlet => {
  return outlet?.brand?.logo_url || DEFAULT_LOGO;
};
