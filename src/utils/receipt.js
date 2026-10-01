import logoKunjungan from '../assets/logo-kunjungan.png';

// Outlet yang punya branding sendiri waktu cetak struk.
// Key = outlet.name (lowercase). Fallback ke logo default kalo ga ketemu.
const OUTLET_LOGOS = {
  kunjungan: logoKunjungan,
};

const DEFAULT_LOGO = '/logo.png';

export const resolveReceiptLogo = outlet => {
  const key = outlet?.name?.trim()?.toLowerCase();

  return OUTLET_LOGOS[key] || DEFAULT_LOGO;
};
