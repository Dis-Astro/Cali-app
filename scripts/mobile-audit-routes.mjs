export const publicRoutes = [
  ['/', '01-home'],
  ['/contatti', '02-contatti'],
  ['/login', '03-login'],
];

export const roleRoutes = {
  admin: [
    ['/admin', '10-admin-dashboard'],
    ['/admin/utenti', '11-admin-utenti'],
    ['/admin/abbonamenti', '12-admin-abbonamenti'],
    ['/admin/calendario', '13-admin-calendario'],
    ['/admin/corsi', '14-admin-corsi'],
    ['/admin/orari', '15-admin-orari'],
    ['/admin/piani', '16-admin-piani'],
    ['/admin/segnalazioni', '17-admin-segnalazioni'],
    ['/admin/spese', '18-admin-spese'],
    ['/admin/andamento-struttura', '19-admin-andamento'],
  ],
  coach: [
    ['/coach', '20-coach-dashboard'],
    ['/coach/clienti', '21-coach-clienti'],
    ['/coach/schede', '22-coach-schede'],
    ['/coach/calendario', '23-coach-calendario'],
    ['/coach/segnalazioni', '24-coach-segnalazioni'],
  ],
  cliente_coaching: [
    ['/coaching', '30-coaching-dashboard'],
    ['/coaching/scheda', '31-coaching-scheda'],
    ['/coaching/progressi', '32-coaching-progressi'],
    ['/coaching/appuntamenti', '33-coaching-appuntamenti'],
    ['/coaching/documenti', '34-coaching-documenti'],
    ['/coaching/segnala', '35-coaching-segnala'],
  ],
  cliente_palestra: [['/palestra', '40-palestra-dashboard']],
  cliente_corso: [['/palestra', '40-palestra-dashboard']],
};
