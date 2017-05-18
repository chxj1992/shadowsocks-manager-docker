const gcmSenderId = appRequire('services/config').get('plugins.webgui.gcmSenderId').toString();

const manifest = {
  short_name: 'ssmgr',
  name: 'Fuck The Wall',
  start_url: '/',
  display: 'standalone',
  background_color: 'rgb(69, 70, 72)',
  theme_color: 'rgb(69, 70, 72)',
  gcm_sender_id: gcmSenderId
};

exports.manifest = manifest;
