/* Paste your Google OAuth Web Client ID below (Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application).
   Authorized JavaScript origins must include:
     https://freshbitesfoodswh.github.io
   Authorized redirect URIs can stay empty for GIS One Tap / button flow.
   Free. No paid APIs. */
window.ATRIUM_AUTH = {
  clientId: '', // e.g. '123456789-abcdef.apps.googleusercontent.com'
  allowlist: [
    'HeytiffaniAllen@gmail.com',
    'teri.huff@growlittleroots.com',
    'teri.huff.solutions@gmail.com',
    'teri.huff@gmail.com'
  ].map(e => e.toLowerCase())
};
